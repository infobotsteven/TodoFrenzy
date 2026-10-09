import { defineConfig } from 'tsup';

export default defineConfig({
  // oprócz serwera budujemy narzędzia CLI, żeby działały bez tsx (np. w obrazie Dockera: node server/dist/backup-cli.js)
  entry: { index: 'src/index.ts', 'backup-cli': 'src/db/backup-cli.ts', 'auth-hash-cli': 'src/auth-hash-cli.ts' },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // @todo/shared to źródła TS bez własnego buildu - wbudowujemy je w bundle serwera
  noExternal: ['@todo/shared'],
});
