import { SYSTEM_COLOR, type CalendarTask } from '@todo/shared';
import { PriorityBadge } from '../components/TaskMeta';
import { UserStack } from '../components/UserAvatar';
import { daysBetween, formatCreated, formatDueDate, formatLongDate, overdueLabel } from '../format';
import { t } from '../i18n';
import { TaskOrigin } from './CalendarTaskCard';

/** Widoki-siatki kart na stronie głównej: „Zaległe” (termin minął), „Bez terminu” (brak daty) i „Archiwum” (wykonane). */
export type GridVariant = 'overdue' | 'undated' | 'archive';

/** Stopka karty: co jest ważne w danym widoku (termin, brak terminu, data wykonania) i główna akcja. */
function CardFooter({
  task,
  today,
  variant,
  onChangeDate,
  onRestore,
}: {
  task: CalendarTask;
  today: string;
  variant: GridVariant;
  onChangeDate: () => void;
  onRestore: () => void;
}) {
  if (variant === 'archive' && task.projectArchivedAt) {
    return (
      <div className="overdue-due">
        <div className="overdue-when">
          <span className="overdue-label archive-icon">{t('grid.projectArchived')}</span>
          <span className="overdue-date">{formatCreated(task.projectArchivedAt)}</span>
          <span className="overdue-ago">
            {task.completed ? t('grid.wasDone') : task.dueDate ? t('task.dueOn', { date: formatDueDate(task.dueDate) }) : t('grid.noDue')}
          </span>
        </div>
        <button type="button" className="btn btn-sm" onClick={onRestore} title={t('grid.restoreProjectHint')}>
          {t('project.restore')}
        </button>
      </div>
    );
  }
  if (variant === 'archive') {
    return (
      <div className="overdue-due">
        <div className="overdue-when">
          <span className="overdue-label">{t('grid.done')}</span>
          <span className="overdue-date">{formatCreated(task.updatedAt)}</span>
          <span className="overdue-ago">{task.dueDate ? t('grid.dueWas', { date: formatDueDate(task.dueDate) }) : t('grid.noDue')}</span>
        </div>
        <button type="button" className="btn btn-sm" onClick={onRestore} title={t('grid.restoreTaskHint')}>
          {t('common.restore')}
        </button>
      </div>
    );
  }
  return (
    <div className="overdue-due">
      <div className="overdue-when">
        <span className="overdue-label">{t('grid.due')}</span>
        {variant === 'overdue' ? (
          <>
            <span className="overdue-date">{task.dueDate ? formatLongDate(task.dueDate) : '-'}</span>
            <span className="overdue-ago">{overdueLabel(task.dueDate ? daysBetween(task.dueDate, today) : 0)}</span>
          </>
        ) : (
          <>
            <span className="overdue-date">{t('grid.noDueLabel')}</span>
            <span className="overdue-ago">{t('grid.added', { date: formatCreated(task.createdAt) })}</span>
          </>
        )}
      </div>
      <button type="button" className="btn btn-sm" onClick={onChangeDate}>
        {variant === 'overdue' ? t('grid.changeDue') : t('taskModal.setDue')}
      </button>
    </div>
  );
}

/** Karta zadania: nazwa, projekt i lista, priorytet, osoby oraz stopka zależna od widoku. */
export function TaskGridCard({
  task,
  today,
  variant,
  onChangeDate,
  onToggle,
}: {
  task: CalendarTask;
  today: string;
  variant: GridVariant;
  onChangeDate: () => void;
  onToggle: (completed: boolean) => void;
}) {
  const fixed = task.projectColor === SYSTEM_COLOR;
  const archive = variant === 'archive';
  const inArchivedProject = archive && !!task.projectArchivedAt;
  const modifier = variant === 'overdue' ? '' : ` ${variant}-card`;
  return (
    <article
      className={`cal-task overdue-card${modifier}${archive && task.completed && !inArchivedProject ? ' done' : ''}${inArchivedProject ? ' archived-project' : ''}${fixed ? ' fixed' : ''}`}
      data-color={task.projectColor ?? undefined}
    >
      <input
        type="checkbox"
        className="cal-check"
        checked={task.completed}
        disabled={inArchivedProject}
        title={inArchivedProject ? t('grid.archivedTaskHint') : undefined}
        aria-label={archive ? t('grid.restoreAria', { name: task.name }) : t('task.doneAria', { name: task.name })}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <div className="cal-task-body">
        {archive ? (
          <span className="cal-task-name">{task.name}</span>
        ) : (
          <button type="button" className="cal-task-name" onClick={onChangeDate} title={variant === 'overdue' ? t('grid.changeDue') : t('taskModal.setDue')}>
            {task.name}
          </button>
        )}
        {task.description && <p className="overdue-desc muted small">{task.description}</p>}
        <TaskOrigin task={task} />
        {(task.priority !== 'none' || task.users.length > 0) && (
          <span className="task-meta">
            <PriorityBadge priority={task.priority} />
            <UserStack users={task.users} size={20} />
          </span>
        )}
        <CardFooter task={task} today={today} variant={variant} onChangeDate={onChangeDate} onRestore={() => onToggle(false)} />
      </div>
    </article>
  );
}
