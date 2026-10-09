import { hashPassword } from './auth.js';

/**
 * Generuje hash hasła do `.env`:  npm run auth:hash -- "noweHaslo"
 * Wynik (linijkę `AUTH_PASSWORD_HASH=...`) wklej do `.env`; zmiana hasła unieważnia istniejące sesje po restarcie serwera.
 */
const password = process.argv[2];
if (!password) {
  console.error('Użycie: npm run auth:hash -- "hasło"');
  process.exit(1);
}
// wartość w apostrofach: hash zawiera znak `$`, który niektóre narzędzia (np. docker compose) próbują interpretować
console.log(`AUTH_PASSWORD_HASH='${hashPassword(password)}'`);
