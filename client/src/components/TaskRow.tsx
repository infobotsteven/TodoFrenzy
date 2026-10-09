import type { Task } from '@todo/shared';
import { t } from '../i18n';
import { SortableItem } from './dnd';
import { DueDate, PriorityBadge } from './TaskMeta';
import { UserStack } from './UserAvatar';

/** Statyczna kopia zadania - wygląd elementu "w ręku" podczas przeciągania. */
export function TaskGhost({ task }: { task: Task }) {
  return (
    <div className={task.completed ? 'task done overlay' : 'task overlay'}>
      <input type="checkbox" className="task-check" checked={task.completed} readOnly tabIndex={-1} />
      <span className="task-name">{task.name}</span>
      <span className="drag-handle">⋮⋮</span>
    </div>
  );
}

/** Wiersz zadania na liście: pole wyboru, nazwa z metadanymi (klik = edycja), usuwanie jednym kliknięciem i uchwyt przeciągania. */
export function TaskRow({
  task,
  onToggle,
  onEdit,
  onRemove,
}: {
  task: Task;
  onToggle: (completed: boolean) => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
        <SortableItem key={task.id} as="li" id={task.id} className={task.completed ? 'task done' : 'task'}>
          {(taskHandle) => (
            <>
              <input
                type="checkbox"
                className="task-check"
                checked={task.completed}
                aria-label={t('task.doneAria', { name: task.name })}
                onChange={(e) => onToggle(e.target.checked)}
              />
              <button type="button" className="task-name" onClick={onEdit}>
                {task.name}
                {task.description && <span className="task-desc">{task.description}</span>}
                {(task.priority !== 'none' || task.dueDate || task.users.length > 0) && (
                  <span className="task-meta">
                    <PriorityBadge priority={task.priority} />
                    {task.dueDate && <DueDate date={task.dueDate} completed={task.completed} />}
                    <UserStack users={task.users} />
                  </span>
                )}
              </button>
              <button
                type="button"
                className="icon-btn task-delete"
                aria-label={t('task.deleteAria', { name: task.name })}
                title={t('task.delete')}
                onClick={onRemove}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </button>
              {taskHandle}
            </>
          )}
        </SortableItem>
  );
}
