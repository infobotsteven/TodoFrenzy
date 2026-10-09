import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plik leży w server/src (dev) lub server/dist (build) - w obu przypadkach root repo jest 2 poziomy wyżej.
const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '../..');
const serverDir = path.resolve(here, '..');

export const config = {
  /** 0.0.0.0 = dostępne z całej sieci lokalnej (telefony), nie tylko z localhost */
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 3000),
  databasePath: path.resolve(rootDir, process.env.DATABASE_PATH ?? 'data/todo.db'),
  /** Kopie zapasowe bazy (npm run db:backup) */
  backupsDir: path.resolve(rootDir, process.env.BACKUP_DIR ?? 'backups'),
  migrationsDir: path.resolve(serverDir, 'drizzle'),
  /** Zbudowany frontend serwowany przez Fastify w produkcji */
  clientDistDir: path.resolve(rootDir, 'client/dist'),
};
