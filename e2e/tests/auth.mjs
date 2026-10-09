// Logowanie: ochrona API i WebSocketu, ciasteczko sesji, wielu zalogowanych naraz, blokada po błędnych próbach, wygasanie i przedłużanie sesji,
// unieważnienie sesji po zmianie hasła, hasło jako hash, ekran logowania w przeglądarce. Własne instancje serwera (inne porty i bazy).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import Database from 'better-sqlite3';
import WebSocket from 'ws';
import { API, BASE, CHANNEL, E2E_PASSWORD, E2E_USER, SHOTS, plainFetch } from '../lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let fails = 0;
const check = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const freePort = () => new Promise((resolve) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'todofrenzy-auth-'));
const servers = [];

/** Uruchamia zbudowany serwer z podanymi zmiennymi (wspólna baza = ten sam `dbPath`). */
async function startServer(env, dbPath) {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(root, 'server/dist/index.js')], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATABASE_PATH: dbPath, AUTH_USER: '', AUTH_PASSWORD: '', AUTH_PASSWORD_HASH: '', ...env },
    stdio: 'ignore',
  });
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try { if ((await plainFetch(`${origin}/api/health`)).ok) break; } catch { /* startuje */ }
    if (i > 100) throw new Error('serwer nie wystartował');
    await wait(100);
  }
  const server = { origin, api: `${origin}/api`, stop: () => new Promise((resolve) => { if (child.exitCode !== null || child.signalCode !== null) return resolve(); child.once('exit', resolve); child.kill(); }) };
  servers.push(server);
  return server;
}

