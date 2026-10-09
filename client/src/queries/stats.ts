import { useQuery } from '@tanstack/react-query';
import type { CompletionStats } from '@todo/shared';
import { api } from '../api';
import { addDays, fromIso } from '../calendar/dates';

/**
 * Chwile wykonania zadań w zakresie dni (włącznie; YYYY-MM-DD w strefie przeglądarki). Granice dni liczymy tutaj, bo serwer
 * nie zna strefy użytkownika - wysyłamy zakres jako chwile [początek pierwszego dnia, początek dnia po ostatnim).
 */
export const useCompletions = (fromDay: string, toDay: string) =>
  useQuery({
    queryKey: ['stats', fromDay, toDay],
    queryFn: () => {
      const from = fromIso(fromDay).toISOString();
      const to = fromIso(addDays(toDay, 1)).toISOString();
      return api.get<CompletionStats>(`/stats/completions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    },
  });
