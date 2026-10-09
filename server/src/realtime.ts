import websocket from '@fastify/websocket';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { RealtimeEvent } from '@todo/shared';
import type { WebSocket } from 'ws';
import { readSessionToken, validateSession } from './auth.js';
import { originMatchesHost } from './security.js';

const HEARTBEAT_MS = 30_000;
const alive = new WeakSet<WebSocket>();

/** Endpoint /ws: klienci tylko słuchają, a wszystkie zmiany idą przez REST. */
export async function registerRealtime(app: FastifyInstance) {
  await app.register(websocket);

  app.get('/ws', { websocket: true }, (socket, req) => {
    // Strona z innej domeny (np. złośliwa karta w tej samej przeglądarce) nie może podsłuchiwać zdarzeń: Origin musi pasować do Host
    const origin = req.headers.origin;
    if (origin && !originMatchesHost(origin, req.headers)) {
      socket.close(1008, 'Niedozwolone źródło');
      return;
    }
    // tylko dla zalogowanych: bez ważnej sesji zdarzenia (dane projektów) nie są wysyłane
    if (!validateSession(readSessionToken(req.headers)).valid) {
      socket.close(1008, 'Wymagane logowanie');
      return;
    }
    alive.add(socket);
    socket.on('pong', () => alive.add(socket));
  });

  // Heartbeat: telefon, który zniknął z sieci bez zamknięcia połączenia, nie zostaje na serwerze w nieskończoność
  const timer = setInterval(() => {
    for (const client of app.websocketServer.clients) {
      if (!alive.has(client)) {
        client.terminate();
        continue;
      }
      alive.delete(client);
      client.ping();
    }
  }, HEARTBEAT_MS);
  app.addHook('onClose', async () => clearInterval(timer));
}

/** Rozsyła zdarzenie do wszystkich podłączonych klientów (razem z nadawcą, który je odfiltruje po `origin`). */
export function emit(req: FastifyRequest, event: RealtimeEvent) {
  const origin = req.headers['x-client-id'];
  const message = JSON.stringify({ ...event, origin: typeof origin === 'string' ? origin : undefined });
  for (const client of req.server.websocketServer.clients) {
    if (client.readyState === client.OPEN) client.send(message);
  }
}
