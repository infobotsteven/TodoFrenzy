import { useDroppable } from '@dnd-kit/core';
import type { CalendarTask } from '@todo/shared';
import { t } from '../i18n';
import { CalendarTaskCard } from './CalendarTaskCard';
import { formatMonthShort, formatWeekday, fromIso } from './dates';

type Props = {
  date: string;
  today: string;
  tasks: CalendarTask[];
  /** Pokazuje nazwę miesiąca (pierwszy dzień tygodnia i 1. dzień miesiąca). */
  showMonth: boolean;
  onEdit: (task: CalendarTask) => void;
  onToggle: (task: CalendarTask, completed: boolean) => void;
  /** Dodanie zadania na ten dzień. */
  onAdd: (date: string) => void;
};

/** Jeden dzień tygodnia: nagłówek, zadania z tym terminem i miejsce, na które można upuścić zadanie. */
export function DayColumn({ date, today, tasks, showMonth, onEdit, onToggle, onAdd }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date}` });
  const isToday = date === today;
  const classes = ['cal-day', isToday ? 'today' : '', date < today ? 'past' : '', isOver ? 'over' : ''].filter(Boolean).join(' ');

  return (
    <section ref={setNodeRef} className={classes} aria-label={`${formatWeekday(date)} ${fromIso(date).getDate()} ${formatMonthShort(date)}`}>
      <header className="cal-day-head">
        <span className="cal-weekday">{formatWeekday(date)}</span>
        <span className="cal-daynum">{fromIso(date).getDate()}</span>
        {showMonth && <span className="cal-month">{formatMonthShort(date)}</span>}
        {isToday && <span className="cal-today-badge">{t('day.today')}</span>}
        <span className="cal-count" title={t('day.count')}>
          {tasks.length || ''}
        </span>
        <button
          type="button"
          className="cal-add"
          aria-label={t('day.addAria', { date: `${formatWeekday(date)} ${fromIso(date).getDate()} ${formatMonthShort(date)}` })}
          title={t('day.add')}
          onClick={() => onAdd(date)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
      </header>
      <div className="cal-day-tasks">
        {tasks.map((task) => (
          <CalendarTaskCard
            key={task.id}
            task={task}
            today={today}
            onEdit={() => onEdit(task)}
            onToggle={(completed) => onToggle(task, completed)}
          />
        ))}
        {tasks.length === 0 && <p className="cal-empty">{t('day.empty')}</p>}
      </div>
    </section>
  );
}
