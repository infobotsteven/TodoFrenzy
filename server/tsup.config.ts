import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // @todo/shared to źródła TS bez własnego buildu - wbudowujemy je w bundle serwera
  noExternal: ['@todo/shared'],
});
