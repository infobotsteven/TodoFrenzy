import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tag } from '@todo/shared';
import { api } from '../api';

const tagsKey = ['tags'] as const;

export const useTags = () =>
  useQuery({ queryKey: tagsKey, queryFn: () => api.get<Tag[]>('/tags'), staleTime: 30_000 });

/** Zmiana tagu widoczna jest na zadaniach we wszystkich projektach, więc odświeżamy też projekty. */
function useInvalidateTags() {
  const qc = useQueryClient();
  return () =>
    Promise.all([qc.invalidateQueries({ queryKey: tagsKey }), qc.invalidateQueries({ queryKey: ['project'] })]);
}

/** Zwraca istniejący tag o tej nazwie (bez względu na wielkość liter) albo tworzy nowy. */
export function useCreateTag() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: (name: string) => api.post<Tag>('/tags', { name }),
    onSuccess: invalidate,
  });
}

export function useRenameTag() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.patch<Tag>(`/tags/${id}`, { name }),
    onSettled: invalidate,
  });
}

export function useDeleteTag() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tags/${id}`),
    onSuccess: invalidate,
  });
}
