import type { FastifyPluginAsync } from 'fastify';
import { isHttps, readSessionToken, sessionCookie, validateSession } from '../auth.js';
import { sqlite } from '../db/client.js';
import { tr } from '../i18n.js';
import { authRoutes } from './auth.js';
import { calendarRoutes } from './calendar.js';
import { checklistRoutes } from './checklists.js';
import { projectRoutes } from './projects.js';
import { statsRoutes } from './stats.js';
import { tagRoutes } from './tags.js';
import { taskRoutes } from './tasks.js';
import { userRoutes } from './users.js';

/** Ścieżki dostępne bez logowania: sprawdzenie zdrowia (np. Docker) oraz samo logowanie/wylogowanie. */
const PUBLIC_PATHS = new Set(['/api/health', '/api/auth/login', '/api/auth/logout']);

/** Wszystkie trasy REST, rejestrowane pod prefiksem /api */
export const apiRoutes: FastifyPluginAsync = async (app) => {
  // Cały interfejs API poza ścieżkami publicznymi wymaga ważnej sesji (ciasteczko). Ważna sesja jest przedłużana wraz z aktywnością.
  app.addHook('onRequest', async (req, reply) => {
    if (PUBLIC_PATHS.has(req.url.split('?')[0]!)) return;
    const { valid, refreshedExpiresAt } = validateSession(readSessionToken(req.headers));
    if (!valid) return reply.code(401).send({ error: tr(req.headers, 'Wymagane logowanie') });
    if (refreshedExpiresAt) reply.header('Set-Cookie', sessionCookie(readSessionToken(req.headers)!, refreshedExpiresAt, isHttps(req.headers)));
  });

  app.get('/health', async () => {
    const { journal_mode } = sqlite.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
    return { status: 'ok', db: journal_mode };
  });

  await app.register(authRoutes);
  await app.register(projectRoutes);
  await app.register(checklistRoutes);
  await app.register(taskRoutes);
  await app.register(tagRoutes);
  await app.register(userRoutes);
  await app.register(calendarRoutes);
  await app.register(statsRoutes);
};
