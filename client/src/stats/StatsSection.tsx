import { useState, type ReactNode } from 'react';
import { addDays, formatWeekRange, startOfWeek, weekDays } from '../calendar/dates';
import { formatLongDate } from '../format';
import { locale, t } from '../i18n';
import { todayIso } from '../labels';
import { useProjects } from '../queries';
import { ActivityHeatmap } from './ActivityHeatmap';
import { BarChart } from './BarChart';
import { ProjectTiles } from './ProjectTiles';
import { useCompletionsByDay } from './counts';

/** Dozwolone zakresy sumy (liczba ostatnich dni); domyślnie tydzień. */
const SUM_RANGES = [7, 14, 30, 90];
const DEFAULT_RANGE = 7;

/** Lista wyboru zakresu „ostatnie N dni”. */
function RangeSelect({ value, options, onChange }: { value: number; options: number[]; onChange: (days: number) => void }) {
  return (
    <select className="stats-range" value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={t('stats.rangeAria')}>
      {options.map((n) => (
        <option key={n} value={n}>
          {t('stats.lastDays', { n })}
        </option>
      ))}
    </select>
  );
}

/** Pudełko statystyki: tytuł z opcjonalnym elementem sterującym po prawej i treść. `area` wyznacza miejsce w siatce (CSS). */
function StatCard({ title, action, area, children }: { title: string; action?: ReactNode; area: 'today' | 'sum' | 'chart' | 'projects' | 'heat'; children: ReactNode }) {
  return (
    <section className={`card stat-card stat-${area}`}>
      <header className="stat-head">
        <h2 className="card-title">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Zakładka „Statystyki”: ukończone dziś, suma z ostatnich dni, wykres tygodnia (z przesuwaniem tygodni) i mapa aktywności miesiąca. */
export function StatsSection() {
  const today = todayIso();
  const [sumDays, setSumDays] = useState(DEFAULT_RANGE);
  const thisWeek = startOfWeek(today);
  const [weekStart, setWeekStart] = useState(thisWeek);

  const todayStats = useCompletionsByDay(today, today);
  const sum = useCompletionsByDay(addDays(today, 1 - sumDays), today);
  const week = useCompletionsByDay(weekStart, addDays(weekStart, 6));
  const projects = useProjects();
  const average = (sum.total / sumDays).toLocaleString(locale(), { maximumFractionDigits: 1 });

  const weekNav = (
    <div className="week-nav">
      <button type="button" className="icon-btn" aria-label={t('stats.prevWeek')} onClick={() => setWeekStart(addDays(weekStart, -7))}>
        ‹
      </button>
      <strong className="week-nav-range">{formatWeekRange(weekStart)}</strong>
      <button type="button" className="icon-btn" aria-label={t('stats.nextWeek')} onClick={() => setWeekStart(addDays(weekStart, 7))}>
        ›
      </button>
      <button type="button" className="btn btn-sm" disabled={weekStart === thisWeek} onClick={() => setWeekStart(thisWeek)}>
        {t('stats.thisWeek')}
      </button>
    </div>
  );

  return (
    <section className="stats" aria-label={t('stats.label')}>
      <div className="stats-grid">
        <StatCard title={t('stats.todayTitle')} area="today">
          <p className="stat-number" aria-live="polite">
            {todayStats.isPending ? '–' : todayStats.total}
          </p>
          <p className="muted small">{formatLongDate(today)}</p>
        </StatCard>

        <StatCard title={t('stats.sumTitle')} action={<RangeSelect value={sumDays} options={SUM_RANGES} onChange={setSumDays} />} area="sum">
          <p className="stat-number" aria-live="polite">
            {sum.isPending ? '–' : sum.total}
          </p>
          <p className="muted small">{t('stats.average', { avg: average })}</p>
        </StatCard>

        <StatCard title={t('stats.projectsTitle')} area="projects">
          <ProjectTiles projects={projects.data} />
          <p className="muted small">{t('stats.projectsNote')}</p>
        </StatCard>

        <StatCard title={t('stats.chartTitle')} action={weekNav} area="chart">
          {week.isError ? (
            <p className="form-error">{t('stats.loadError', { error: week.error?.message ?? '' })}</p>
          ) : (
            <BarChart days={weekDays(weekStart)} counts={week.counts} today={today} />
          )}
        </StatCard>

        <StatCard title={t('stats.heatTitle')} area="heat">
          <ActivityHeatmap today={today} />
        </StatCard>
      </div>
    </section>
  );
}