const login = (server, user, password, headers = {}) =>
  plainFetch(`${server.api}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ user, password }) });
const cookieOf = (res) => res.headers.getSetCookie()[0]?.split(';')[0];
const get = (server, p, cookie) => plainFetch(`${server.api}${p}`, { headers: cookie ? { cookie } : {} });
const wsClose = (server, cookie) =>
  new Promise((resolve) => {
    const ws = new WebSocket(server.origin.replace(/^http/, 'ws') + '/ws', { headers: cookie ? { Cookie: cookie } : {} });
    let opened = false;
    const timer = setTimeout(() => { ws.close(); resolve({ opened, code: 'otwarte' }); }, 1200);
    ws.on('open', () => { opened = true; });
    ws.on('close', (code) => { clearTimeout(timer); resolve({ opened, code }); });
    ws.on('error', () => { clearTimeout(timer); resolve({ opened, code: 'błąd' }); });
  });

// hash hasła z narzędzia z repo (`npm run auth:hash`)
const hashRun = spawnSync(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), path.join(root, 'server/src/auth-hash-cli.ts'), 'sekret-123'], { encoding: 'utf8' });
const hashMatch = /AUTH_PASSWORD_HASH='([^']+)'/.exec(hashRun.stdout);
check('npm run auth:hash wypisuje hash scrypt', !!hashMatch && hashMatch[1].startsWith('scrypt$'), hashRun.stdout + hashRun.stderr);
const HASH = hashMatch?.[1] ?? '';

try {
  // ===== instancja główna: konto „tester” z hasłem podanym jako HASH, blokada po 5 błędach na 3 s =====
  const dbA = path.join(tmp, 'a.db');
  const A = await startServer({ AUTH_USER: 'tester', AUTH_PASSWORD_HASH: HASH, AUTH_MAX_ATTEMPTS: '5', AUTH_LOCK_SECONDS: '3' }, dbA);

  // --- bez sesji ---
  const unauth = await Promise.all(['/projects', '/users', '/tags', '/calendar?from=2026-01-01&to=2026-01-07', '/overdue?before=2026-01-01', '/undated', '/archive', '/auth/me'].map((p) => get(A, p)));
  check('bez sesji wszystkie dane API → 401', unauth.every((r) => r.status === 401), unauth.map((r) => r.status).join());
  check('bez sesji komunikat „Wymagane logowanie”', (await unauth[0].json()).error === 'Wymagane logowanie');
  const writes = await Promise.all([plainFetch(`${A.api}/projects`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"x"}' }), plainFetch(`${A.api}/projects/abc`, { method: 'DELETE' }), plainFetch(`${A.api}/projects/abc/archive`, { method: 'POST' })]);
  check('bez sesji zapisy (POST/DELETE/archiwizacja) → 401', writes.every((r) => r.status === 401), writes.map((r) => r.status).join());
  check('/api/health jest publiczne (np. dla Dockera)', (await get(A, '/health')).status === 200);
  check('aplikacja (HTML) jest publiczna - to ekran logowania, nie dane', (await plainFetch(A.origin + '/')).status === 200);
  check('WebSocket bez sesji jest zamykany (1008)', (await wsClose(A)).code === 1008);

  // --- logowanie ---
  const badPass = await login(A, 'tester', 'zle-haslo');
  const badUser = await login(A, 'ktos-inny', 'sekret-123');
  const defaultAdmin = await login(A, 'admin', 'admin');
  check('złe hasło, zły login i domyślne admin/admin → 401', [badPass, badUser, defaultAdmin].every((r) => r.status === 401));
  check('ten sam komunikat dla złego loginu i hasła (bez podpowiedzi)', (await badPass.json()).error === (await badUser.json()).error);
  check('błędne logowanie nie ustawia ciasteczka', badPass.headers.getSetCookie().length === 0);

  const ok1 = await login(A, 'tester', 'sekret-123');
  const cookie1 = cookieOf(ok1);
  const setCookie = ok1.headers.getSetCookie()[0] ?? '';
  check('poprawne logowanie hasłem z HASH → 200 i login w odpowiedzi', ok1.status === 200 && (await ok1.json()).user === 'tester');
  check('ciasteczko: HttpOnly, SameSite=Lax, Path=/, Max-Age 7 dni, bez Secure na HTTP', /HttpOnly/.test(setCookie) && /SameSite=Lax/.test(setCookie) && /Path=\//.test(setCookie) && /Max-Age=604800/.test(setCookie) && !/Secure/.test(setCookie), setCookie);
  const https = await login(A, 'tester', 'sekret-123', { 'x-forwarded-proto': 'https' });
  check('za proxy HTTPS (X-Forwarded-Proto) ciasteczko dostaje Secure', /; Secure/.test(https.headers.getSetCookie()[0] ?? ''));
  check('sesja daje dostęp do danych i /auth/me', (await get(A, '/projects', cookie1)).status === 200 && (await (await get(A, '/auth/me', cookie1)).json()).user === 'tester');
  check('WebSocket z sesją działa', (await wsClose(A, cookie1)).opened === true);
  check('losowy/zepsuty token → 401', (await get(A, '/projects', 'todofrenzy_session=nie-ma-takiej-sesji')).status === 401 && (await get(A, '/projects', 'todofrenzy_session=%E0%A4%A')).status === 401);

  // --- baza: tylko skrót tokenu ---
  const dbRead = new Database(dbA, { readonly: true });
  const rows = dbRead.prepare('select token_hash from sessions').all();
  const token1 = decodeURIComponent(cookie1.split('=')[1]);
  check('w bazie jest skrót tokenu (64 znaki hex), a nie token', rows.length >= 1 && rows.every((r) => /^[0-9a-f]{64}$/.test(r.token_hash)) && !rows.some((r) => r.token_hash === token1));
  dbRead.close();

  // --- wielu zalogowanych naraz ---
  const ok2 = await login(A, 'tester', 'sekret-123');
  const cookie2 = cookieOf(ok2);
  check('drugie logowanie to osobna sesja (inny token), obie działają', cookie1 !== cookie2 && (await get(A, '/projects', cookie1)).status === 200 && (await get(A, '/projects', cookie2)).status === 200);
  const out = await plainFetch(`${A.api}/auth/logout`, { method: 'POST', headers: { cookie: cookie1 } });
  check('wylogowanie → 204 i wyczyszczenie ciasteczka (Max-Age=0)', out.status === 204 && /Max-Age=0/.test(out.headers.getSetCookie()[0] ?? ''));
  check('po wylogowaniu ta sesja jest nieważna, druga nadal działa', (await get(A, '/projects', cookie1)).status === 401 && (await get(A, '/projects', cookie2)).status === 200);
  check('wylogowanie bez sesji nie zgłasza błędu', (await plainFetch(`${A.api}/auth/logout`, { method: 'POST' })).status === 204);

  // --- blokada po błędnych próbach ---
  await login(A, 'tester', 'sekret-123'); // udane logowanie zeruje licznik błędów
  const attempts = [];
  for (let i = 0; i < 5; i++) attempts.push((await login(A, 'tester', `zle-${i}`)).status);
  const locked = await login(A, 'tester', 'sekret-123');
  check('5 błędnych prób → kolejna (nawet z poprawnym hasłem) dostaje 429 z Retry-After', attempts.every((s) => s === 401) && locked.status === 429 && Number(locked.headers.get('retry-after')) >= 1, `${attempts.join()} → ${locked.status}`);
  check('komunikat blokady po polsku', /Zbyt wiele nieudanych prób/.test((await locked.json()).error ?? ''));
  await wait(3300);
  check('po upływie blokady poprawne logowanie znów działa', (await login(A, 'tester', 'sekret-123')).status === 200);

  // --- trwałość sesji między restartami i unieważnienie po zmianie hasła ---
  const sessionCookie = cookieOf(await login(A, 'tester', 'sekret-123'));
  await A.stop();
  const A2 = await startServer({ AUTH_USER: 'tester', AUTH_PASSWORD_HASH: HASH }, dbA);
  check('sesja przeżywa restart serwera (ta sama konfiguracja)', (await get(A2, '/projects', sessionCookie)).status === 200);
  await A2.stop();
  const A3 = await startServer({ AUTH_USER: 'tester', AUTH_PASSWORD: 'nowe-haslo' }, dbA);
  check('zmiana hasła w .env unieważnia istniejące sesje', (await get(A3, '/projects', sessionCookie)).status === 401);
  check('stare hasło nie działa, nowe (jawne AUTH_PASSWORD) działa', (await login(A3, 'tester', 'sekret-123')).status === 401 && (await login(A3, 'tester', 'nowe-haslo')).status === 200);
  const dbCheck = new Database(dbA, { readonly: true });
  check('przy starcie usunięto sesje z poprzednich poświadczeń', dbCheck.prepare('select count(*) c from sessions').get().c === 1);
  dbCheck.close();
  await A3.stop();

  // ===== instancja B: krótka sesja (3 s) — wygasanie i przedłużanie =====
  const B = await startServer({ AUTH_USER: 'u', AUTH_PASSWORD: 'p', AUTH_SESSION_SECONDS: '3' }, path.join(tmp, 'b.db'));
  const bCookie = cookieOf(await login(B, 'u', 'p'));
  await wait(1800);
  const refreshed = await get(B, '/projects', bCookie);
  check('aktywność przedłuża sesję (nowe Set-Cookie z Max-Age)', refreshed.status === 200 && /Max-Age=\d/.test(refreshed.headers.getSetCookie()[0] ?? ''), String(refreshed.status));
  await wait(2000); // łącznie 3,8 s od logowania - bez przedłużenia sesja już by wygasła
  check('sesja przedłużana aktywnością żyje dłużej niż 3 s od logowania', (await get(B, '/projects', bCookie)).status === 200);
  await wait(3600);
  check('bez aktywności sesja wygasa po swoim czasie → 401', (await get(B, '/projects', bCookie)).status === 401);
  await B.stop();

  // ===== instancja domyślna: bez AUTH_* działa admin/admin (z ostrzeżeniem w logu) =====
  const D = await startServer({}, path.join(tmp, 'd.db'));
  check('bez ustawień w .env obowiązuje admin/admin', (await login(D, 'admin', 'admin')).status === 200 && (await login(D, 'admin', 'inne')).status === 401);
  await D.stop();

  // ===== instancja testowa harnessu: własne dane, admin/admin nie działa =====
  check('instancja z własnymi danymi odrzuca admin/admin', (await plainFetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', password: 'admin' }) })).status === (E2E_USER === 'admin' && E2E_PASSWORD === 'admin' ? 200 : 401));

  // ===== przeglądarka: ekran logowania na instancji A =====
  const A4 = await startServer({ AUTH_USER: 'tester', AUTH_PASSWORD: 'haslo-ui' }, path.join(tmp, 'ui.db'));
  const browser = await chromium.launch({ channel: CHANNEL, headless: true });
  const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(e.message.slice(0, 120)));
  await page.goto(`${A4.origin}/project/nie-ma-takiego`);
  await page.waitForSelector('form button[type=submit]');
  check('niezalogowany widzi ekran logowania pod dowolnym adresem (adres zostaje)', (await page.getByRole('heading', { name: 'Zaloguj się' }).count()) === 1 && new URL(page.url()).pathname === '/project/nie-ma-takiego');
  check('ekran logowania nie pokazuje danych ani przycisku „Wyloguj”', (await page.getByRole('button', { name: 'Wyloguj' }).count()) === 0 && (await page.locator('.project-card').count()) === 0);
  check('pole hasła jest typu password, pola mają autouzupełnianie dla menedżerów haseł', (await page.getByLabel('Hasło').getAttribute('type')) === 'password' && (await page.getByLabel('Login').getAttribute('autocomplete')) === 'username' && (await page.getByLabel('Hasło').getAttribute('autocomplete')) === 'current-password');
  const visibleLogo = () => page.evaluate(() => [...document.querySelectorAll('.login-card .logo-mark')].filter((i) => getComputedStyle(i).display !== 'none').map((i) => ({ dark: i.classList.contains('on-dark'), loaded: i.naturalWidth > 0 })));
  const lightLogo = await visibleLogo();
  check('logo: ekran logowania w jasnym motywie pokazuje jedną, załadowaną wersję „jasną”', lightLogo.length === 1 && !lightLogo[0].dark && lightLogo[0].loaded, JSON.stringify(lightLogo));
  check('favicon jest serwowany bez logowania (SVG i PNG)', (await plainFetch(`${A4.origin}/favicon.svg`)).status === 200 && (await plainFetch(`${A4.origin}/favicon-32.png`)).status === 200);
  await page.screenshot({ path: `${SHOTS}/login-light.png` });
  await page.getByLabel('Login').fill('tester');
  await page.getByLabel('Hasło').fill('zle-haslo');
  await page.getByRole('button', { name: 'Zaloguj' }).click();
  await page.getByRole('alert').waitFor();
  check('błędne hasło: komunikat „Nieprawidłowy login lub hasło” w formularzu (bez dublowania w toastach)', (await page.getByRole('alert').innerText()).includes('Nieprawidłowy login lub hasło') && (await page.locator('.toast').count()) === 0);
  await page.getByLabel('Hasło').fill('haslo-ui');
  await page.getByLabel('Hasło').press('Enter');
  await page.waitForSelector('button:has-text("Wyloguj")');
  check('poprawne logowanie (Enter) pokazuje aplikację na tym samym adresie, jest „Wyloguj”', (await page.getByRole('heading', { name: 'Zaloguj się' }).count()) === 0 && new URL(page.url()).pathname === '/project/nie-ma-takiego' && (await page.getByRole('button', { name: 'Wyloguj' }).count()) === 1);
  await page.goto(`${A4.origin}/`); await page.waitForSelector('.project-card');
  check('po przeładowaniu sesja trwa (ciasteczko), widać projekty i połączenie realtime', (await page.locator('.project-card').count()) >= 1 && (await page.locator('.banner').count()) === 0);
  const cookies = await context.cookies();
  const sess = cookies.find((c) => c.name === 'todofrenzy_session');
  check('ciasteczko sesji jest HttpOnly (niedostępne dla skryptów strony)', !!sess?.httpOnly && sess.sameSite === 'Lax' && !(await page.evaluate(() => document.cookie.includes('todofrenzy_session'))));
  // sesja wygasła w trakcie pracy (usunięte ciasteczko) → pierwsze zapytanie wraca do logowania
  await context.clearCookies();
  await page.locator('.project-card').first().click();
  await page.getByRole('heading', { name: 'Zaloguj się' }).waitFor();
  check('wygasła sesja w trakcie pracy → powrót do ekranu logowania, bez danych w DOM', (await page.locator('.project-card, .checklist').count()) === 0);
  // ponowne zalogowanie i wylogowanie przyciskiem
  await page.getByLabel('Login').fill('tester');
  await page.getByLabel('Hasło').fill('haslo-ui');
  await page.getByRole('button', { name: 'Zaloguj' }).click();
  await page.waitForSelector('button:has-text("Wyloguj")');
  await page.getByRole('button', { name: 'Wyloguj' }).click();
  await page.getByRole('heading', { name: 'Zaloguj się' }).waitFor();
  check('„Wyloguj” wraca do logowania; po przeładowaniu nadal logowanie', (await page.getByRole('button', { name: 'Wyloguj' }).count()) === 0 && (await (async () => { await page.reload(); await page.getByRole('heading', { name: 'Zaloguj się' }).waitFor(); return true; })()));
  await page.locator('.theme-switch').click();
  const darkLogo = await visibleLogo();
  check('logo: po przełączeniu na ciemny motyw widać jedną, załadowaną wersję „ciemną” (także w pasku u góry)', darkLogo.length === 1 && darkLogo[0].dark && darkLogo[0].loaded && (await page.locator('.topbar .logo-icon.on-dark').evaluate((i) => getComputedStyle(i).display !== 'none')), JSON.stringify(darkLogo));
  await page.screenshot({ path: `${SHOTS}/login-dark.png` });
  await page.setViewportSize({ width: 390, height: 800 });
  const probe = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, right: document.querySelector('.login-card').getBoundingClientRect().right }));
  check('telefon: ekran logowania mieści się na ekranie', probe.sw <= probe.vw && probe.right <= probe.vw, JSON.stringify(probe));
  await page.screenshot({ path: `${SHOTS}/login-mobile.png` });
  const login404 = await plainFetch(`${A4.origin}/`);
  check('ekran logowania ma nagłówki bezpieczeństwa i CSP', login404.headers.get('x-frame-options') === 'DENY' && (login404.headers.get('content-security-policy') ?? '').includes("default-src 'self'"));
  check('brak błędów JS na ekranie logowania', problems.length === 0, problems.join(' | '));
  await browser.close();
} finally {
  for (const s of servers) await s.stop();
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
void BASE;
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
