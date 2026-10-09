import { COLORS, type Color } from '@todo/shared';
import { t } from '../i18n';

type Props = { value: Color | null; onChange: (color: Color | null) => void };

/** Wybór koloru: rząd kółek (radio) + "brak koloru". Działa też z klawiatury (strzałki). */
export function ColorPicker({ value, onChange }: Props) {
  return (
    <fieldset className="color-picker" aria-label={t('color.label')}>
      <label className="swatch none" title={t('color.none')}>
        <input type="radio" name="color" checked={value === null} onChange={() => onChange(null)} aria-label={t('color.none')} />
        ∅
      </label>
      {COLORS.map((color) => (
        <label key={color} className="swatch" data-color={color} title={t(`color.${color}`)}>
          <input type="radio" name="color" checked={value === color} onChange={() => onChange(color)} aria-label={t(`color.${color}`)} />
        </label>
      ))}
    </fieldset>
  );
}
