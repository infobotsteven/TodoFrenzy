import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User, UserInput, UserPatch } from '@todo/shared';
import { api } from '../api';

const usersKey = ['users'] as const;

export const useUsers = () =>
  useQuery({ queryKey: usersKey, queryFn: () => api.get<User[]>('/users'), staleTime: 30_000 });

/** Zmiana użytkownika (nick, awatar, usunięcie) widoczna jest na zadaniach i w kalendarzu. */
function useInvalidateUsers() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: usersKey }),
      qc.invalidateQueries({ queryKey: ['project'] }),
      qc.invalidateQueries({ queryKey: ['calendar'] }),
      qc.invalidateQueries({ queryKey: ['overdue'] }),
      qc.invalidateQueries({ queryKey: ['undated'] }),
      qc.invalidateQueries({ queryKey: ['archive'] }),
    ]);
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (input: UserInput) => api.post<User>('/users', input),
    onSuccess: invalidate,
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, ...patch }: UserPatch & { id: string }) => api.patch<User>(`/users/${id}`, patch),
    onSettled: invalidate,
  });
}

export function useDeleteUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: invalidate,
  });
}
