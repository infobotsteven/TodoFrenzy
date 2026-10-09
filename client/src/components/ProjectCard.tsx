import type { ProjectSummary } from '@todo/shared';
import { Link } from 'react-router';
import { timeAgo } from '../format';
import { t } from '../i18n';
import { projectDescription, projectName } from '../labels';
import { ProgressBar } from './ProgressBar';

/** Treść karty projektu: tytuł, opis, postęp i czas ostatniej zmiany. */
function ProjectCardContent({ project: p }: { project: ProjectSummary }) {
  const description = projectDescription(p);
  return (
    <>
      <h2 className="card-title">{projectName(p)}</h2>
      {description && <p className="muted clamp">{description}</p>}
      <div className="project-progress">
        <ProgressBar done={p.completedCount} total={p.taskCount} />
        <span className="count">
          {p.completedCount} / {p.taskCount}
        </span>
      </div>
      <p className={`muted small${p.archivedAt ? ' archive-icon' : ''}`}>
        {p.archivedAt ? t('project.archivedAgo', { when: timeAgo(p.archivedAt) }) : t('project.updatedAgo', { when: timeAgo(p.updatedAt) })}
      </p>
    </>
  );
}

/** Karta projektu jako link do projektu; tło i obwódka w kolorze projektu (`data-color`), a stały projekt „Inne” ma dodatkowo klasę `fixed`. */
export function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <Link
      to={`/project/${project.id}`}
      className={`card project-card${project.isSystem ? ' fixed' : ''}${project.archivedAt ? ' archived' : ''}`}
      data-color={project.color ?? undefined}
    >
      <ProjectCardContent project={project} />
    </Link>
  );
}

/** Kopia karty „w ręku” podczas przeciągania (bez linku). */
export function ProjectCardGhost({ project }: { project: ProjectSummary }) {
  return (
    <div className="project-item">
      <div className="card project-card overlay" data-color={project.color ?? undefined}>
        <ProjectCardContent project={project} />
      </div>
    </div>
  );
}
