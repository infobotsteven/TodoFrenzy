import { useState, type CSSProperties } from 'react';
import { formatMonthYear, formatWeekday, fromIso, monthGrid } from '../calendar/dates';
import { dateFormatter } from '../format';
import { t } from '../i18n';
import { useCompletionsByDay } from './counts';

/** Ile nazw zadań pokazujemy na kafelku dnia i w podpowiedzi. Kafelek ma najwyżej 3 linie: numer dnia z liczbą, potem dwie linie z nazwami albo z nazwą i „+N więcej”. */
const CARD_LINES = 2;
const NAMES_IN_TITLE = 12;

/** Poziom koloru kafelka 0-4: 0 = brak, a pozostałe dzielą zakres do najlepszego dnia miesiąca. */
const levelOf = (count: number, max: number) => (count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4)));

/**
 * Mapa aktywności jak na GitHubie: kolumny to tygodnie, wiersze to dni tygodnia (od poniedziałku), a kolor kafelka zależy od liczby
 * ukończonych tego dnia. Kafelki wypełniają całą dostępną przestrzeń i pokazują numer dnia, liczbę ukończonych oraz nazwy
 * pierwszych zadań (na telefonie bez nazw). Domyślnie bieżący miesiąc, strzałkami można przechodzić do innych.
 */
export function ActivityHeatmap({ today }: { today: string }) {
  const now = fromIso(today);
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });

  // tygodnie, w których jest choć jeden dzień miesiąca (siatka miesiąca ma zawsze 6 tygodni)
  const grid = monthGrid(view.year, view.month);
  const inMonth = (iso: string) => fromIso(iso).getMonth() === view.month;
  const weeks = Array.from({ length: 6 }, (_, w) => grid.slice(w * 7, w * 7 + 7)).filter((week) => week.some(inMonth));
  const days = grid.filter(inMonth);
  const { byDay, counts, total, isError, error } = useCompletionsByDay(days[0]!, days[days.length - 1]!);
  const max = Math.max(1, ...days.map((d) => counts.get(d) ?? 0));
  const isCurrent = view.year === now.getFullYear() && view.month === now.getMonth();

  const shift = (delta: number) => {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };
  const dayFormat = dateFormatter({ day: 'numeric', month: 'short' });

  return (
    <div className="heatmap">
      <div className="heatmap-head">
        <button type="button" className="icon-btn" aria-label={t('stats.prevMonth')} onClick={() => shift(-1)}>
          ‹
        </button>
        <strong className="heatmap-title">{formatMonthYear(view.year, view.month)}</strong>
        <button type="button" className="icon-btn" aria-label={t('stats.nextMonth')} onClick={() => shift(1)}>
          ›
        </button>
        <button type="button" className="btn btn-sm" disabled={isCurrent} onClick={() => setView({ year: now.getFullYear(), month: now.getMonth() })}>
          {t('stats.thisMonth')}
        </button>
        <span className="heatmap-total muted small">{t('stats.tasksDone', { n: total })}</span>
      </div>

      {isError && <p className="form-error">{t('stats.loadError', { error: error?.message ?? '' })}</p>}

      <div className="heat-grid" role="group" aria-label={t('stats.heatAria')} style={{ '--weeks': weeks.length } as CSSProperties}>
        {/* kolumna etykiet dni tygodnia, potem kolumna na tydzień (siatka układa kafelki kolumnami) */}
        {weeks[0]!.map((d) => (
          <span key={d} className="heat-weekday" aria-hidden="true">
            {formatWeekday(d)}
          </span>
        ))}
        {weeks.flatMap((week) =>
          week.map((day) => {
            if (!inMonth(day)) return <span key={day} className="heat-cell blank" aria-hidden="true" />;
            const list = byDay.get(day) ?? [];
            const count = list.length;
            const date = dayFormat.format(fromIso(day));
            const summary = t('stats.heatDay', { date, tasks: t('stats.tasksDone', { n: count }) });
            const names = list.slice(0, NAMES_IN_TITLE).map((task) => `• ${task.name}`);
            const title = [summary, ...names, ...(count > NAMES_IN_TITLE ? [t('stats.moreTasks', { n: count - NAMES_IN_TITLE })] : [])].join('\n');
            return (
              <div key={day} role="img" className={day === today ? 'heat-cell today' : 'heat-cell'} data-level={levelOf(count, max)} aria-label={summary} title={title}>
                <span className="heat-top">
                  <span className="heat-day">{fromIso(day).getDate()}</span>
                  {count > 0 && <span className="heat-count">{count}</span>}
                </span>
                {count > 0 && (
                  <span className="heat-tasks">
                    {list.slice(0, count > CARD_LINES ? CARD_LINES - 1 : CARD_LINES).map((task) => (
                      <span key={task.id} className="heat-task">
                        {task.name}
                      </span>
                    ))}
                    {count > CARD_LINES && <span className="heat-more">{t('stats.moreTasks', { n: count - (CARD_LINES - 1) })}</span>}
                  </span>
                )}
              </div>
            );
          }),
        )}
      </div>

      <div className="heat-legend" aria-hidden="true">
        <span>{t('stats.legendLess')}</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} className="heat-cell legend" data-level={level} />
        ))}
        <span>{t('stats.legendMore')}</span>
      </div>
    </div>
  );
}
