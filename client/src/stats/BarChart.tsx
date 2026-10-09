import { formatWeekday, fromIso } from '../calendar/dates';
import { formatLongDate } from '../format';
import { t } from '../i18n';

/**
 * Wykres słupkowy liczby ukończonych zadań w kolejnych dniach tygodnia (`days`). Wysokość słupka jest względem najlepszego dnia
 * tygodnia; nad słupkami są liczby, pod nimi dzień tygodnia i numer, a każdy słupek ma podpowiedź z datą i liczbą.
 * Dni po dzisiejszym (przyszłość) są puste i przygaszone.
 */
export function BarChart({ days, counts, today }: { days: string[]; counts: Map<string, number>; today: string }) {
  const values = days.map((d) => counts.get(d) ?? 0);
  const max = Math.max(1, ...values);
  const total = values.reduce((sum, n) => sum + n, 0);

  return (
    <div className="bar-chart" role="img" aria-label={t('stats.chartAria', { total })}>
      {days.map((day, i) => {
        const value = values[i]!;
        const cls = ['bar-col', day === today ? 'today' : '', day > today ? 'future' : ''].filter(Boolean).join(' ');
        return (
          <div key={day} className={cls} title={`${formatLongDate(day)}: ${t('stats.tasksDone', { n: value })}`}>
            <span className="bar-value">{value > 0 ? value : ''}</span>
            <div className="bar-track">
              <div className={value > 0 ? 'bar' : 'bar zero'} style={{ height: `${(value / max) * 100}%` }} />
            </div>
            <span className="bar-label">
              <span>{formatWeekday(day)}</span>
              <span>{fromIso(day).getDate()}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
