import type { CalendarTask } from '@todo/shared';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Pagination } from '../components/Pagination';
import { t } from '../i18n';
import { calendarProjectName, todayIso } from '../labels';
import { useArchive, useOverdue, useRestoreProject, useToggleCalendarTask, useUndated } from '../queries';
import { useUiStore, type ArchiveSort, type OverdueSort, type UndatedSort } from '../store';
import { CalendarFilters } from './CalendarFilters';
import { CalendarTaskModal } from './CalendarTaskModal';
import { useFilteredTasks } from './filtering';
import { TaskGridCard, type GridVariant } from './TaskGridCard';

/** Teksty i klasy właściwe dla każdego widoku (reszta logiki jest wspólna). */
const textsFor = (variant: GridVariant) => ({
  className: variant,
  filtersClass: `${variant}-filters`,
  aria: t(`grid.${variant}.aria`),
  sortLabel: t(`grid.${variant}.sortLabel`),
  loadError: t(`grid.${variant}.loadError`),
  none: t(`grid.${variant}.none`),
  noneLong: t(`grid.${variant}.noneLong`),
  noMatch: t(`grid.${variant}.noMatch`),
});

/**
 * Zakładki-siatki: „Zaległe” (niewykonane z terminem, który minął), „Bez terminu” (niewykonane bez daty) i „Archiwum” (wykonane).
 * Siatka kart z tymi samymi filtrami co kalendarz (projekty, listy, osoby, priorytet; osobny stan dla każdej zakładki),
 * sortowaniem i główną akcją zależną od widoku (zmiana/ustawienie terminu, przywrócenie).
 */
