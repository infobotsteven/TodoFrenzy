import { LANGS, setLang, t, useLang, type Lang } from '../i18n';

/** Nazwy języków we własnych językach (nie tłumaczy się ich), z kodem, żeby lista była czytelna także po zmianie języka. */
const NAMES: Record<Lang, string> = { pl: 'PL · Polski', en: 'EN · English' };

/** Lista wyboru języka interfejsu (obok przełącznika motywu). */
export function LanguageSelect() {
  const lang = useLang();
  return (
    <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={t('lang.label')} title={t('lang.label')}>
      {LANGS.map((l) => (
        <option key={l} value={l}>
          {NAMES[l]}
        </option>
      ))}
    </select>
  );
}
