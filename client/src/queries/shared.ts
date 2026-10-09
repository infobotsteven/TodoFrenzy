import { useQueryClient } from '@tanstack/react-query';

// Klucze zapytań TanStack Query używane w wielu miejscach (reszta jest przy swoich hookach).
export const projectsKey = ['projects'] as const;
export const projectKey = (id: string) => ['project', id] as const;

/** Po każdej zmianie odświeżamy listę projektów (liczniki), otwarte projekty i kalendarz. */
export function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: projectsKey }),
      qc.invalidateQueries({ queryKey: ['project'] }),
      qc.invalidateQueries({ queryKey: ['calendar'] }),
      qc.invalidateQueries({ queryKey: ['overdue'] }),
      qc.invalidateQueries({ queryKey: ['undated'] }),
      qc.invalidateQueries({ queryKey: ['archive'] }),
      qc.invalidateQueries({ queryKey: ['stats'] }),
    ]);
}
