import fs from 'node:fs';
import os from 'node:os';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { authConfig, purgeSessions } from './auth.js';
import { config } from './config.js';
import { runMigrations, sqlite } from './db/client.js';
import { ensureSystemProject } from './db/system.js';
import { registerErrorHandler } from './errors.js';
import { registerRealtime } from './realtime.js';
import { registerSecurityHeaders } from './security.js';
import { apiRoutes } from './routes/index.js';

runMigrations();
ensureSystemProject();
purgeSessions();
setInterval(purgeSessions, 3_600_000).unref(); // wygasłe sesje sprzątamy co godzinę

const app = Fastify({ logger: true });

registerErrorHandler(app);
registerSecurityHeaders(app);
await registerRealtime(app);
await app.register(apiRoutes, { prefix: '/api' });

// Produkcja: ten sam proces serwuje zbudowany frontend (jeden port, jeden adres w sieci).
if (fs.existsSync(config.clientDistDir)) {
  await app.register(fastifyStatic, { root: config.clientDistDir });
  // Fallback SPA: nieznane ścieżki (np. /project/abc123) oddają index.html, ale /api/* zostaje 404.
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });
}

const close = async () => {
  await app.close();
  sqlite.close();
  process.exit(0);
};
process.on('SIGINT', close);
process.on('SIGTERM', close);

if (authConfig.usingDefaultCredentials) {
  app.log.warn('Logowanie używa domyślnych danych admin/admin - ustaw AUTH_PASSWORD_HASH (npm run auth:hash) lub AUTH_PASSWORD w .env');
}

await app.listen({ host: config.host, port: config.port });

// Podpowiedź: pod jakimi adresami aplikacja jest dostępna z innych urządzeń w sieci
for (const addrs of Object.values(os.networkInterfaces())) {
  for (const a of addrs ?? []) {
    if (a.family === 'IPv4' && !a.internal) {
      app.log.info(`W sieci lokalnej: http://${a.address}:${config.port}`);
    }
  }
}
