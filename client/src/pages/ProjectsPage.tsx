import { rectSortingStrategy } from '@dnd-kit/sortable';
import { PlannerSection } from '../calendar/PlannerSection';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { SortableItem, SortableList } from '../components/dnd';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { ProjectCard, ProjectCardGhost } from '../components/ProjectCard';
import { ProjectForm } from '../components/forms';
import { UserManager } from '../components/UserParts';
import { StatsSection } from '../stats/StatsSection';
import { t } from '../i18n';
import { projectDescription, projectName } from '../labels';
import { useCreateProject, useDuplicateProject, useProjects, useReorderProjects, useRestoreProject } from '../queries';
import { useUiStore } from '../store';

/** Stały projekt „Inne” nie bierze udziału w przesuwaniu - zawsze jest pierwszy i wyróżniony. */
const isFixed = (p: { isSystem: boolean }) => p.isSystem;

type View = 'active' | 'archived' | 'stats';

export function ProjectsPage() {
  const projects = useProjects();
  const search = useUiStore((s) => s.projectSearch);
  const setSearch = useUiStore((s) => s.setProjectSearch);
  const [creating, setCreating] = useState(false);
  const [managingUsers, setManagingUsers] = useState(false);
  const create = useCreateProject();
  const reorder = useReorderProjects();
  const duplicate = useDuplicateProject();
  const restore = useRestoreProject();
  const pushToast = useUiStore((s) => s.pushToast);
  const pageSize = useUiStore((s) => s.projectPageSize);
  const setPageSize = useUiStore((s) => s.setProjectPageSize);
  // zakładka jest w adresie (?widok=archiwum): powrót z projektu z archiwum i przycisk „Wstecz” przeglądarki wracają do „Archiwum”
  const [params, setParams] = useSearchParams();
  const widok = params.get('widok');
  const view: View = widok === 'archiwum' ? 'archived' : widok === 'statystyki' ? 'stats' : 'active';
  const setView = (v: View) => setParams(v === 'archived' ? { widok: 'archiwum' } : v === 'stats' ? { widok: 'statystyki' } : {}, { replace: true });

  const query = search.trim().toLowerCase();
  const matches = (p: { name: string; description: string; isSystem: boolean }) =>
    !query || projectName(p).toLowerCase().includes(query) || projectDescription(p).toLowerCase().includes(query);
  const all = projects.data ?? [];
  const activeAll = all.filter((p) => !p.archivedAt);
  // zarchiwizowane: ostatnio zarchiwizowane na górze
  const archivedAll = all.filter((p) => p.archivedAt).sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''));
  const visible = activeAll.filter(matches);
  const archivedVisible = archivedAll.filter(matches);

  // Paginacja po stronie klienta (wspólny komponent z zakładkami zadań). Numer strony wraca do 1 po zmianie zakładki, wyszukiwania albo rozmiaru strony,
  // a przy skracaniu listy (usunięcie/archiwizacja) jest przycinany do ostatniej strony. Przeciąganie zmienia kolejność w obrębie strony.
  const list = view === 'archived' ? archivedVisible : visible;
  const resetKey = JSON.stringify([view, query, pageSize]);
  const [paging, setPaging] = useState({ page: 1, key: resetKey });
  // zmiana zakładki/wyszukiwania/rozmiaru zawsze zaczyna od strony 1 (także przy powrocie do wcześniejszego zestawu)
  if (paging.key !== resetKey) setPaging({ page: 1, key: resetKey });
  const pageCount = pageSize === 0 ? 1 : Math.max(1, Math.ceil(list.length / pageSize));
  const page = Math.min(paging.key === resetKey ? paging.page : 1, pageCount);
  const onPage = (next: number) => {
    setPaging({ page: next, key: resetKey });
    window.scrollTo({ top: 0 });
  };
  const pageOf = <T,>(items: T[]) => (pageSize === 0 ? items : items.slice((page - 1) * pageSize, page * pageSize));
  const pageActive = pageOf(visible);
  const pageArchived = pageOf(archivedVisible);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-tabs">
            <span className="planner-tabs" role="tablist" aria-label={t('projects.tabs')}>
              <button type="button" role="tab" aria-selected={view === 'active'} className="planner-tab page-tab" onClick={() => setView('active')}>
                {t('projects.tabProjects')}
              </button>
              <button type="button" role="tab" aria-selected={view === 'archived'} className="planner-tab page-tab" onClick={() => setView('archived')}>
                {t('projects.tabArchive')}
                {archivedAll.length > 0 && <span className="planner-count planner-count-muted">{archivedAll.length}</span>}
              </button>
              <button type="button" role="tab" aria-selected={view === 'stats'} className="planner-tab page-tab" onClick={() => setView('stats')}>
                {t('projects.tabStats')}
              </button>
            </span>
          </h1>
          <p className="muted">{view === 'active' ? t('projects.subtitle') : view === 'archived' ? t('projects.subtitleArchive') : t('projects.subtitleStats')}</p>
        </div>
        <div className="page-head-actions">
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            {t('projects.new')}
          </button>
          <button type="button" className="btn" onClick={() => setManagingUsers(true)}>
            {t('projects.users')}
          </button>
        </div>
      </div>

      {view === 'stats' ? (
        <StatsSection />
      ) : (
        <>
          <input
            type="search"
            className="search"
            placeholder={t('projects.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('projects.search')}
          />

          {projects.isPending && <p className="muted">{t('app.loading')}</p>}
          {projects.isError && (
            <div className="notice">
              <p>{t('projects.loadError', { error: projects.error.message })}</p>
              <button type="button" className="btn" onClick={() => projects.refetch()}>
                {t('app.retry')}
              </button>
            </div>
          )}
          {view === 'active' && projects.data && activeAll.length === 0 && <p className="empty">{t('projects.empty')}</p>}
          {view === 'active' && activeAll.length > 0 && visible.length === 0 && <p className="empty">{t('projects.noMatch', { search })}</p>}
          {view === 'archived' && projects.data && archivedAll.length === 0 && <p className="empty">{t('projects.archiveEmpty')}</p>}
          {view === 'archived' && archivedAll.length > 0 && archivedVisible.length === 0 && (
            <p className="empty">{t('projects.archiveNoMatch', { search })}</p>
          )}

          {view === 'active' && query && visible.length > 0 && <p className="muted small">{t('projects.reorderOff')}</p>}

          {view === 'archived' && archivedVisible.length > 0 && (
            <div className="grid">
              {pageArchived.map((p) => (
                <div key={p.id} className="project-item">
                  <ProjectCard project={p} />
                  <button
                    type="button"
                    className="btn btn-sm card-restore"
                    aria-label={t('projects.restoreAria', { name: p.name })}
                    disabled={restore.isPending}
                    onClick={() => restore.mutate(p.id, { onSuccess: () => pushToast(t('project.restoredToast', { name: p.name })) })}
                  >
                    {t('common.restore')}
                  </button>
                </div>
              ))}
            </div>
          )}

          {view === 'active' && (
          <SortableList
            ids={pageActive.filter((p) => !isFixed(p)).map((p) => p.id)}
            strategy={rectSortingStrategy}
            onReorder={reorder}
            renderOverlay={(id) => {
              const p = pageActive.find((x) => x.id === id);
              return p ? <ProjectCardGhost project={p} /> : null;
            }}
          >
            <div className="grid">
              {pageActive.filter(isFixed).map((p) => (
                <div key={p.id} className="project-item project-item-fixed">
                  <ProjectCard project={p} />
                </div>
              ))}
              {pageActive.filter((p) => !isFixed(p)).map((p) => (
                <SortableItem key={p.id} id={p.id} className="project-item" disabled={!!query} color={p.color}>
                  {(handle) => (
                    <>
                      <ProjectCard project={p} />
                      <button
                        type="button"
                        className="icon-btn card-action"
                        aria-label={t('projects.duplicateAria', { name: p.name })}
                        title={t('projects.duplicate')}
                        disabled={duplicate.isPending}
                        onClick={() =>
                          duplicate.mutate(p.id, { onSuccess: () => pushToast(t('project.copiedToast', { name: p.name })) })
                        }
                      >
                        ⧉
                      </button>
                      {handle}
                    </>
                  )}
                </SortableItem>
              ))}
            </div>
          </SortableList>
          )}

          <div className="projects-pagination">
            <Pagination total={list.length} page={page} pageSize={pageSize} onPage={onPage} onPageSize={setPageSize} />
          </div>

          <PlannerSection />
        </>
      )}

      {managingUsers && <UserManager onClose={() => setManagingUsers(false)} />}

      {creating && (
        <Modal title={t('projects.newTitle')} onClose={() => setCreating(false)}>
          <ProjectForm
            submitLabel={t('common.create')}
            pending={create.isPending}
            onCancel={() => setCreating(false)}
            onSubmit={(input) => create.mutate(input, { onSuccess: () => setCreating(false) })}
          />
        </Modal>
      )}
    </>
  );
}