export function TaskGridSection({ variant, heading }: { variant: GridVariant; heading: ReactNode }) {
  const today = todayIso();
  // wszystkie trzy zapytania są i tak pobierane przez zakładki (liczniki) — współdzielą cache
  const overdueQuery = useOverdue(today);
  const undatedQuery = useUndated();
  const archiveQuery = useArchive();
  const query = variant === 'overdue' ? overdueQuery : variant === 'undated' ? undatedQuery : archiveQuery;
  const texts = textsFor(variant);

  const overdueSort = useUiStore((s) => s.overdueSort);
  const setOverdueSort = useUiStore((s) => s.setOverdueSort);
  const undatedSort = useUiStore((s) => s.undatedSort);
  const setUndatedSort = useUiStore((s) => s.setUndatedSort);
  const archiveSort = useUiStore((s) => s.archiveSort);
  const setArchiveSort = useUiStore((s) => s.setArchiveSort);
  const toggle = useToggleCalendarTask();
  const restoreProject = useRestoreProject();
  const pushToast = useUiStore((s) => s.pushToast);
  const [editing, setEditing] = useState<CalendarTask | null>(null);

  const all = query.data?.tasks ?? [];
  const filtered = useFilteredTasks(variant, all, query.data?.sources);
  const sorted = useMemo(() => {
    // sort jest stabilny: zadania z tym samym kluczem zostają w kolejności z serwera
    if (variant === 'overdue') {
      const dir = overdueSort === 'oldest' ? 1 : -1;
      return [...filtered].sort((a, b) => dir * (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
    }
    if (variant === 'archive') {
      const dir = archiveSort === 'oldest' ? 1 : -1;
      // klucz: moment archiwizacji projektu (zadania zarchiwizowanych projektów) albo czas wykonania
      const key = (task: CalendarTask) => task.projectArchivedAt ?? task.updatedAt;
      return [...filtered].sort((a, b) => dir * key(a).localeCompare(key(b)));
    }
    if (undatedSort === 'order') return filtered;
    const dir = undatedSort === 'oldest' ? 1 : -1;
    return [...filtered].sort((a, b) => dir * a.createdAt.localeCompare(b.createdAt));
  }, [filtered, variant, overdueSort, undatedSort, archiveSort]);

  // Paginacja po stronie klienta (filtry i sortowanie też są po stronie klienta, więc to spójne). Numer strony wraca do 1, gdy zmieni się
  // filtr, sortowanie albo rozmiar strony; przy skracaniu listy (np. po wykonaniu zadań) strona jest przycinana do ostatniej.
  const pageSize = useUiStore((s) => s.pageSize);
  const setPageSize = useUiStore((s) => s.setPageSize);
  const filterState = useUiStore((s) => s.filters[variant]);
  const sectionRef = useRef<HTMLElement>(null);
  const sortValue = variant === 'overdue' ? overdueSort : variant === 'undated' ? undatedSort : archiveSort;
  const resetKey = JSON.stringify([filterState, sortValue, pageSize]);
  const [paging, setPaging] = useState({ page: 1, key: resetKey });
  // zmiana filtra/sortowania/rozmiaru zawsze zaczyna od strony 1 (także przy powrocie do wcześniejszego zestawu)
  if (paging.key !== resetKey) setPaging({ page: 1, key: resetKey });
  const requestedPage = paging.key === resetKey ? paging.page : 1;
  const pageCount = pageSize === 0 ? 1 : Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const pageTasks = pageSize === 0 ? sorted : sorted.slice((page - 1) * pageSize, page * pageSize);
  const goToPage = (next: number) => {
    setPaging({ page: next, key: resetKey });
    // po zmianie strony wracamy na początek sekcji (nagłówek, filtry), żeby nie zostać na dole długiej siatki
    sectionRef.current?.scrollIntoView({ block: 'start' });
  };

  const subtitle = query.isPending
    ? t('app.loading')
    : all.length === 0
      ? texts.none
      : filtered.length === all.length
        ? t(`grid.${variant}.count`, { n: all.length })
        : t(`grid.${variant}.filtered`, { shown: filtered.length, total: all.length });

  return (
    <section ref={sectionRef} className={`calendar ${texts.className}`} aria-label={texts.aria}>
      <div className="section-head">
        <div>
          {heading}
          <p className="muted small">{subtitle}</p>
        </div>
        <label className="sort-control">
          <span>{t('sort.label')}</span>
          {variant === 'overdue' && (
            <select value={overdueSort} onChange={(e) => setOverdueSort(e.target.value as OverdueSort)} aria-label={texts.sortLabel}>
              <option value="oldest">{t('sort.oldest')}</option>
              <option value="newest">{t('sort.newest')}</option>
            </select>
          )}
          {variant === 'undated' && (
            <select value={undatedSort} onChange={(e) => setUndatedSort(e.target.value as UndatedSort)} aria-label={texts.sortLabel}>
              <option value="order">{t('sort.byProject')}</option>
              <option value="newest">{t('sort.newest')}</option>
              <option value="oldest">{t('sort.oldest')}</option>
            </select>
          )}
          {variant === 'archive' && (
            <select value={archiveSort} onChange={(e) => setArchiveSort(e.target.value as ArchiveSort)} aria-label={texts.sortLabel}>
              <option value="newest">{t('sort.archiveNewest')}</option>
              <option value="oldest">{t('sort.archiveOldest')}</option>
            </select>
          )}
        </label>
      </div>

      <CalendarFilters scope={variant} className={texts.filtersClass} sources={query.data?.sources} />

      {query.isError && (
        <div className="notice">
          <p>
            {texts.loadError}: {query.error.message}
          </p>
          <button type="button" className="btn" onClick={() => query.refetch()}>
            {t('app.retry')}
          </button>
        </div>
      )}

      {query.data && all.length === 0 && <p className="empty">{texts.noneLong}</p>}
      {all.length > 0 && filtered.length === 0 && <p className="empty">{texts.noMatch}</p>}

      <div className="overdue-grid">
        {pageTasks.map((task) => (
          <TaskGridCard
            key={task.id}
            task={task}
            today={today}
            variant={variant}
            onChangeDate={() => setEditing(task)}
            onToggle={(done) => {
              // zadanie zarchiwizowanego projektu: „Przywróć” oznacza przywrócenie CAŁEGO projektu
              if (task.projectArchivedAt) {
                restoreProject.mutate(task.projectId, { onSuccess: () => pushToast(t('project.restoredToast', { name: calendarProjectName(task.projectName, task.projectColor) })) });
                return;
              }
              toggle(task, done);
            }}
          />
        ))}
      </div>

      <Pagination total={sorted.length} page={page} pageSize={pageSize} onPage={goToPage} onPageSize={setPageSize} />

      {editing && <CalendarTaskModal task={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}
