import { getLang, locale, t } from './i18n';

/** Formatery `Intl` liczone raz na język i zestaw opcji (zmiana języka daje nowe, a kolejne wywołania nie tworzą ich od nowa). */
const formatters = new Map<string, Intl.DateTimeFormat>();
export function dateFormatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${getLang()}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale(), options);
    formatters.set(key, formatter);
  }
  return formatter;
}

const dateOptions = { day: 'numeric', month: 'short', year: 'numeric' } as const;
const longDateOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } as const;
const shortDateOptions = { day: 'numeric', month: 'short' } as const;

/** '2026-06-15' -> '15 cze 2026' / '15 Jun 2026' (parsowane lokalnie, bez przesunięcia strefy czasowej) */
function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return dateFormatter(dateOptions).format(new Date(y, m - 1, d));
}

/** Pełna data z dniem tygodnia: '2026-09-28' -> 'pon., 28 wrz 2026' / 'Mon, 28 Sept 2026'. */
export function formatLongDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return dateFormatter(longDateOptions).format(new Date(y, m - 1, d));
}

/** Ile dni minęło od terminu do dziś (obie daty YYYY-MM-DD; odporne na zmianę czasu). */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number) as [number, number, number];
  const [y2, m2, d2] = to.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** '1 dzień po terminie', '12 dni po terminie' (po angielsku: '1 day overdue', '12 days overdue'). */
export const overdueLabel = (days: number): string => t('overdue.daysAfter', { n: days });

/** Data dodania z ISO (znacznika czasu) w lokalnej strefie: '5 paź 2026'. */
export function formatCreated(iso: string): string {
  return dateFormatter(dateOptions).format(new Date(iso));
}

/** Termin zadania: '2026-10-15' -> '15 paź' (rok tylko, gdy inny niż bieżący). */
export function formatDueDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return y === new Date().getFullYear() ? dateFormatter(shortDateOptions).format(new Date(y, m - 1, d)) : formatDate(date);
}

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

export function timeAgo(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const relative = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return relative.format(Math.round(diff / ms), unit);
  }
  return t('common.justNow');
}

export function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}
