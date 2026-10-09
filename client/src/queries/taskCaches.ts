import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { ArchivedTasks, CalendarRange, CalendarSources, CalendarTask, OverdueTasks, UndatedTasks } from '@todo/shared';

// Aktualizacje optymistyczne zadań widocznych w kalendarzu i w zakładkach „Zaległe”, „Bez terminu” i „Archiwum”.
// Zmiana (termin, wykonanie) jest od razu widoczna we wszystkich zbuforowanych widokach, a przy błędzie zapisu wracamy do migawki.

export type CacheSnapshot = [QueryKey, unknown][];

type TaskList = { tasks: CalendarTask[] };

/** Wszystkie zbuforowane zakresy kalendarza (każdy tydzień/miesiąc, który już oglądaliśmy). */
const cachedRanges = (qc: QueryClient) =>
  qc.getQueriesData<CalendarRange | CalendarSources>({ queryKey: ['calendar'] }).filter(
    (entry): entry is [QueryKey, CalendarRange] => !!entry[1] && 'tasks' in entry[1],
  );

/**
 * Zmienia zadanie we wszystkich zbuforowanych zakresach kalendarza: zadanie wypada z zakresu, do którego już nie należy,
 * a po zmianie terminu może trafić do innego (dopisujemy je z zakresu, w którym było).
 */
function patchCalendarCache(qc: QueryClient, taskId: string, change: Partial<CalendarTask>) {
  for (const [key, range] of cachedRanges(qc)) {
    const current = range.tasks.find((t) => t.id === taskId);
    const source = current ?? cachedRanges(qc).flatMap(([, r]) => r.tasks).find((t) => t.id === taskId);
    if (!source) continue;
    const next = { ...source, ...change };
    const inRange = !!next.dueDate && next.dueDate >= range.from && next.dueDate <= range.to;
    // termin bez zmiany (np. zaznaczenie wykonania): zadanie zostaje na swoim miejscu w dniu, inaczej "skakałoby" na koniec
    if (current && inRange && current.dueDate === next.dueDate) {
      qc.setQueryData<CalendarRange>(key, { ...range, tasks: range.tasks.map((t) => (t.id === taskId ? next : t)) });
      continue;
    }
    const others = range.tasks.filter((t) => t.id !== taskId);
    const tasks = inRange ? [...others, next].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')) : others;
    qc.setQueryData<CalendarRange>(key, { ...range, tasks });
  }
}

/** Zbuforowane odpowiedzi widoku-listy (zaległe/bez terminu/archiwum): `rootKey` to pierwszy element klucza zapytania. */
const cachedLists = <T extends TaskList>(qc: QueryClient, rootKey: string) =>
  qc.getQueriesData<T>({ queryKey: [rootKey] }).filter((entry): entry is [QueryKey, T] => !!entry[1]);

/** Zmienia zadanie w widoku-liście; `stays` mówi, czy po zmianie zadanie nadal tu należy (jeśli nie, znika z listy). */
function patchListCache<T extends TaskList>(
  qc: QueryClient,
  rootKey: string,
  taskId: string,
  change: Partial<CalendarTask>,
  stays: (task: CalendarTask, data: T) => boolean,
) {
  for (const [key, data] of cachedLists<T>(qc, rootKey)) {
    const current = data.tasks.find((t) => t.id === taskId);
    if (!current) continue;
    const next = { ...current, ...change };
    const tasks = stays(next, data) ? data.tasks.map((t) => (t.id === taskId ? next : t)) : data.tasks.filter((t) => t.id !== taskId);
    qc.setQueryData<T>(key, { ...data, tasks });
  }
}

/** Stan wszystkich zbuforowanych widoków zadań - do przywrócenia przy błędzie zapisu. */
export const snapshotTaskCaches = (qc: QueryClient): CacheSnapshot => [
  ...cachedRanges(qc),
  ...cachedLists(qc, 'overdue'),
  ...cachedLists(qc, 'undated'),
  ...cachedLists(qc, 'archive'),
];

export const restoreTaskCaches = (qc: QueryClient, snapshot: CacheSnapshot) => {
  for (const [key, data] of snapshot) qc.setQueryData(key, data);
};

/**
 * Zastosowanie zmiany zadania we wszystkich widokach:
 * - zaległe: wykonane albo z terminem dziś i później znika;
 * - bez terminu: ustawiony termin albo wykonanie je zdejmuje;
 * - archiwum: przywrócenie (niewykonane) zdejmuje je, chyba że to zadanie zarchiwizowanego projektu.
 */
export function patchTaskCaches(qc: QueryClient, taskId: string, change: Partial<CalendarTask>) {
  patchCalendarCache(qc, taskId, change);
  patchListCache<OverdueTasks>(qc, 'overdue', taskId, change, (t, data) => !t.completed && !!t.dueDate && t.dueDate < data.before);
  patchListCache<UndatedTasks>(qc, 'undated', taskId, change, (t) => !t.completed && !t.dueDate);
  patchListCache<ArchivedTasks>(qc, 'archive', taskId, change, (t) => t.completed || !!t.projectArchivedAt);
}
