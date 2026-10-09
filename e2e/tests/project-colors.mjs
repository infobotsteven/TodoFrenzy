// Tożsamość kolorem projektu: bloki projektów i zadania (kalendarz, zakładki zadań) mają delikatne tło i obwódkę w kolorze projektu
// (jak stały „Inne”), a projekt bez koloru jest neutralny; po terminie kolor projektu zostaje, a obwódka robi się czerwonawa; archiwalny ma ślad koloru.
import { chromium } from 'playwright-core';
import { API, BASE, CHANNEL, SHOTS } from '../lib.mjs';

const raw = async (m, p, b) => {
  const r = await fetch(API + p, { method: m, headers: b ? { 'content-type': 'application/json; charset=utf-8' } : {}, body: b ? JSON.stringify(b) : undefined });
  const t = await r.text();
  return { status: r.status, body: t ? JSON.parse(t) : null };
};
const call = async (m, p, b) => {
  const r = await raw(m, p, b);
  if (r.status >= 400 && m !== 'DELETE') throw new Error(`${m} ${p} ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
};
let fails = 0;
const check = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); };
const pad = (n) => String(n).padStart(2, '0');
const iso = (add) => { const d = new Date(); d.setDate(d.getDate() + add); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

const mkProject = async (name, color) => {
  const p = await call('POST', '/projects', { name, ...(color ? { color } : {}) });
  const list = await call('POST', `/projects/${p.id}/checklists`, { name: `${name}-l` });
  return { p, list };
};
const blue = await mkProject('ZZ-col-blue', 'blue');
const red = await mkProject('ZZ-col-red', 'red');
const none = await mkProject('ZZ-col-none', null);
const arch = await mkProject('ZZ-col-arch', 'green');
const mk = (proj, name, extra = {}) => call('POST', `/checklists/${proj.list.id}/tasks`, { name, ...extra });
await mk(blue, 'zz-col-blue-dzis', { dueDate: iso(0) });
await mk(blue, 'zz-col-blue-zalegle', { dueDate: iso(-3) });
await mk(red, 'zz-col-red-dzis', { dueDate: iso(0) });
await mk(none, 'zz-col-none-dzis', { dueDate: iso(0) });
await mk(none, 'zz-col-none-zalegle', { dueDate: iso(-3) });
await mk(arch, 'zz-col-arch-dzis', { dueDate: iso(0) });
await call('POST', `/projects/${arch.p.id}/archive`);

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1900, height: 1200 } });
await page.addInitScript(() => localStorage.setItem('pageSize', '0')); // „Wszystkie” - paginację testuje osobny plik
const problems = [];
page.on('pageerror', (e) => problems.push(e.message.slice(0, 120)));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 120)); });

/** Kolory obliczone dla elementu jako [r, g, b] (0-255); Chrome zwraca color-mix jako rgb() albo color(srgb …). */
const styleOf = (locator) => locator.evaluate((el) => {
  const parse = (v) => {
    const n = (v.match(/-?[\d.]+/g) ?? []).map(Number);
    return v.startsWith('color(') ? n.slice(0, 3).map((x) => Math.round(x * 255)) : n.slice(0, 3);
  };
  const cs = getComputedStyle(el);
  return { bg: parse(cs.backgroundColor), border: parse(cs.borderTopColor), borderStyle: cs.borderTopStyle, image: cs.backgroundImage, color: el.dataset.color ?? null };
});
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
const card = (name) => page.locator('.project-item .project-card', { has: page.locator('h2', { hasText: new RegExp(`^${name}$`) }) });
const calTask = (name) => page.locator('.cal-day .cal-task', { hasText: name });
try {
  for (const theme of ['light', 'dark']) {
    await page.goto(`${BASE}/`); await page.waitForSelector('.cal-day');
    await page.evaluate((t) => { localStorage.setItem('theme', t); document.documentElement.dataset.theme = t; }, theme);
    await page.waitForTimeout(700);
    const surface = await page.evaluate(() => { const probe = document.createElement('div'); probe.style.background = 'var(--surface)'; document.body.append(probe); const c = getComputedStyle(probe).backgroundColor; probe.remove(); return (c.match(/-?[\d.]+/g) ?? []).slice(0, 3).map(Number); });
    const tag = `[${theme}]`;
    // odchylenie barwy tła od neutralnej powierzchni: [dR, dB] (w ciemnym motywie powierzchnia jest lekko turkusowa, więc liczy się różnica, nie surowe R vs B)
    const hueDelta = (bg) => [bg[0] - surface[0], bg[2] - surface[2]];

    // --- bloki projektów ---
    const cb = await styleOf(card('ZZ-col-blue')); const cr = await styleOf(card('ZZ-col-red')); const cn = await styleOf(card('ZZ-col-none')); const ci = await styleOf(page.locator('.project-card.fixed'));
    check(`${tag} karty projektów mają atrybut koloru (blue/red/brak/brązowy „Inne”)`, cb.color === 'blue' && cr.color === 'red' && cn.color === null && ci.color === 'brown', JSON.stringify([cb.color, cr.color, cn.color, ci.color]));
    check(`${tag} karta z kolorem ma tło inne niż neutralne (delikatny odcień), a bez koloru jest neutralna`, dist(cb.bg, surface) > 4 && dist(cr.bg, surface) > 4 && dist(cn.bg, surface) <= 1, JSON.stringify({ cb: cb.bg, cn: cn.bg, surface }));
    check(`${tag} odcień zgadza się z kolorem projektu (niebieski: B > R, czerwony: R > B)`, hueDelta(cb.bg)[1] > hueDelta(cb.bg)[0] && hueDelta(cr.bg)[0] > hueDelta(cr.bg)[1], JSON.stringify({ cb: cb.bg, cr: cr.bg, surface }));
    check(`${tag} obwódka karty jest w kolorze projektu i wyraźniejsza niż neutralna`, dist(cb.border, cn.border) > 20 && cb.border[2] > cb.border[0] && cr.border[0] > cr.border[2], JSON.stringify({ cb: cb.border, cr: cr.border, cn: cn.border }));
    check(`${tag} „Inne” zachowało swój wygląd (tło i obwódka w kolorze projektu) i jest spójne z pozostałymi`, dist(ci.bg, surface) > 4 && dist(ci.border, cn.border) > 8);
    check(`${tag} karta jest nadal czytelna: tło tylko lekko odcięte od neutralnego (delikatny, nie krzykliwy)`, dist(cb.bg, surface) < 60 && dist(cr.bg, surface) < 60, JSON.stringify({ cb: dist(cb.bg, surface), cr: dist(cr.bg, surface) }));

    // --- zadania w kalendarzu ---
    const tb = await styleOf(calTask('zz-col-blue-dzis')); const tr = await styleOf(calTask('zz-col-red-dzis')); const tn = await styleOf(calTask('zz-col-none-dzis'));
    check(`${tag} zadania w kalendarzu niosą kolor projektu (data-color)`, tb.color === 'blue' && tr.color === 'red' && tn.color === null, JSON.stringify([tb.color, tr.color, tn.color]));
    check(`${tag} tło i obwódka zadania w kolorze projektu (niebieskie/czerwone), zadanie bez koloru neutralne`, hueDelta(tb.bg)[1] > hueDelta(tb.bg)[0] && hueDelta(tr.bg)[0] > hueDelta(tr.bg)[1] && dist(tb.border, tn.border) > 20 && dist(tr.border, tn.border) > 20 && dist(tb.bg, tn.bg) > 4, JSON.stringify({ tb, tr, tn }));
    check(`${tag} zadania z jednego projektu mają ten sam odcień (spójność z kartą projektu)`, dist((await styleOf(calTask('zz-col-blue-dzis'))).bg, cb.bg) <= 14, JSON.stringify({ task: tb.bg, card: cb.bg }));

    // --- po terminie: kolor projektu zostaje, obwódka czerwonawa ---
    const week = await page.locator('.cal-day .cal-task', { hasText: 'zz-col-blue-zalegle' }).count();
    if (week > 0) {
      const ob = await styleOf(calTask('zz-col-blue-zalegle')); const on = await styleOf(calTask('zz-col-none-zalegle'));
      check(`${tag} zaległe zadanie z kolorem: tło w kolorze projektu (niebieskie), obwódka czerwonawa`, ob.bg[2] > ob.bg[0] && ob.border[0] > ob.border[2], JSON.stringify(ob));
      check(`${tag} zaległe zadanie bez koloru: czerwonawe tło jak dotąd`, on.bg[0] > on.bg[2], JSON.stringify(on));
    }
  }

  // --- zakładka „Zaległe” (karty zadań to też .cal-task) ---
  await page.getByRole('tab', { name: /^Zaległe/ }).click(); await page.waitForSelector('.overdue-grid'); await page.waitForTimeout(500);
  const gb = await styleOf(page.locator('.overdue-card', { hasText: 'zz-col-blue-zalegle' })); const gn = await styleOf(page.locator('.overdue-card', { hasText: 'zz-col-none-zalegle' }));
  check('„Zaległe”: karta zadania w kolorze projektu (niebieska), bez koloru neutralna', gb.color === 'blue' && gb.bg[2] > gb.bg[0] && gn.color === null && dist(gb.bg, gn.bg) > 4, JSON.stringify({ gb, gn }));
  await page.screenshot({ path: `${SHOTS}/project-colors-overdue.png`, clip: { x: 0, y: 0, width: 1900, height: 1200 } }).catch(() => {});

  // --- archiwalne: ślad koloru + kreskowanie ---
  await page.goto(`${BASE}/?widok=archiwum`); await page.waitForSelector('.project-card.archived');
  const ar = await styleOf(card('ZZ-col-arch'));
  check('archiwalna karta projektu: kolor projektu (zielony ślad), przerywana obwódka i kreskowanie', ar.color === 'green' && ar.borderStyle === 'dashed' && ar.image.includes('repeating-linear-gradient') && ar.border[1] > ar.border[0], JSON.stringify(ar));
  await page.screenshot({ path: `${SHOTS}/project-colors-archive.png`, clip: { x: 0, y: 0, width: 1900, height: 700 } }).catch(() => {});
  check('brak błędów w konsoli', problems.length === 0, problems.join(' | '));
} finally {
  for (const x of [blue, red, none, arch]) await call('DELETE', `/projects/${x.p.id}`);
  await browser.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
