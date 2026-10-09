// Wspólne ustawienia testów E2E: adresy, kanał przeglądarki, katalog na zrzuty ekranu oraz automatyczne logowanie.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

/** Adres interfejsu i API (harness `run.mjs` ustawia je na tymczasową instancję; ręcznie domyślnie serwery dev). */
export const BASE = process.env.E2E_BASE ?? 'http://localhost:5173';
export const API = process.env.E2E_API ?? 'http://localhost:3000/api';
/** Kanał przeglądarki Playwrighta (msedge, chrome...). Zainstalowana przeglądarka systemowa, nie pobieramy własnej. */
export const CHANNEL = process.env.E2E_CHANNEL ?? 'msedge';
/** Katalog na zrzuty ekranu z testów (nie trafia do repo). */
export const SHOTS = process.env.E2E_SHOTS ?? path.join(os.tmpdir(), 'todofrenzy-e2e-shots');
fs.mkdirSync(SHOTS, { recursive: true });

/** Dane logowania do aplikacji (harness podaje własne; dla serwera dev domyślnie admin/admin). */
export const E2E_USER = process.env.E2E_USER ?? 'admin';
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'admin';

/** Oryginalny `fetch` (bez automatycznego ciasteczka) - do sprawdzania zachowania bez logowania. */
export const plainFetch = globalThis.fetch.bind(globalThis);

/** Loguje i zwraca wartość ciasteczka sesji (`todofrenzy_session=...`). */
async function loginCookie(api = API, user = E2E_USER, password = E2E_PASSWORD) {
  const res = await plainFetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user, password }),
  });
  if (!res.ok) throw new Error(`Logowanie do ${api} nie powiodło się (${res.status}): ${await res.text()}`);
  return res.headers.get('set-cookie').split(';')[0];
}

// Każdy test działa jako zalogowany: raz logujemy się przez API, a ciasteczko dokładamy do wszystkich żądań `fetch` do API
// oraz do każdej strony otwieranej przez `browser.newPage()` (konteksty tworzone jawnie przez `newContext()` zostają bez sesji).
export const SESSION_COOKIE = await loginCookie();
const [cookieName, ...cookieValue] = SESSION_COOKIE.split('=');
const origin = new URL(BASE);

globalThis.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(origin.origin) && !url.startsWith(new URL(API).origin)) return plainFetch(input, init);
  const headers = new Headers(init.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : undefined));
  if (!headers.has('cookie')) headers.set('cookie', SESSION_COOKIE);
  return plainFetch(input, { ...init, headers });
};

const launch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await launch(...args);
  browser.newPage = async (options = {}) => {
    const context = await browser.newContext(options);
    await context.addCookies([{ name: cookieName, value: cookieValue.join('='), url: origin.origin }]);
    return context.newPage();
  };
  return browser;
};
