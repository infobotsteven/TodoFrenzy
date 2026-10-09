import type { ProjectSummary } from '@todo/shared';
import { Link } from 'react-router';
import { ProgressBar } from '../components/ProgressBar';
import { percent } from '../format';
import { t } from '../i18n';

type Totals = { projects: number; tasks: number; done: number };

/** Liczba projektów i zadań (wszystkich oraz ukończonych) w podanych projektach. */
function totalsOf(list: ProjectSummary[]): Totals {
  return {
    projects: list.length,
    tasks: list.reduce((sum, p) => sum + p.taskCount, 0),
    done: list.reduce((sum, p) => sum + p.completedCount, 0),
  };
}

/** Jeden kafel: liczba projektów, pasek postępu zadań i podpis „ukończono X z Y zadań”. Kafel jest linkiem do swojej zakładki. */
function ProjectTile({ kind, totals, to }: { kind: 'active' | 'archived'; totals: Totals | null; to: string }) {
  const archived = kind === 'archived';
  const value = totals ? percent(totals.done, totals.tasks) : 0;
  return (
    <Link to={to} className={archived ? 'stat-metric archived' : 'stat-metric'}>
      <span className={archived ? 'stat-label archive-icon' : 'stat-label'}>
        {!archived && <span className="stat-dot" aria-hidden="true" />}
        {archived ? t('stats.projectsArchived') : t('stats.projectsActive')}
      </span>
      <span className="stat-number">{totals ? totals.projects : '–'}</span>
      {totals && (
        <>
          <ProgressBar done={totals.done} total={totals.tasks} />
          <span className="stat-tasks">
            <span>{totals.tasks === 0 ? t('stats.projectNoTasks') : t('stats.projectTasks', { done: totals.done, total: totals.tasks, n: totals.tasks })}</span>
            {totals.tasks > 0 && <strong>{value}%</strong>}
          </span>
        </>
      )}
    </Link>
  );
}

/**
 * Pudełko „Projekty”: aktywne i zarchiwizowane projekty użytkownika (bez stałego „Inne”) z postępem ich zadań.
 * Zarchiwizowane mają wygląd archiwum (kreskowanie, przerywana obwódka), żeby od razu było je widać.
 */
export function ProjectTiles({ projects }: { projects: ProjectSummary[] | undefined }) {
  const mine = projects?.filter((p) => !p.isSystem);
  return (
    <div className="stat-pair">
      <ProjectTile kind="active" totals={mine ? totalsOf(mine.filter((p) => !p.archivedAt)) : null} to="/" />
      <ProjectTile kind="archived" totals={mine ? totalsOf(mine.filter((p) => p.archivedAt)) : null} to="/?widok=archiwum" />
    </div>
  );
}
