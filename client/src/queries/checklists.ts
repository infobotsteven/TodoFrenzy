import { useMutation } from '@tanstack/react-query';
import type { Checklist, ChecklistInput, ChecklistPatch } from '@todo/shared';
import { api } from '../api';
import { useInvalidate } from './shared';

export function useDuplicateChecklist() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.post<Checklist>(`/checklists/${id}/duplicate`, undefined),
    onSuccess: invalidate,
  });
}

export function useCreateChecklist(projectId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: ChecklistInput) => api.post<Checklist>(`/projects/${projectId}/checklists`, input),
    onSuccess: invalidate,
  });
}

export function useUpdateChecklist() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...patch }: ChecklistPatch & { id: string }) =>
      api.patch<Checklist>(`/checklists/${id}`, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteChecklist() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/checklists/${id}`),
    onSuccess: invalidate,
  });
}
