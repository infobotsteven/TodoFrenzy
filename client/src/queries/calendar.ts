import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ArchivedTasks, CalendarRange, CalendarSources, CalendarTask, OverdueTasks, Task, UndatedTasks } from '@todo/shared';
import { api } from '../api';
import { useInvalidate } from './shared';
import { patchTaskCaches, restoreTaskCaches, snapshotTaskCaches, type CacheSnapshot } from './taskCaches';

// --- Zapytania o zadania w widokach strony głównej ---

export const calendarKey = (from: string, to: string) => ['calendar', from, to] as const;

/** Zadania z terminem w zakresie dat (włącznie), wraz z projektem i listą. */
export const useCalendar = (from: string, to: string, enabled = true) =>
  useQuery({
    queryKey: calendarKey(from, to),
    queryFn: () => api.get<CalendarRange>(`/calendar?from=${from}&to=${to}`),
    enabled,
  });

export const useCalendarSources = () =>
  useQuery({ queryKey: ['calendar', 'sources'], queryFn: () => api.get<CalendarSources>('/calendar/sources') });

/** Zaległe: niewykonane zadania z terminem wcześniejszym niż `today` (dzisiejsza data klienta). */
export const useOverdue = (today: string) =>
  useQuery({
    queryKey: ['overdue', today],
    queryFn: () => api.get<OverdueTasks>(`/overdue?before=${today}`),
  });

/** Bez terminu: niewykonane zadania, które nie mają daty. */
export const useUndated = () => useQuery({ queryKey: ['undated'], queryFn: () => api.get<UndatedTasks>('/undated') });

/** Archiwum: wykonane zadania i wszystkie zadania zarchiwizowanych projektów. */
export const useArchive = () => useQuery({ queryKey: ['archive'], queryFn: () => api.get<ArchivedTasks>('/archive') });

// --- Zmiany zadań z kalendarza i zakładek-siatek ---

/**
 * Zmiana zadania zapisywana na serwerze, ale widoczna od razu we wszystkich widokach (kalendarz, zaległe, bez terminu, archiwum);
 * przy błędzie wszystko wraca do poprzedniego stanu, a po zapisie dane odświeżają się z serwera.
 */
function useOptimisticTaskChange<C extends Partial<CalendarTask>>(request: (id: string, change: C) => Promise<Task>) {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const mutation = useMutation({
    mutationFn: ({ id, change }: { id: string; change: C; snapshot: CacheSnapshot }) => request(id, change),
    onError: (_err, { snapshot }) => restoreTaskCaches(qc, snapshot),
    onSettled: invalidate,
  });
  return (task: CalendarTask, change: C) => {
    const snapshot = snapshotTaskCaches(qc);
    patchTaskCaches(qc, task.id, change);
    mutation.mutate({ id: task.id, change, snapshot });
  };
}

/** Zmiana terminu zadania z kalendarza (okno albo przeciągnięcie na inny dzień) lub z zakładek-siatek. */
export function useSetDueDate() {
  const apply = useOptimisticTaskChange<{ dueDate: string | null }>((id, change) => api.patch<Task>(`/tasks/${id}`, change));
  return (task: CalendarTask, dueDate: string | null) => apply(task, { dueDate });
}

/** Zaznaczenie zadania jako wykonane (albo przywrócenie) poza widokiem projektu. */
export function useToggleCalendarTask() {
  const apply = useOptimisticTaskChange<{ completed: boolean }>((id, change) => api.patch<Task>(`/tasks/${id}/completed`, change));
  return (task: CalendarTask, completed: boolean) => apply(task, { completed });
}
