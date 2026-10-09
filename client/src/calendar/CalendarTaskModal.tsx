import { SYSTEM_COLOR, type CalendarTask } from '@todo/shared';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Modal } from '../components/Modal';
import { UserStack } from '../components/UserAvatar';
import { formatDueDate } from '../format';
import { t } from '../i18n';
import { calendarProjectName, listName, todayIso } from '../labels';
import { useSetDueDate } from '../queries';
import { addDays } from './dates';

/** Zmiana terminu zadania z poziomu kalendarza. Usunięcie terminu zdejmuje zadanie z kalendarza (zostaje w liście). */
export function CalendarTaskModal({ task, onClose }: { task: CalendarTask; onClose: () => void }) {
  const [date, setDate] = useState(task.dueDate ?? '');
  const setDueDate = useSetDueDate();

  const save = (e: FormEvent) => {
    e.preventDefault();
    const next = date || null;
    if (next !== task.dueDate) setDueDate(task, next);
    onClose();
  };

  return (
    <Modal title={task.dueDate ? t('taskModal.title') : t('taskModal.setDue')} onClose={onClose}>
      <form onSubmit={save} className="form">
        <div>
          <strong className="cal-modal-name">{task.name}</strong>
          <p className="muted small cal-modal-origin">
            <Link to={`/project/${task.projectId}`}>
              <span className="dot" data-color={task.projectColor ?? undefined} />
              {calendarProjectName(task.projectName, task.projectColor)}
            </Link>
            {' › '}
            <span>
              <span className="dot" data-color={task.checklistColor ?? undefined} />
              {listName(task.checklistName, task.projectColor === SYSTEM_COLOR)}
            </span>
          </p>
          {task.users.length > 0 && (
            <p className="small cal-modal-users">
              <UserStack users={task.users} size={24} /> {task.users.map((u) => u.nick).join(', ')}
            </p>
          )}
          {task.dueDate && <p className="muted small">{t('taskModal.current', { date: formatDueDate(task.dueDate), iso: task.dueDate })}</p>}
        </div>

        <div className="field">
          <span>{t('taskModal.quick')}</span>
          <div className="quick-dates">
            {[
              [t('calendar.today'), 0],
              [t('taskModal.tomorrow'), 1],
              [t('taskModal.nextWeek'), 7],
            ].map(([label, days]) => (
              <button
                key={label}
                type="button"
                className="btn"
                onClick={() => {
                  setDueDate(task, addDays(todayIso(), days as number));
                  onClose();
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>{t('taskModal.newDue')}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} autoFocus aria-label={t('taskModal.dueAria')} />
        </label>

        <div className="form-actions">
          <div className="form-actions-left">
            {task.dueDate && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setDueDate(task, null);
                onClose();
              }}
              title={t('taskModal.removeDueHint')}
            >
              {t('taskModal.removeDue')}
            </button>
            )}
          </div>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!date}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

