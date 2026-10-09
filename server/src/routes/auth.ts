import type { FastifyPluginAsync } from 'fastify';
import { loginInputSchema } from '@todo/shared';
import {
  authConfig,
  clearFailures,
  clearedCookie,
  createSession,
  destroySession,
  isHttps,
  lockRemainingMs,
  readSessionToken,
  recordFailure,
  sessionCookie,
  verifyCredentials,
} from '../auth.js';
import { tr } from '../i18n.js';

/** Spowalnia zgadywanie hasła (dodatkowo do blokady po kilku błędnych próbach). */
const FAILURE_DELAY_MS = 400;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/login', async (req, reply) => {
    const { user, password } = loginInputSchema.parse(req.body);

    const locked = lockRemainingMs(req.ip);
    if (locked > 0) {
      const minutes = Math.ceil(locked / 60_000);
      return reply
        .code(429)
        .header('Retry-After', Math.ceil(locked / 1000))
        .send({ error: tr(req.headers, `Zbyt wiele nieudanych prób logowania. Spróbuj ponownie za ${minutes} min.`) });
    }

    if (!verifyCredentials(user, password)) {
      recordFailure(req.ip);
      await sleep(FAILURE_DELAY_MS);
      // jeden komunikat dla złego loginu i złego hasła - nie podpowiadamy, które było błędne
      return reply.code(401).send({ error: tr(req.headers, 'Nieprawidłowy login lub hasło') });
    }

    clearFailures(req.ip);
    const { token, expiresAt } = createSession();
    reply.header('Set-Cookie', sessionCookie(token, expiresAt, isHttps(req.headers)));
    return { user: authConfig.user };
  });

  /** Wylogowanie kasuje sesję (idempotentnie - bez sesji też odpowiada 204). */
  app.post('/auth/logout', async (req, reply) => {
    const token = readSessionToken(req.headers);
    if (token) destroySession(token);
    return reply.header('Set-Cookie', clearedCookie(isHttps(req.headers))).code(204).send();
  });

  /** Kim jestem: 200 z loginem dla zalogowanego, 401 (z hooka) dla pozostałych. */
  app.get('/auth/me', async () => ({ user: authConfig.user }));
};
