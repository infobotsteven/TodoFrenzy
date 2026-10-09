import { horizontalListSortingStrategy, rectSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BackButton } from '../components/BackButton';
import { ChecklistCard, ChecklistGhost } from '../components/ChecklistCard';
import { SortableList } from '../components/dnd';
import { ChecklistForm, ProjectForm } from '../components/forms';
import { ListViewToggle } from '../components/ListViewToggle';
import { Modal } from '../components/Modal';
import { ProgressBar } from '../components/ProgressBar';
import { TagManager } from '../components/TagManager';
import { TaskFilters } from '../components/TaskFilters';
import { percent } from '../format';
import { locale, t } from '../i18n';
import { projectDescription, projectName } from '../labels';
import {
  useCreateChecklist,
  useDeleteProject,
  useArchiveProject,
  useDuplicateProject,
  useRestoreProject,
  useProject,
  useReorderChecklists,
  useUpdateProject,
} from '../queries';
import { useUiStore } from '../store';
import { LIST_GAP, LIST_WIDTH, useColumnCount, splitIntoColumns } from '../useColumnCount';
import { useMediaQuery } from '../useMediaQuery';
import { askConfirm } from '../confirm';

export function ProjectPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const project = useProject(id);
  const [editing, setEditing] = useState(false);
  const [addingList, setAddingList] = useState(false);
  const [managingTags, setManagingTags] = useState(false);
  const resetFilter = useUiStore((s) => s.resetTaskFilter);
  const tagFilter = useUiStore((s) => s.taskFilter.tagId);
  // Filtr dotyczy jednego projektu - po wejściu do innego zaczynamy bez filtra
  useEffect(() => resetFilter(), [id, resetFilter]);

  const update = useUpdateProject();
  const remove = useDeleteProject();
  const duplicate = useDuplicateProject();
  const archive = useArchiveProject();
  const restore = useRestoreProject();
  const pushToast = useUiStore((s) => s.pushToast);
  const createList = useCreateChecklist(id);
  const reorderLists = useReorderChecklists(id);
  // Na szerokich ekranach listy układają się w siatkę albo w poziomy slider (wybór użytkownika), na telefonie jedna pod drugą
  const wide = useMediaQuery('(min-width: 640px)');
  const listView = useUiStore((s) => s.listView);
  const masonry = wide && listView === 'grid';
  const boardClass = masonry ? 'board board-masonry' : wide ? 'board board-slider' : 'board';
  // Siatka to kolumny: listy układają się jedna pod drugą (bez pustych luk), a liczba kolumn zależy od szerokości
  const [boardEl, setBoardEl] = useState<HTMLDivElement | null>(null);
  const columnCount = useColumnCount(boardEl, LIST_WIDTH, LIST_GAP);
  const listStrategy = !wide ? verticalListSortingStrategy : listView === 'grid' ? rectSortingStrategy : horizontalListSortingStrategy;

  if (project.isPending) return <p className="muted">{t('app.loading')}</p>;
  if (project.isError) {
    const notFound = (project.error as { status?: number }).status === 404;
    return (
      <div className="notice">
        <p>{notFound ? t('project.notFound') : t('project.loadError', { error: project.error.message })}</p>
        {!notFound && (
          <button type="button" className="btn" onClick={() => project.refetch()}>
            {t('app.retry')}
          </button>
        )}
        <Link to="/" className="btn">
          {t('app.backToProjects')}
        </Link>
      </div>
    );
  }

  const data = project.data;
  const displayName = projectName(data);
  const displayDescription = projectDescription(data);
  // Liczniki liczymy z listy zadań, dzięki czemu reagują od razu na optymistyczne zaznaczenie
  const total = data.checklists.reduce((n, c) => n + c.tasks.length, 0);
  const done = data.checklists.reduce((n, c) => n + c.tasks.filter((t) => t.completed).length, 0);
  // Tagi list tego projektu (do filtrowania), alfabetycznie
  const projectTags = [...new Map(data.checklists.flatMap((c) => c.tags).map((t) => [t.id, t])).values()].sort((a, b) =>
    a.name.localeCompare(b.name, locale()),
  );
  // Użytkownicy przypisani do jakiegokolwiek zadania w tym projekcie (do filtrowania), alfabetycznie
  const projectUsers = [...new Map(data.checklists.flatMap((c) => c.tasks.flatMap((t) => t.users)).map((u) => [u.id, u])).values()].sort((a, b) =>
    a.nick.localeCompare(b.nick, locale()),
  );
  // Filtr po tagu ukrywa listy, które go nie mają (filtry priorytetu i wykonanych działają na zadaniach w listach)
  const visibleChecklists = tagFilter ? data.checklists.filter((c) => c.tags.some((t) => t.id === tagFilter)) : data.checklists;

  return (
    <>
      <BackButton archived={!!data.archivedAt} />

      {data.archivedAt && (
        <div className="notice archived-banner" role="status">
          <p>{t('project.archivedBanner')}</p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={restore.isPending}
            onClick={() => restore.mutate(id, { onSuccess: () => pushToast(t('project.restoredToast', { name: displayName })) })}
          >
            {t('project.restore')}
          </button>
        </div>
      )}

      <div className={`project-head${data.archivedAt ? ' archived' : ''}`} data-color={data.color ?? undefined}>
        <div className="page-head">
          <div>
            <h1>{displayName}</h1>
            {displayDescription && <p className="muted">{displayDescription}</p>}
          </div>
          <button type="button" className="btn" onClick={() => setEditing(true)}>
            {t('project.edit')}
          </button>
        </div>

        <div className="project-progress">
          <ProgressBar done={done} total={total} />
          <span className="count">
            {t('project.progress', { done, total, percent: percent(done, total) })}
          </span>
        </div>
      </div>

      <div className="section-head toolbar">
        <h2 className="section-title">{t('project.lists')}</h2>
        <div className="toolbar-actions">
          {wide && <ListViewToggle />}
          <button type="button" className="btn" onClick={() => setManagingTags(true)}>
            {t('project.tags')}
          </button>
          {!data.isSystem && (
            <button type="button" className="btn btn-primary" onClick={() => setAddingList(true)}>
              {t('project.newList')}
            </button>
          )}
        </div>
      </div>

      {total > 0 && <TaskFilters tags={projectTags} users={projectUsers} />}

      {data.checklists.length === 0 && <p className="empty">{t('project.noLists')}</p>}
      {data.checklists.length > 0 && visibleChecklists.length === 0 && (
        <p className="empty">{t('project.noListWithTag')}</p>
      )}
      <SortableList
        ids={visibleChecklists.map((c) => c.id)}
        strategy={listStrategy}
        onReorder={reorderLists}
        renderOverlay={(listId) => {
          const list = visibleChecklists.find((c) => c.id === listId);
          return list ? <ChecklistGhost checklist={list} locked={data.isSystem} /> : null;
        }}
      >
        <div ref={setBoardEl} className={boardClass} style={{ '--list-width': `${LIST_WIDTH / 16}rem` } as CSSProperties}>
          {masonry
            ? splitIntoColumns(visibleChecklists, columnCount).map((column, i) => (
                <div key={i} className="board-col">
                  {column.map((c) => (
                    <ChecklistCard key={c.id} checklist={c} locked={data.isSystem} />
                  ))}
                </div>
              ))
            : visibleChecklists.map((c) => <ChecklistCard key={c.id} checklist={c} locked={data.isSystem} />)}
        </div>
      </SortableList>

      {managingTags && <TagManager onClose={() => setManagingTags(false)} />}

      {editing && (
        <Modal title={t('project.editTitle')} onClose={() => setEditing(false)}>
          <ProjectForm
            initial={data}
            locked={data.isSystem}
            submitLabel={t('common.save')}
            pending={update.isPending || remove.isPending || duplicate.isPending}
            onCancel={() => setEditing(false)}
            onSubmit={(input) => update.mutate({ id, ...input }, { onSuccess: () => setEditing(false) })}
            extraActions={
              data.isSystem ? undefined : (
                <button
                  type="button"
                  className="btn"
                  disabled={archive.isPending || restore.isPending}
                  title={data.archivedAt ? t('project.restoreFromArchive') : t('project.archiveHint')}
                  onClick={() => {
                    setEditing(false);
                    if (data.archivedAt) {
                      restore.mutate(id, { onSuccess: () => pushToast(t('project.restoredToast', { name: displayName })) });
                      return;
                    }
                    archive.mutate(id, {
                      onSuccess: () => {
                        navigate('/');
                        pushToast(t('project.archivedToast', { name: displayName }), { label: t('common.undo'), onClick: () => restore.mutate(id) });
                      },
                    });
                  }}
                >
                  {data.archivedAt ? t('common.restore') : t('project.archive')}
                </button>
              )
            }
            onDuplicate={data.isSystem ? undefined : () =>
              duplicate.mutate(id, {
                onSuccess: (copy) => {
                  setEditing(false);
                  navigate(`/project/${copy.id}`);
                  pushToast(t('project.copiedViewingToast', { name: displayName }));
                },
              })
            }
            onDelete={
              data.isSystem
                ? undefined
                : async () => {
                    const ok = await askConfirm({
                      title: t('project.deleteTitle'),
                      message: t('project.deleteMessage', { name: data.name, total }),
                      confirmLabel: t('project.deleteConfirm'),
                    });
                    if (ok) remove.mutate(id, { onSuccess: () => navigate('/', { replace: true }) });
                  }
            }
          />
        </Modal>
      )}

      {addingList && (
        <Modal title={t('project.newListTitle')} onClose={() => setAddingList(false)}>
          <ChecklistForm
            submitLabel={t('common.create')}
            pending={createList.isPending}
            onCancel={() => setAddingList(false)}
            onSubmit={(input) => createList.mutate(input, { onSuccess: () => setAddingList(false) })}
          />
        </Modal>
      )}
    </>
  );
}








