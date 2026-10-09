import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProjectDetail, Task, TaskBulkInput, TaskInput, TaskPatch } from '@todo/shared';
import { api } from '../api';
import { projectKey, useInvalidate } from './shared';

export function useBulkCreateTasks(checklistId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (items: TaskBulkInput['items']) => api.post<Task[]>(`/checklists/${checklistId}/tasks/bulk`, { items }),
    onSuccess: invalidate,
  });
}

export function useCreateTask(checklistId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    // completed i position są opcjonalne - używa ich cofanie usunięcia (zadanie wraca na swoje miejsce)
    mutationFn: (input: TaskInput & { completed?: boolean; position?: number }) =>
      api.post<Task>(`/checklists/${checklistId}/tasks`, input),
    onSuccess: invalidate,
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...patch }: TaskPatch & { id: string }) => api.patch<Task>(`/tasks/${id}`, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: invalidate,
  });
}

/** Zaznaczenie zadania działa optymistycznie, żeby na telefonie reagowało od razu. */
export function useToggleTask(projectId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api.patch<Task>(`/tasks/${id}/completed`, { completed }),
    onMutate: async ({ id, completed }) => {
      await qc.cancelQueries({ queryKey: projectKey(projectId) });
      const previous = qc.getQueryData<ProjectDetail>(projectKey(projectId));
      if (previous) {
        qc.setQueryData<ProjectDetail>(projectKey(projectId), {
          ...previous,
          checklists: previous.checklists.map((c) => ({
            ...c,
            tasks: c.tasks.map((t) => (t.id === id ? { ...t, completed } : t)),
          })),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(projectKey(projectId), ctx.previous);
    },
    onSettled: invalidate,
  });
}
