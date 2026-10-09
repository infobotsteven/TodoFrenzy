import { verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useState } from 'react';
import type { Checklist, Task } from '@todo/shared';
import {
  useCreateTask,
  useDeleteChecklist,
  useDeleteTask,
  useDuplicateChecklist,
  useReorderTasks,
  useToggleTask,
  useUpdateChecklist,
  useUpdateTask,
} from '../queries';
import { t } from '../i18n';
import { listName } from '../labels';
import { isFilterActive, matchesUserFilter, useUiStore } from '../store';
import { SortableItem, SortableList } from './dnd';
import { ChecklistForm, TaskForm } from './forms';
import { Modal } from './Modal';
import { AddTask } from './AddTask';
import { TaskGhost, TaskRow } from './TaskRow';
import { TagChip } from './TaskMeta';
import { askConfirm } from '../confirm';

type Props = {
  checklist: Checklist;
  /** Lista stałego projektu „Inne”: nie można jej usunąć ani skopiować. */
  locked?: boolean;
};

/** Statyczna kopia całej listy - wygląd listy "w ręku" podczas przeciągania. */
export function ChecklistGhost({ checklist, locked = false }: Props) {
  const done = checklist.tasks.filter((t) => t.completed).length;
  return (
    <section className="card checklist overlay" data-color={checklist.color ?? undefined}>
      <header className="checklist-head">
        <span className="drag-handle">⋮⋮</span>
        <h3 className="card-title">{listName(checklist.name, locked)}</h3>
        <span className="count">
          {done} / {checklist.tasks.length}
        </span>
      </header>
      {checklist.tags.length > 0 && (
        <div className="list-tags">
          {checklist.tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
        </div>
      )}
      <ul className="tasks">
        {checklist.tasks.map((task) => (
          <li key={task.id} className={task.completed ? 'task done' : 'task'}>
            <input type="checkbox" className="task-check" checked={task.completed} readOnly tabIndex={-1} />
            <span className="task-name">{task.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ChecklistCard({ checklist, locked = false }: Props) {
  const [editingList, setEditingList] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const toggle = useToggleTask(checklist.projectId);
  const reorderTasks = useReorderTasks(checklist.projectId);
  const updateList = useUpdateChecklist();
  const deleteList = useDeleteChecklist();
  const duplicateList = useDuplicateChecklist();
  const pushToast = useUiStore((s) => s.pushToast);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const restoreTask = useCreateTask(checklist.id);

  const filter = useUiStore((s) => s.taskFilter);
  const filtering = isFilterActive(filter);
  // Filtr tylko ukrywa zadania. Liczniki liczą wszystkie, a zmiana kolejności działa na widocznych (reszta zostaje na miejscu).
  const visibleTasks = checklist.tasks.filter(
    (t) =>
      (!filter.hideCompleted || !t.completed) &&
      (!filter.priority || t.priority === filter.priority) &&
      matchesUserFilter(t.users, filter.userIds),
  );

  const done = checklist.tasks.filter((t) => t.completed).length;

  /** Usuwa od razu, bez potwierdzenia - pomyłkę naprawia "Cofnij", które odtwarza zadanie na tym samym miejscu. */
  const removeTask = (task: Task) => {
    const position = checklist.tasks.findIndex((t) => t.id === task.id);
    deleteTask.mutate(task.id, {
      onSuccess: () =>
        pushToast(t('task.removedToast', { name: task.name }), {
          label: t('common.undo'),
          onClick: () =>
            restoreTask.mutate({
              name: task.name,
              description: task.description,
              priority: task.priority,
              dueDate: task.dueDate,
              userIds: task.users.map((u) => u.id),
              completed: task.completed,
              position,
            }),
        }),
    });
  };

  return (
    <>
      <SortableItem as="section" id={checklist.id} className="card checklist" color={checklist.color}>
        {(listHandle) => (
          <>
            <header className="checklist-head">
              {listHandle}
              <h3 className="card-title">{listName(checklist.name, locked)}</h3>
              <span className="count">
                {done} / {checklist.tasks.length}
              </span>
              <button type="button" className="icon-btn" aria-label={t('checklist.edit')} onClick={() => setEditingList(true)}>
                ⋯
              </button>
            </header>
            {checklist.description && <p className="muted small">{checklist.description}</p>}
            {checklist.tags.length > 0 && (
              <div className="list-tags" aria-label={t('form.listTags')}>
                {checklist.tags.map((tag) => (
                  <TagChip key={tag.id} tag={tag} />
                ))}
              </div>
            )}

            <SortableList
              ids={visibleTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
              onReorder={reorderTasks}
              renderOverlay={(id) => {
                const task = checklist.tasks.find((t) => t.id === id);
                return task ? <TaskGhost task={task} /> : null;
              }}
            >
              <ul className="tasks">
                {visibleTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={(completed) => toggle.mutate({ id: task.id, completed })}
                    onEdit={() => setEditingTask(task)}
                    onRemove={() => removeTask(task)}
                  />
                ))}
              </ul>
            </SortableList>

            {filtering && visibleTasks.length === 0 && checklist.tasks.length > 0 && (
              <p className="muted small">{t('checklist.allHidden')}</p>
            )}

            <AddTask checklistId={checklist.id} />
          </>
        )}
      </SortableItem>

      {editingList && (
        <Modal title={t('checklist.edit')} onClose={() => setEditingList(false)}>
          <ChecklistForm
            initial={{ ...checklist, tagIds: checklist.tags.map((t) => t.id) }}
            submitLabel={t('common.save')}
            pending={updateList.isPending || deleteList.isPending || duplicateList.isPending}
            onCancel={() => setEditingList(false)}
            onSubmit={(input) => updateList.mutate({ id: checklist.id, ...input }, { onSuccess: () => setEditingList(false) })}
            onDuplicate={locked ? undefined : () =>
              duplicateList.mutate(checklist.id, {
                onSuccess: () => {
                  setEditingList(false);
                  pushToast(t('checklist.copiedToast', { name: listName(checklist.name, locked) }));
                },
              })
            }
            onDelete={
              locked
                ? undefined
                : async () => {
                    const n = checklist.tasks.length;
                    const ok = await askConfirm({
                      title: t('checklist.deleteTitle'),
                      message: n ? t('checklist.deleteMessageTasks', { name: checklist.name, n }) : t('checklist.deleteMessage', { name: checklist.name }),
                      confirmLabel: t('checklist.deleteConfirm'),
                    });
                    if (ok) deleteList.mutate(checklist.id);
                  }
            }
          />
        </Modal>
      )}

      {editingTask && (
        <Modal title={t('task.editTitle')} onClose={() => setEditingTask(null)}>
          <TaskForm
            initial={{ ...editingTask, userIds: editingTask.users.map((u) => u.id) }}
            submitLabel={t('common.save')}
            pending={updateTask.isPending || deleteTask.isPending}
            onCancel={() => setEditingTask(null)}
            onSubmit={({ name, description, priority, dueDate, userIds }) =>
              updateTask.mutate(
                { id: editingTask.id, name, description, priority, dueDate, userIds },
                { onSuccess: () => setEditingTask(null) },
              )
            }
            onDelete={async () => {
              const ok = await askConfirm({
                title: t('task.deleteTitle'),
                message: t('task.deleteMessage', { name: editingTask.name }),
                confirmLabel: t('task.deleteConfirm'),
              });
              if (ok) deleteTask.mutate(editingTask.id, { onSuccess: () => setEditingTask(null) });
            }}
          />
        </Modal>
      )}
    </>
  );
}
