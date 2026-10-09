import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import type { CalendarTask } from '@todo/shared';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { todayIso } from '../labels';
import { calendarKey, useCalendar, useCalendarSources, useSetDueDate, useToggleCalendarTask } from '../queries';
import { useUiStore } from '../store';
import { api } from '../api';
import { CalendarFilters } from './CalendarFilters';
import { CalendarTaskGhost } from './CalendarTaskCard';
import { CalendarAddTaskModal } from './CalendarAddTaskModal';
import { CalendarTaskModal } from './CalendarTaskModal';
import { DayColumn } from './DayColumn';
import { useFilteredTasks } from './filtering';
import { addDays, formatMonthShort, startOfWeek, weekDays } from './dates';
import { WeekPicker } from './WeekPicker';

// Upuszczenie liczy się tam, gdzie jest kursor; gdy kursor jest w odstępie między dniami - najbliższy dzień
const collisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  return underPointer.length > 0 ? underPointer : closestCenter(args);
};

/** Kalendarz tygodniowy (7 dni) z zadaniami, które mają termin. `heading` to tytuł sekcji (przełącznik zakładek). */
export function CalendarSection({ heading }: { heading: ReactNode }) {
  const qc = useQueryClient();
  const today = todayIso();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const weekEnd = addDays(weekStart, 6);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);

  const calendar = useCalendar(weekStart, weekEnd);
  const sources = useCalendarSources();
  const setDueDate = useSetDueDate();
  const toggle = useToggleCalendarTask();
  const [editing, setEditing] = useState<CalendarTask | null>(null);
  const [dragged, setDragged] = useState<CalendarTask | null>(null);
  /** Dzień, na który dodajemy zadanie (okno dodawania jest otwarte, gdy ustawiony). */
  const [adding, setAdding] = useState<string | null>(null);

  // Sąsiednie tygodnie ładujemy z wyprzedzeniem, żeby przełączanie było natychmiastowe
  useEffect(() => {
    for (const start of [addDays(weekStart, -7), addDays(weekStart, 7)]) {
      qc.prefetchQuery({
        queryKey: calendarKey(start, addDays(start, 6)),
        queryFn: () => api.get(`/calendar?from=${start}&to=${addDays(start, 6)}`),
      });
    }
  }, [qc, weekStart]);

  const weekTasks = calendar.data?.from === weekStart ? calendar.data.tasks : [];
  const tasks = useFilteredTasks('calendar', weekTasks, sources.data);
  const hideCompleted = useUiStore((s) => s.calendarHideCompleted);
  const setHideCompleted = useUiStore((s) => s.setCalendarHideCompleted);
  // „Ukryj ukończone” zdejmuje z dni tylko wykonane zadania; podsumowanie tygodnia nadal liczy wszystkie zadania po filtrach
  const shown = useMemo(() => (hideCompleted ? tasks.filter((task) => !task.completed) : tasks), [tasks, hideCompleted]);
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>(days.map((d) => [d, []]));
    for (const task of shown) if (task.dueDate) map.get(task.dueDate)?.push(task);
    return map;
  }, [shown, days]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const onDragStart = ({ active }: DragStartEvent) => setDragged(shown.find((t) => t.id === active.id) ?? null);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragged(null);
    const task = shown.find((t) => t.id === active.id);
    const target = typeof over?.id === 'string' && over.id.startsWith('day:') ? over.id.slice(4) : null;
    if (task && target && target !== task.dueDate) setDueDate(task, target);
  };

  const total = tasks.length;
  const open = tasks.filter((t) => !t.completed).length;

  return (
    <section className="calendar" aria-label={t('calendar.label')}>
      <div className="section-head">
        <div>
          {heading}
          <p className="muted small">
            {calendar.isPending ? t('app.loading') : total === 0 ? t('calendar.noTasks') : t('calendar.summary', { open, total, n: total })}
          </p>
        </div>
        <div className="calendar-nav">
          <button type="button" className="btn btn-primary" onClick={() => setAdding(days.includes(today) ? today : weekStart)}>
            {t('calendar.addTask')}
          </button>
          <button type="button" className="icon-btn" aria-label={t('calendar.prevWeek')} onClick={() => setWeekStart(addDays(weekStart, -7))}>
            ‹
          </button>
          <WeekPicker weekStart={weekStart} today={today} onPick={setWeekStart} />
          <button type="button" className="icon-btn" aria-label={t('calendar.nextWeek')} onClick={() => setWeekStart(addDays(weekStart, 7))}>
            ›
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setWeekStart(startOfWeek(today))}
            disabled={weekStart === startOfWeek(today)}
          >
            {t('calendar.today')}
          </button>
        </div>
      </div>

      <CalendarFilters
        scope="calendar"
        className="cal-filters"
        sources={sources.data}
        toolbar={
          <label className="check-inline">
            <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} />
            {t('calendar.hideCompleted')}
          </label>
        }
      />

      {calendar.isError && (
        <div className="notice">
          <p>{t('calendar.loadError', { error: calendar.error.message })}</p>
          <button type="button" className="btn" onClick={() => calendar.refetch()}>
            {t('app.retry')}
          </button>
        </div>
      )}

      {hideCompleted && tasks.length > 0 && shown.length === 0 && <p className="muted small">{t('calendar.allHidden')}</p>}

      <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragged(null)}>
        <div className="week-grid">
          {days.map((date, i) => (
            <DayColumn
              key={date}
              date={date}
              today={today}
              tasks={byDay.get(date) ?? []}
              showMonth={i === 0 || formatMonthShort(date) !== formatMonthShort(days[i - 1]!)}
              onEdit={setEditing}
              onToggle={toggle}
              onAdd={setAdding}
            />
          ))}
        </div>
        <DragOverlay>{dragged ? <CalendarTaskGhost task={dragged} today={today} /> : null}</DragOverlay>
      </DndContext>

      {editing && <CalendarTaskModal task={editing} onClose={() => setEditing(null)} />}
      {adding && <CalendarAddTaskModal date={adding} onClose={() => setAdding(null)} />}
    </section>
  );
}




