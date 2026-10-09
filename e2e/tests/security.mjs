// Zabezpieczenia: nagłówki, CSP, walidacja wejścia, limity, Origin w WebSocket, odporność na wstrzyknięcia (SQL/XSS).
import { chromium } from 'playwright-core';
import WebSocket from 'ws';
import { API, BASE, CHANNEL, SESSION_COOKIE } from '../lib.mjs';

const raw = async (m, p, body, headers = {}) => {
  const r = await fetch(API + p, { method: m, headers: { ...(body !== undefined && typeof body !== 'string' ? { 'content-type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const t = await r.text();
  let json = null;
  try { json = t ? JSON.parse(t) : null; } catch { /* nie-JSON */ }
  return { status: r.status, json, text: t, headers: r.headers };
};
let fails = 0;
const check = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); };
const created = [];

const wsOutcome = (origin) =>
  new Promise((resolve) => {
    const url = BASE.replace(/^http/, 'ws') + '/ws';
    const ws = new WebSocket(url, { headers: { Cookie: SESSION_COOKIE, ...(origin ? { Origin: origin } : {}) } });
    const timer = setTimeout(() => { ws.close(); resolve({ open: true, closedBy: 'timeout' }); }, 1500);
    let opened = false;
    ws.on('open', () => { opened = true; });
    ws.on('close', (code) => { clearTimeout(timer); resolve({ open: opened, code }); });
    ws.on('error', () => { clearTimeout(timer); resolve({ open: false, code: 'error' }); });
  });

try {
  // --- nagłówki bezpieczeństwa (aplikacja i API) ---
  for (const [name, res] of [['strona główna', await fetch(BASE + '/')], ['API', await fetch(API + '/health')]]) {
    const h = res.headers;
    check(`${name}: nagłówki bezpieczeństwa (nosniff, DENY, no-referrer)`, h.get('x-content-type-options') === 'nosniff' && h.get('x-frame-options') === 'DENY' && h.get('referrer-policy') === 'no-referrer');
    const csp = h.get('content-security-policy') ?? '';
    check(`${name}: CSP z default-src 'self', frame-ancestors 'none', object-src 'none'`, csp.includes("default-src 'self'") && csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"), csp);
  }
  const html = await (await fetch(BASE + '/')).text();
  check('CSP nie dopuszcza dowolnych skryptów inline (script-src bez unsafe-inline)', !((await fetch(BASE + '/')).headers.get('content-security-policy') ?? '').match(/script-src[^;]*unsafe-inline/));
  check('strona główna to aplikacja (index.html)', html.includes('<div id="root">'));

  // --- walidacja wejścia ---
  check('nazwa projektu 1000 znaków → 400', (await raw('POST', '/projects', { name: 'x'.repeat(1000) })).status === 400);
  check('pusta nazwa → 400', (await raw('POST', '/projects', { name: '   ' })).status === 400);
  check('nieznany kolor → 400', (await raw('POST', '/projects', { name: 'zz-kolor', color: 'tęczowy' })).status === 400);
  check('zarezerwowany kolor „brown” → 400', (await raw('POST', '/projects', { name: 'zz-brown', color: 'brown' })).status === 400);
  check('zepsuty JSON → 400', (await raw('POST', '/projects', '{"name": ', { 'content-type': 'application/json' })).status === 400);
  check('zła data zadania → 400', await (async () => { const p = (await raw('POST', '/projects', { name: 'zz-sec-1' })).json; created.push(p.id); const l = (await raw('POST', `/projects/${p.id}/checklists`, { name: 'L' })).json; return (await raw('POST', `/checklists/${l.id}/tasks`, { name: 't', dueDate: '2026-13-45' })).status === 400; })());
  check('priorytet spoza listy → 400', await (async () => { const p = (await raw('GET', '/projects')).json.find((x) => x.id === created[0]); const d = (await raw('GET', `/projects/${p.id}`)).json; return (await raw('POST', `/checklists/${d.checklists[0].id}/tasks`, { name: 't', priority: 'krytyczny' })).status === 400; })());
  check('kalendarz: zakres > 93 dni → 400', (await raw('GET', '/calendar?from=2026-01-01&to=2026-12-31')).status === 400);
  check('zaległe: zła data → 400', (await raw('GET', '/overdue?before=jutro')).status === 400);
  check('nieistniejący zasób → 404 z komunikatem po polsku', await (async () => { const r = await raw('GET', '/projects/nie-ma-takiego'); return r.status === 404 && /nie istnieje/.test(r.json?.error ?? ''); })());
  check('bulk: więcej niż 200 zadań → 400', await (async () => { const d = (await raw('GET', `/projects/${created[0]}`)).json; return (await raw('POST', `/checklists/${d.checklists[0].id}/tasks/bulk`, { items: Array.from({ length: 201 }, (_, i) => ({ name: `t${i}` })) })).status === 400; })());

  // --- CSRF / limity ---
  const plain = await raw('POST', '/projects', '{"name":"zz-csrf"}', { 'content-type': 'text/plain' });
  check('POST z text/plain (prosty formularz z obcej strony) nie tworzy projektu', plain.status >= 400 && !(await raw('GET', '/projects')).json.some((p) => p.name === 'zz-csrf'), String(plain.status));
  // żądanie zmieniające dane z obcego Origin (np. formularz na złośliwej stronie) → 403, także POST bez ciała
  const victim = (await raw('POST', '/projects', { name: 'zz-csrf-victim' })).json;
  created.push(victim.id);
  for (const path of [`/projects/${victim.id}/archive`, `/projects/${victim.id}/duplicate`, '/projects']) {
    const r = await raw('POST', path, path === '/projects' ? { name: 'zz-csrf-2' } : undefined, { Origin: 'http://evil.example' });
    check(`POST ${path.replace(victim.id, ':id')} z obcego Origin → 403`, r.status === 403, String(r.status));
  }
  check('DELETE z obcego Origin → 403, projekt nietknięty', (await raw('DELETE', `/projects/${victim.id}`, undefined, { Origin: 'http://evil.example' })).status === 403 && (await raw('GET', `/projects/${victim.id}`)).status === 200);
  check('ten sam Origin (jak aplikacja) przechodzi', (await raw('POST', `/projects/${victim.id}/archive`, undefined, { Origin: BASE })).status === 200);
  check('za reverse proxy: Origin zgodny z X-Forwarded-Host przechodzi, niezgodny nie', (await raw('POST', `/projects/${victim.id}/restore`, undefined, { Origin: 'https://todo.example', 'X-Forwarded-Host': 'todo.example' })).status === 200 && (await raw('POST', `/projects/${victim.id}/restore`, undefined, { Origin: 'https://evil.example', 'X-Forwarded-Host': 'todo.example' })).status === 403);
  check('po próbach CSRF nie powstały kopie ani „zz-csrf-2”', !(await raw('GET', '/projects')).json.some((p) => /^zz-csrf-victim (kopia)|^zz-csrf-2/.test(p.name)));
  check('brak nagłówków CORS (obca strona nie przeczyta odpowiedzi)', (await fetch(API + '/projects', { headers: { Origin: 'http://evil.example' } })).headers.get('access-control-allow-origin') === null);
  check('ciało > 1 MB → 413', (await raw('POST', '/projects', JSON.stringify({ name: 'zz-big', description: 'x'.repeat(1_200_000) }), { 'content-type': 'application/json' })).status === 413);
  check('błąd serwera nie ujawnia szczegółów (trasa nieistniejąca → 404 JSON)', (await raw('GET', '/nie-ma-trasy')).status === 404);

  // --- WebSocket: Origin ---
  const same = await wsOutcome(BASE);
  check('WebSocket z tego samego Origin działa', same.open && same.code !== 1008, JSON.stringify(same));
  const foreign = await wsOutcome('http://evil.example');
  check('WebSocket z obcego Origin jest zamykany (1008)', foreign.code === 1008, JSON.stringify(foreign));
  const none = await wsOutcome(null);
  check('WebSocket bez nagłówka Origin (klient nie-przeglądarkowy) działa', none.open && none.code !== 1008, JSON.stringify(none));

  // --- wstrzyknięcia: SQL (zapis dosłowny) i XSS (tekst, nie HTML) ---
  const sqlName = "zz-x'); DROP TABLE projects;--";
  const sqlProject = (await raw('POST', '/projects', { name: sqlName })).json;
  created.push(sqlProject.id);
  check('SQL: nazwa z apostrofem i DROP zapisana dosłownie, tabele całe', sqlProject.name === sqlName && (await raw('GET', '/projects')).json.some((p) => p.id === sqlProject.id));
  const xssName = '<img src=x onerror="window.__xss=1">zz-xss';
  const xssProject = (await raw('POST', '/projects', { name: xssName, description: '<script>window.__xss=2</script>' })).json;
  created.push(xssProject.id);
  const browser = await chromium.launch({ channel: CHANNEL, headless: true });
  const page = await browser.newPage();
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.goto(BASE + '/'); await page.waitForSelector('.cal-day'); await page.waitForTimeout(800);
  const card = page.locator(`a.project-card[href="/project/${xssProject.id}"]`);
  check('XSS: nazwa i opis wyświetlone jako tekst (bez znaczników img/script w karcie)', (await card.innerText()).includes('<img src=x') && (await card.locator('img, script').count()) === 0);
  check('XSS: kod się nie wykonał', (await page.evaluate(() => window.__xss)) === undefined && dialogs.length === 0);
  await page.goto(`${BASE}/project/${xssProject.id}`); await page.waitForSelector('h1'); await page.waitForTimeout(500);
  check('XSS: także w nagłówku projektu', (await page.locator('h1').innerText()).includes('<img src=x') && (await page.evaluate(() => window.__xss)) === undefined);
  await browser.close();
} finally {
  for (const id of created) await raw('DELETE', `/projects/${id}`);
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
