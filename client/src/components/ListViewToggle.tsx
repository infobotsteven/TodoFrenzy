import { t } from '../i18n';
import { useUiStore, type ListView } from '../store';

/** Przełącznik układu list (siatka / slider). Na telefonie listy i tak układają się jedna pod drugą. */
export function ListViewToggle() {
  const view = useUiStore((s) => s.listView);
  const setView = useUiStore((s) => s.setListView);
  const options: { value: ListView; label: string; title: string }[] = [
    { value: 'grid', label: t('view.grid'), title: t('view.gridTitle') },
    { value: 'slider', label: t('view.slider'), title: t('view.sliderTitle') },
  ];
  return (
    <fieldset className="view-toggle" aria-label={t('view.label')}>
      {options.map((o) => (
        <label key={o.value} className="view-toggle-item" title={o.title}>
          <input type="radio" name="listView" checked={view === o.value} onChange={() => setView(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
