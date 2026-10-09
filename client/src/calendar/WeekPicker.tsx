import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { useCalendar } from '../queries';
import { addDays, formatMonthYear, formatWeekRange, formatWeekday, fromIso, monthGrid, startOfWeek } from './dates';

type Props = {
  weekStart: string;
  today: string;
  onPick: (weekStart: string) => void;
};

/**
 * Szybki wybór tygodnia: przycisk z zakresem dat otwiera miniaturę miesiąca. Kliknięcie dowolnego dnia
 * przenosi do jego tygodnia. Kropki oznaczają dni, w których są zadania z terminem.
 */
export function WeekPicker({ weekStart, today, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // miesiąc pokazywany w miniaturze (domyślnie ten, w którym leży środek wybranego tygodnia)
  const initial = fromIso(addDays(weekStart, 3));
  const [view, setView] = useState({ year: initial.getFullYear(), month: initial.getMonth() });

  const days = monthGrid(view.year, view.month);
  const gridFrom = days[0]!;
  const gridTo = days[41]!;
  const tasks = useCalendar(gridFrom, gridTo, open);
  const counts = new Map<string, number>();
  for (const t of tasks.data?.tasks ?? []) if (t.dueDate && !t.completed) counts.set(t.dueDate, (counts.get(t.dueDate) ?? 0) + 1);

  // zamknięcie: klik poza panelem albo Esc
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openPicker = () => {
    const d = fromIso(addDays(weekStart, 3));
    setView({ year: d.getFullYear(), month: d.getMonth() });
    setOpen((v) => !v);
  };
  const shiftMonth = (delta: number) => {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };
  const pick = (iso: string) => {
    onPick(startOfWeek(iso));
    setOpen(false);
  };
  const selectedWeek = weekStart;
  const headerDays = days.slice(0, 7);

  return (
    <div className="week-picker" ref={rootRef}>
      <button
        type="button"
        className="btn week-picker-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPicker}
        title={t('week.pick')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        <span>{formatWeekRange(weekStart)}</span>
      </button>

      {open && (
        <div className="week-picker-panel" role="dialog" aria-label={t('week.dialog')}>
          <div className="wp-head">
            <button type="button" className="icon-btn" aria-label={t('week.prevMonth')} onClick={() => shiftMonth(-1)}>
              ‹
            </button>
            <strong className="wp-title">{formatMonthYear(view.year, view.month)}</strong>
            <button type="button" className="icon-btn" aria-label={t('week.nextMonth')} onClick={() => shiftMonth(1)}>
              ›
            </button>
          </div>
          <div className="wp-grid" role="grid">
            <div className="wp-row wp-weekdays" role="row">
              {headerDays.map((d) => (
                <span key={d} className="wp-weekday" role="columnheader">
                  {formatWeekday(d)}
                </span>
              ))}
            </div>
            {Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7)).map((week) => (
              <div key={week[0]} className={week[0] === selectedWeek ? 'wp-row selected' : 'wp-row'} role="row">
                {week.map((iso) => {
                  const d = fromIso(iso);
                  const count = counts.get(iso) ?? 0;
                  const cls = ['wp-day', d.getMonth() !== view.month ? 'out' : '', iso === today ? 'today' : ''].filter(Boolean).join(' ');
                  return (
                    <button
                      key={iso}
                      type="button"
                      role="gridcell"
                      className={cls}
                      onClick={() => pick(iso)}
                      aria-label={`${d.getDate()} ${formatMonthYear(d.getFullYear(), d.getMonth())}${count ? t('week.tasksCount', { n: count }) : ''}`}
                    >
                      {d.getDate()}
                      {count > 0 && <span className="wp-dot" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="wp-foot">
            <button type="button" className="btn" onClick={() => pick(today)}>
              {t('week.thisWeek')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
