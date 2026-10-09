import { MutationCache, notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useUiStore } from './store';
import './styles/index.css';

// Domyślnie TanStack Query powiadamia komponenty o zmianie cache'u dopiero w kolejnym zadaniu (setTimeout 0).
// Przy drag & drop to oznacza, że React najpierw renderuje koniec przeciągania ze STARĄ kolejnością, a nową
// dopiero chwilę później - element przeskakuje. Powiadamiamy od razu, żeby oba stany trafiły do jednego renderu.
notifyManager.setScheduler((callback) => callback());

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5_000 } },
  // Każdy nieudany zapis pokazuje komunikat - użytkownik nie traci informacji o błędzie
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (!mutation.meta?.silent) useUiStore.getState().pushToast(error.message); // meta.silent: błąd pokazuje sam formularz (np. logowanie)
    },
  }),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
