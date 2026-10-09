// Pomocnicze funkcje dat kalendarza. Wszystko na datach lokalnych w formacie YYYY-MM-DD (bez godzin i stref czasowych),
// tak samo jak terminy zadań w bazie. Tydzień zaczyna się w poniedziałek.

import { dateFormatter } from '../format';

const pad = (n: number) => String(n).padStart(2, '0');

const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

/** Poniedziałek tygodnia, w którym jest podana data. */
export function startOfWeek(iso: string): string {
  const dayOfWeek = (fromIso(iso).getDay() + 6) % 7; // 0 = poniedziałek
  return addDays(iso, -dayOfWeek);
}

export const weekDays = (weekStart: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

/** 6 tygodni (42 dni) wyświetlanych w siatce miesiąca; zaczyna się od poniedziałku tygodnia z 1. dniem miesiąca. */
export function monthGrid(year: number, month: number): string[] {
  const first = toIso(new Date(year, month, 1));
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export const formatWeekday = (iso: string) => dateFormatter({ weekday: 'short' }).format(fromIso(iso)).replace('.', '');
export const formatMonthShort = (iso: string) => dateFormatter({ month: 'short' }).format(fromIso(iso)).replace('.', '');
export const formatMonthYear = (year: number, month: number) => dateFormatter({ month: 'long', year: 'numeric' }).format(new Date(year, month, 1));

/** "5 – 11 paź 2026", a przy przełomie miesięcy/lat: "28 wrz – 4 paź 2026" / "28 gru 2026 – 3 sty 2027". */
export function formatWeekRange(weekStart: string): string {
  const a = fromIso(weekStart);
  const b = fromIso(addDays(weekStart, 6));
  const aText = `${a.getDate()} ${formatMonthShort(weekStart)}`;
  const bText = `${b.getDate()} ${formatMonthShort(toIso(b))}`;
  if (a.getFullYear() !== b.getFullYear()) return `${aText} ${a.getFullYear()} – ${bText} ${b.getFullYear()}`;
  if (a.getMonth() !== b.getMonth()) return `${aText} – ${bText} ${b.getFullYear()}`;
  return `${a.getDate()} – ${bText} ${b.getFullYear()}`;
}
