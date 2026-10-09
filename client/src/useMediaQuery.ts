import { useSyncExternalStore } from 'react';

/** Czy zapytanie CSS (np. '(min-width: 640px)') jest aktualnie spełnione; odświeża się przy zmianie rozmiaru okna. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notify);
      return () => mql.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
  );
}
