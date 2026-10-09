import { t } from '../i18n';
import { useUiStore } from '../store';

/** Suwak jasny / ciemny motyw. */
export function ThemeSwitch() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={t('theme.dark')}
      title={dark ? t('theme.toLight') : t('theme.toDark')}
      className="theme-switch"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      <span className="ts-knob">{dark ? '☾' : '☀'}</span>
    </button>
  );
}
