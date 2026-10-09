import { t } from '../i18n';
import { useUiStore } from '../store';

/** Pasek widoczny tylko przy utracie połączenia - aplikacja nadal działa, ale zmiany innych nie dochodzą na żywo. */
export function ConnectionBanner() {
  const connection = useUiStore((s) => s.connection);
  if (connection !== 'closed') return null;
  return (
    <div className="banner" role="status">
      {t('app.offline')}
    </div>
  );
}
