import { useDraggable } from '@dnd-kit/core';
import { SYSTEM_COLOR, type CalendarTask } from '@todo/shared';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { PriorityBadge } from '../components/TaskMeta';
import { UserStack } from '../components/UserAvatar';
import { t } from '../i18n';
import { calendarProjectName, listName } from '../labels';

/** Projekt i lista, do których należy zadanie (projekt jest linkiem). */
export function TaskOrigin({ task }: { task: CalendarTask }) {
  return (
    <span className="cal-origin">
      <Link to={`/project/${task.projectId}`} className="cal-origin-project" title={t('task.projectTitle', { name: calendarProjectName(task.projectName, task.projectColor) })}>
        <span className="dot" data-color={task.projectColor ?? undefined} />
        {calendarProjectName(task.projectName, task.projectColor)}
      </Link>
      <span className="cal-origin-sep" aria-hidden="true">
        ›
      </span>
      <span className="cal-origin-list" title={t('task.listTitle', { name: listName(task.checklistName, task.projectColor === SYSTEM_COLOR) })}>
        <span className="dot" data-color={task.checklistColor ?? undefined} />
        {listName(task.checklistName, task.projectColor === SYSTEM_COLOR)}
      </span>
    </span>
  );
}

type ViewProps = {
  task: CalendarTask;
  /** Dzisiejsza data (YYYY-MM-DD) - do oznaczania zadań po terminie. */
  today: string;
  onEdit?: () => void;
  onToggle?: (completed: boolean) => void;
  /** Uchwyt przeciągania (w warstwie "w ręku" jest tylko atrapą). */
  handle: ReactNode;
};

/** Wygląd zadania w kalendarzu: nazwa, priorytet oraz projekt i lista, do których należy. */
function CalendarTaskView({ task, today, onEdit, onToggle, handle }: ViewProps) {
  const overdue = !task.completed && !!task.dueDate && task.dueDate < today;
  // zadania stałego projektu „Inne” wyglądają jak jego karta (kolor projektu, plakietka)
  const fixed = task.projectColor === SYSTEM_COLOR;
  return (
    <div
      className={`cal-task${fixed ? ' fixed' : ''}${task.completed ? ' done' : ''}${overdue ? ' overdue' : ''}${task.projectArchivedAt ? ' archived-project' : ''}`}
      data-color={task.projectColor ?? undefined}
    >
      <input
        type="checkbox"
        className="cal-check"
        checked={task.completed}
        aria-label={t('task.doneAria', { name: task.name })}
        onChange={(e) => onToggle?.(e.target.checked)}
        tabIndex={onToggle ? 0 : -1}
      />
      <div className="cal-task-body">
        <button type="button" className="cal-task-name" onClick={onEdit} title={t('grid.changeDue')}>
          {task.name}
        </button>
        <TaskOrigin task={task} />
        {(task.priority !== 'none' || task.users.length > 0) && (
          <span className="task-meta">
            <PriorityBadge priority={task.priority} />
            <UserStack users={task.users} size={20} />
          </span>
        )}
      </div>
      {handle}
    </div>
  );
}

/** Zadanie w kolumnie dnia - można je przeciągnąć na inny dzień (uchwyt) albo kliknąć nazwę, żeby zmienić termin. */
export function CalendarTaskCard(props: Omit<ViewProps, 'handle'>) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: props.task.id });
  return (
    <div ref={setNodeRef} className={isDragging ? 'cal-drag-source' : undefined}>
      <CalendarTaskView
        {...props}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="drag-handle"
            aria-label={t('task.dragToDay')}
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
        }
      />
    </div>
  );
}

/** Kopia zadania "w ręku" podczas przeciągania. */
export function CalendarTaskGhost({ task, today }: { task: CalendarTask; today: string }) {
  return (
    <div className="cal-ghost">
      <CalendarTaskView task={task} today={today} handle={<span className="drag-handle">⋮⋮</span>} />
    </div>
  );
}

