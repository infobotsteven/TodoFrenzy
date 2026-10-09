import type { CompletedTask } from '@todo/shared';
import { useCompletions } from '../queries';

const pad = (n: number) => String(n).padStart(2, '0');

/** Dzień (YYYY-MM-DD) w lokalnej strefie przeglądarki dla chwili z serwera. */
const dayOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Wykonane zadania pogrupowane po dniach (dni bez wykonanych nie występują w mapie; w dniu od najwcześniejszego). */
function groupByDay(tasks: CompletedTask[]): Map<string, CompletedTask[]> {
  const byDay = new Map<string, CompletedTask[]>();
  for (const task of tasks) {
    const day = dayOf(task.completedAt);
    byDay.set(day, [...(byDay.get(day) ?? []), task]);
  }
  return byDay;
}

/** Wykonane zadania w zakresie dni (włącznie) pogrupowane po dniach, z liczbą i stanem zapytania. */
export function useCompletionsByDay(fromDay: string, toDay: string) {
  const query = useCompletions(fromDay, toDay);
  const tasks = query.data?.tasks ?? [];
  const byDay = groupByDay(tasks);
  const counts = new Map([...byDay].map(([day, list]) => [day, list.length] as const));
  return { byDay, counts, total: tasks.length, isPending: query.isPending, isError: query.isError, error: query.error };
}
