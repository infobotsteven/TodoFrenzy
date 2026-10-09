import type { ReactNode } from 'react';
import { PRIORITIES, SYSTEM_COLOR, type CalendarSourceProject, type CalendarSources, type Priority } from '@todo/shared';
import { t } from '../i18n';
import { calendarProjectName, listName, priorityLabel } from '../labels';
import { NO_USER, useUiStore, type FilterScope } from '../store';
import { useUsers } from '../queries';
import { AvatarImage } from '../components/UserAvatar';

/**
 * Filtry kalendarza po projektach i listach. Wybór projektów zawęża zadania do tych projektów; dopiero wtedy
 * pojawiają się ich listy, które zawężają zadania danego projektu do wybranych list.
 */
export function CalendarFilters({
  scope,
  className,
  sources,
  toolbar,
}: {
  /** Którego widoku dotyczą filtry (każdy ma własny stan). */
  scope: FilterScope;
  className: string;
  sources: CalendarSources | undefined;
  /** Dodatkowe kontrolki w pasku nad filtrami (np. „Ukryj ukończone” w kalendarzu); przycisk „Wyczyść filtry” jest zawsze obok nich. */
  toolbar?: ReactNode;
}) {
  const filter = useUiStore((s) => s.filters[scope]);
  const toggleProject = (id: string, listIds: string[]) => useUiStore.getState().toggleFilterProject(scope, id, listIds);
  const toggleList = (id: string) => useUiStore.getState().toggleFilterList(scope, id);
  const toggleUser = (id: string) => useUiStore.getState().toggleFilterUser(scope, id);
  const togglePriority = (p: Priority) => useUiStore.getState().toggleFilterPriority(scope, p);
  const toggleArchived = (id: string, listIds: string[]) => useUiStore.getState().toggleFilterArchived(scope, id, listIds);
  const reset = () => useUiStore.getState().resetFilter(scope);
  const users = useUsers().data ?? [];

  const projects = sources?.projects ?? [];
  const archivedProjects = sources?.archivedProjects ?? [];
  const active = filter.projectIds.length > 0 || filter.listIds.length > 0 || filter.userIds.length > 0 || filter.priorities.length > 0 || filter.archivedIds.length > 0;
  // pasek nad filtrami: dodatkowe kontrolki widoku i stały przycisk „Wyczyść filtry” (nieaktywny, gdy nie ma czego czyścić)
  const bar = (
    <div className="filter-toolbar">
      {toolbar}
      <button type="button" className="btn btn-sm" onClick={reset} disabled={!active}>
        {t('filters.reset')}
      </button>
    </div>
  );
  if (projects.length === 0 && archivedProjects.length === 0) return <div className={`${className} filter-panel`}>{bar}</div>;
  // listy wybranych projektów; w „Archiwum” osobny wiersz „Listy archiwalne” dla wybranych projektów archiwalnych
  // (w kalendarzu archiwalne projekty mają tylko włączenie/wyłączenie)
  const selected = projects.filter((p) => filter.projectIds.includes(p.id));
  const selectedArchived = scope === 'archive' ? archivedProjects.filter((p) => filter.archivedIds.includes(p.id)) : [];

  /** Wiersz z listami wybranych projektów (aktywnych albo archiwalnych - te drugie w przerywanych chipach). */
  const listsRow = (label: string, rowProjects: CalendarSourceProject[], archived: boolean) => (
    <div className="filter-row">
      <span className="filter-label">{label}</span>
      <div className="filter-lists">
        {rowProjects.map((p) => (
          <div key={p.id} className="chips" aria-label={t('filters.listsOf', { name: calendarProjectName(p.name, p.color) })}>
            {rowProjects.length > 1 && <span className="filter-project">{calendarProjectName(p.name, p.color)}:</span>}
            {p.lists.map((l) => {
              const on = filter.listIds.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  className={`${on ? 'chip chip-on' : 'chip'}${archived ? ' chip-archived' : ''}`}
                  aria-pressed={on}
                  onClick={() => toggleList(l.id)}
                >
                  <span className="dot" data-color={l.color ?? undefined} />
                  {listName(l.name, p.color === SYSTEM_COLOR)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`${className} filter-panel`} role="group" aria-label={t('filters.label')}>
      {bar}
      <div className="filter-row">
        <span className="filter-label">{t('filters.projects')}</span>
        <div className="chips">
          {projects.map((p) => {
            const on = filter.projectIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className={on ? 'chip chip-on' : 'chip'}
                aria-pressed={on}
                onClick={() => toggleProject(p.id, p.lists.map((l) => l.id))}
              >
                <span className="dot" data-color={p.color ?? undefined} />
                {calendarProjectName(p.name, p.color)}
              </button>
            );
          })}
        </div>
      </div>

      {selected.length > 0 && listsRow(t('filters.lists'), selected, false)}

      {archivedProjects.length > 0 && (
        <div className="filter-row">
          <span className="filter-label" title={scope === 'archive' ? t('filters.archivedHintArchive') : t('filters.archivedHint')}>{t('filters.archivedProjects')}</span>
          <div className="chips" aria-label={t('filters.archivedProjects')}>
            {archivedProjects.map((p) => {
              const on = filter.archivedIds.includes(p.id);
              return (
                <button key={p.id} type="button" className={on ? 'chip chip-on chip-archived' : 'chip chip-archived'} aria-pressed={on} onClick={() => toggleArchived(p.id, p.lists.map((l) => l.id))}>
                  <span className="dot" data-color={p.color ?? undefined} />
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedArchived.length > 0 && listsRow(t('filters.archivedLists'), selectedArchived, true)}

      <div className="filter-row">
        <span className="filter-label">{t('filters.priority')}</span>
        <div className="chips" aria-label={t('filters.priorityAria')}>
          {[...PRIORITIES].reverse().map((p) => {
            const on = filter.priorities.includes(p);
            return (
              <button key={p} type="button" className={on ? 'chip chip-on' : 'chip'} aria-pressed={on} onClick={() => togglePriority(p)}>
                <span className="dot" data-priority={p} style={{ background: 'var(--p)' }} />
                {priorityLabel(p)}
              </button>
            );
          })}
        </div>
      </div>

      {users.length > 0 && (
        <div className="filter-row">
          <span className="filter-label">{t('filters.users')}</span>
          <div className="chips">
            {users.map((u) => {
              const on = filter.userIds.includes(u.id);
              return (
                <button key={u.id} type="button" className={on ? 'chip chip-on user-chip' : 'chip user-chip'} aria-pressed={on} onClick={() => toggleUser(u.id)}>
                  <AvatarImage avatar={u.avatar} size={20} />
                  {u.nick}
                </button>
              );
            })}
            <button type="button" className={filter.userIds.includes(NO_USER) ? 'chip chip-on' : 'chip'} aria-pressed={filter.userIds.includes(NO_USER)} onClick={() => toggleUser(NO_USER)}>
              {t('filters.noAssignee')}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}


