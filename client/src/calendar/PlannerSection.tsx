import { useState } from 'react';
import { t } from '../i18n';
import { todayIso } from '../labels';
import { useArchive, useOverdue, useUndated } from '../queries';
import { CalendarSection } from './CalendarSection';
import { TaskGridSection } from './TaskGridSection';

type Tab = 'calendar' | 'overdue' | 'undated' | 'archive';

/**
 * Dolna część strony głównej: zakładki „Kalendarz”, „Zaległe” (niewykonane po terminie), „Bez terminu” (niewykonane bez daty)
 * i „Archiwum” (wykonane).
 * Liczby zadań widać na zakładkach także wtedy, gdy aktywna jest inna.
 */
export function PlannerSection() {
  const [tab, setTab] = useState<Tab>('calendar');
  const overdueCount = useOverdue(todayIso()).data?.tasks.length ?? 0;
  const undatedCount = useUndated().data?.tasks.length ?? 0;
  const archiveCount = useArchive().data?.tasks.length ?? 0;

  const heading = (
    <div className="planner-tabs" role="tablist" aria-label={t('planner.view')}>
      <button type="button" role="tab" aria-selected={tab === 'calendar'} className="planner-tab" onClick={() => setTab('calendar')}>
        {t('planner.calendar')}
      </button>
      <button type="button" role="tab" aria-selected={tab === 'overdue'} className="planner-tab" onClick={() => setTab('overdue')}>
        {t('planner.overdue')}
        {overdueCount > 0 && <span className="planner-count">{overdueCount}</span>}
      </button>
      <button type="button" role="tab" aria-selected={tab === 'undated'} className="planner-tab" onClick={() => setTab('undated')}>
        {t('planner.undated')}
        {undatedCount > 0 && <span className="planner-count planner-count-muted">{undatedCount}</span>}
      </button>
      <button type="button" role="tab" aria-selected={tab === 'archive'} className="planner-tab" onClick={() => setTab('archive')}>
        {t('planner.archive')}
        {archiveCount > 0 && <span className="planner-count planner-count-muted">{archiveCount}</span>}
      </button>
    </div>
  );

  // key: każda zakładka-siatka startuje od czystego stanu (strona 1, brak otwartego okna)
  return tab === 'calendar' ? <CalendarSection heading={heading} /> : <TaskGridSection key={tab} variant={tab} heading={heading} />;
}
