import { Link } from 'react-router';
import { t } from '../i18n';

/** Duży przycisk powrotu - leży nad tytułem projektu. Projekt z archiwum wraca do zakładki „Archiwum”, pozostałe do listy projektów. */
export function BackButton({ archived = false }: { archived?: boolean }) {
  return (
    <Link to={archived ? '/?widok=archiwum' : '/'} className="back-btn" aria-label={archived ? t('back.toArchive') : t('back.toProjects')}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {archived ? t('back.archive') : t('back.projects')}
    </Link>
  );
}
