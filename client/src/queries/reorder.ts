import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProjectDetail, ProjectSummary } from '@todo/shared';
import { api } from '../api';
import { projectKey, projectsKey, useInvalidate } from './shared';

// --- Zmiana kolejności (drag & drop) ---
// Kolejność zmieniamy w cache od razu (bez czekania na serwer), a przy błędzie przywracamy poprzedni stan.

/** Ta sama zasada co na serwerze: podane id zajmują kolejno miejsca, które zajmowały, reszta zostaje. */
function applyOrder<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const queue = ids.map((id) => byId.get(id)).filter((i): i is T => !!i);
  const moved = new Set(ids);
  let next = 0;
  return items.map((i) => (moved.has(i.id) ? queue[next++]! : i));
}

/**
 * Zmienia kolejność w cache SYNCHRONICZNIE (w obsłudze upuszczenia), dzięki czemu lista i biblioteka drag & drop
 * dostają nową kolejność w tym samym renderze - bez wskakiwania elementu na miejsce. Potem wysyła ją na serwer,
 * a przy błędzie przywraca poprzedni stan.
 */
function useOptimisticReorder<T>(key: readonly unknown[], path: string, update: (data: T, ids: string[]) => T) {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const mutation = useMutation({
    mutationFn: ({ ids }: { ids: string[]; previous?: T }) => api.patch<void>(path, { ids }),
    onError: (_err, { previous }) => {
      if (previous) qc.setQueryData(key, previous);
    },
    onSettled: invalidate,
  });

  return (ids: string[]) => {
    void qc.cancelQueries({ queryKey: key }); // trwające odświeżenie nie może nadpisać świeżej kolejności
    const previous = qc.getQueryData<T>(key);
    if (previous) qc.setQueryData(key, update(previous, ids));
    mutation.mutate({ ids, previous });
  };
}

export const useReorderProjects = () =>
  useOptimisticReorder<ProjectSummary[]>(projectsKey, '/projects/reorder', applyOrder);

export const useReorderChecklists = (projectId: string) =>
  useOptimisticReorder<ProjectDetail>(projectKey(projectId), '/checklists/reorder', (project, ids) => ({
    ...project,
    checklists: applyOrder(project.checklists, ids),
  }));

export const useReorderTasks = (projectId: string) =>
  useOptimisticReorder<ProjectDetail>(projectKey(projectId), '/tasks/reorder', (project, ids) => ({
    ...project,
    checklists: project.checklists.map((c) =>
      c.tasks.some((t) => ids.includes(t.id)) ? { ...c, tasks: applyOrder(c.tasks, ids) } : c,
    ),
  }));
