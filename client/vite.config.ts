import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const backend = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    // host: true = nasłuchuj na wszystkich interfejsach, żeby podejrzeć dev na telefonie w sieci lokalnej
    host: true,
    port: 5173,
    proxy: {
      // changeOrigin: false - serwer porównuje nagłówek Origin z Host (ochrona CSRF), więc Host musi pozostać adresem, pod którym
      // przeglądarka otwiera aplikację (skrót '/api': url ustawiałby changeOrigin: true i podmieniał Host na adres backendu)
      '/api': { target: backend, changeOrigin: false },
      // WebSocket (Etap 4) - frontend łączy się względnie, więc działa też z telefonu
      '/ws': { target: backend, ws: true },
    },
  },
});
