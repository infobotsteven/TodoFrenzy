import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { RealtimeEvent } from '@todo/shared';
import { clientId } from './api';
import { projectKey, projectsKey } from './queries';
import { useUiStore } from './store';

/**
 * Zmiana zrobiona przez kogoś innego = odświeżenie dotkniętych zapytań. Zawsze odświeżamy listę projektów
 * (liczniki i "Zaktualizowano"), a szczegóły projektu tylko tego, którego zdarzenie dotyczy.
 */
function applyEvent(qc: QueryClient, event: RealtimeEvent) {
  if (event.origin === clientId) return; // własne zmiany odświeżają się po zapisie

  qc.invalidateQueries({ queryKey: projectsKey });
  qc.invalidateQueries({ queryKey: ['calendar'] }); // terminy, stan i przynależność zadań mogły się zmienić
  qc.invalidateQueries({ queryKey: ['overdue'] });
  qc.invalidateQueries({ queryKey: ['undated'] });
  qc.invalidateQueries({ queryKey: ['archive'] });
  qc.invalidateQueries({ queryKey: ['stats'] }); // wykonanie zadania przez kogoś innego zmienia statystyki
  switch (event.type) {
    case 'project.created':
    case 'project.updated':
    case 'project.deleted':
      qc.invalidateQueries({ queryKey: projectKey(event.id) });
      break;
    case 'project.reordered':
      break;
    case 'user.updated':
    case 'user.deleted':
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['project'] }); // użytkownik jest widoczny na zadaniach w wielu projektach
      break;
    case 'tag.updated':
    case 'tag.deleted':
      qc.invalidateQueries({ queryKey: ['tags'] });
      qc.invalidateQueries({ queryKey: ['project'] }); // tag mógł się pojawić w wielu projektach
      break;
    default:
      qc.invalidateQueries({ queryKey: projectKey(event.projectId) });
  }
}

const MAX_DELAY_MS = 10_000;

/** Utrzymuje połączenie WebSocket: ponawia je z narastającym opóźnieniem i po powrocie sieci. */
export function useRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const { setConnection } = useUiStore.getState();
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let dropped = false;
    let stopped = false;

    const connect = () => {
      clearTimeout(timer);
      const ws = new WebSocket(url);
      socket = ws;

      ws.onopen = () => {
        attempt = 0;
        setConnection('open');
        // Po każdej przerwie (także gdy pierwsze połączenie się nie udało) mogły nas ominąć zdarzenia
        // albo zapytania mogły zakończyć się błędem - pobieramy aktualny stan
        if (dropped) qc.invalidateQueries();
        dropped = false;
      };
      ws.onmessage = (e) => {
        try {
          applyEvent(qc, JSON.parse(e.data));
        } catch {
          /* ignorujemy nieczytelne wiadomości */
        }
      };
      ws.onclose = () => {
        if (stopped || socket !== ws) return;
        dropped = true;
        setConnection('closed');
        timer = setTimeout(connect, Math.min(1000 * 2 ** attempt++, MAX_DELAY_MS));
      };
    };

    // Telefon po uśpieniu lub powrocie sieci: nie czekamy na kolejną próbę, łączymy od razu
    const wake = () => {
      if (document.visibilityState === 'hidden' || stopped) return;
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
      connect();
    };

    connect();
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
      socket?.close();
    };
  }, [qc]);
}


