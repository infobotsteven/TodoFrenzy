import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { LoginInput } from '@todo/shared';
import { api } from '../api';

/** Zalogowany użytkownik albo `null`, gdy nie ma ważnej sesji. */
export type Me = { user: string } | null;

const meKey = ['auth', 'me'] as const;

/** Czy mamy ważną sesję: 401 oznacza „niezalogowany” (`null`), nie błąd. */
/**
 * Zmiana stanu logowania (zalogowanie, wylogowanie, wygasła sesja): usuwa z pamięci dane wszystkich zapytań (poza stanem logowania), żeby nic
 * z poprzedniej sesji nie zostało na ekranie, i ustawia aktualnego użytkownika. Nie używamy `qc.clear()` - odłączyłoby aktywne zapytanie o sesję.
 */
export function setSession(qc: QueryClient, me: Me) {
  qc.removeQueries({ predicate: (query) => query.queryKey[0] !== meKey[0] });
  qc.setQueryData<Me>(meKey, me);
}

export const useMe = () =>
  useQuery({
    queryKey: meKey,
    queryFn: async (): Promise<Me> => {
      try {
        return await api.get<{ user: string }>('/auth/me');
      } catch (error) {
        if ((error as { status?: number }).status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: Infinity,
  });

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<{ user: string }>('/auth/login', input),
    meta: { silent: true }, // błąd pokazuje formularz logowania
    onSuccess: (me) => setSession(qc, me),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout', undefined),
    meta: { silent: true },
    onSettled: () => setSession(qc, null),
  });
}
