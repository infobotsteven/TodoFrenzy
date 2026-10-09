// Okno „Nowe zadanie” (kalendarz: „+ Zadanie” i „+” w dniu): listy wyboru projektu i listy z bardzo długimi nazwami nie mogą wychodzić poza okno
// (desktop i telefon), a w oknie nie ma poziomego przewijania.
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

const LONG_PROJECT = 'ZZ-ov Bardzo długa nazwa projektu, która normalnie rozpycha pole wyboru poza okno dialogowe formularza nowego zadania';
const LONG_LIST = 'Lista o bardzo długiej nazwie, która też nie powinna wychodzić poza wyskakujące okienko formularza';
const NO_SPACES = 'Listabezspacjizbardzodługąnazwąktórejniedasięzłamaćwżadnymmiejscuiwychodzipozaokno';
const P = await call('POST', '/projects', { name: LONG_PROJECT });
const l1 = await call('POST', `/projects/${P.id}/checklists`, { name: LONG_LIST });
const l2 = await call('POST', `/projects/${P.id}/checklists`, { name: NO_SPACES });
await call('POST', `/checklists/${l1.id}/tasks`, { name: 'zz-ov-t' });

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message.slice(0, 120)));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 120)); });

/** Pola formularza i okno: czy wszystkie kontrolki mieszczą się w oknie (prawa krawędź ≤ prawa krawędź treści okna). */
const geometry = () => page.evaluate(() => {
  const dialog = document.querySelector('dialog[open]');
  const body = dialog.querySelector('.modal-body').getBoundingClientRect();
  const controls = [...dialog.querySelectorAll('select, input, textarea, .field')].map((e) => ({ tag: e.tagName.toLowerCase() + (e.className ? '.' + e.className : ''), right: Math.round(e.getBoundingClientRect().right), left: Math.round(e.getBoundingClientRect().left) }));
  const overflowing = controls.filter((c) => c.right > Math.round(body.right) + 1 || c.left < Math.round(body.left) - 1);
  return { bodyRight: Math.round(body.right), dialogW: Math.round(dialog.getBoundingClientRect().width), scrollW: dialog.scrollWidth, clientW: dialog.clientWidth, overflowing };
});
const openModal = async (viaDayPlus) => {
  if (viaDayPlus) await page.locator('.cal-day.today .cal-add').click(); else await page.getByRole('button', { name: '+ Zadanie' }).click();
  await page.waitForSelector('dialog[open]'); await page.waitForTimeout(500);
};
const pick = async () => {
  const selects = page.locator('dialog[open] select');
  await selects.nth(0).selectOption({ label: LONG_PROJECT }); await page.waitForTimeout(700);
  await selects.nth(1).selectOption({ label: LONG_LIST }); await page.waitForTimeout(300);
};
try {
  await page.goto(`${BASE}/`); await page.waitForSelector('.cal-day'); await page.waitForTimeout(800);

  for (const [viaDay, name] of [[false, '„+ Zadanie”'], [true, '„+” w dniu']]) {
    await openModal(viaDay);
    await pick();
    const g = await geometry();
    check(`desktop, ${name}: długa nazwa projektu i listy mieści się w oknie (żadna kontrolka nie wychodzi poza treść okna)`, g.overflowing.length === 0, JSON.stringify(g));
    check(`desktop, ${name}: okno nie ma poziomego przewijania`, g.scrollW <= g.clientW + 1, JSON.stringify(g));
    if (!viaDay) await page.screenshot({ path: `${SHOTS}/add-task-modal-desktop.png` });
    await page.locator('dialog[open] select').nth(1).selectOption({ label: NO_SPACES }); await page.waitForTimeout(200);
    const g2 = await geometry();
    check(`desktop, ${name}: lista bez spacji też się mieści`, g2.overflowing.length === 0 && g2.scrollW <= g2.clientW + 1, JSON.stringify(g2));
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  }

  // --- telefon ---
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
  await openModal(false); await pick();
  const gm = await geometry();
  const pageProbe = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
  check('telefon: kontrolki mieszczą się w oknie, bez poziomego przewijania okna i strony', gm.overflowing.length === 0 && gm.scrollW <= gm.clientW + 1 && pageProbe.sw <= pageProbe.vw, JSON.stringify({ gm, pageProbe }));
  const stacked = await page.evaluate(() => { const s = [...document.querySelectorAll('dialog[open] select')].slice(0, 2).map((e) => e.getBoundingClientRect()); return s[1].top > s[0].bottom - 1; });
  check('telefon: lista projektu i lista zadań są jedna pod drugą (czytelne pełne szerokości)', stacked);
  await page.screenshot({ path: `${SHOTS}/add-task-modal-mobile.png` });

  // --- działanie nie zepsute: dodanie zadania do długiej listy ---
  await page.locator('dialog[open] input').first().fill('zz-ov-nowe');
  await page.locator('dialog[open] select').nth(1).selectOption({ label: LONG_LIST });
  await page.locator('dialog[open]').getByRole('button', { name: 'Dodaj zadanie' }).click(); await page.waitForTimeout(800);
  const created = (await call('GET', `/projects/${P.id}`)).checklists.find((c) => c.id === l1.id).tasks.some((t) => t.name === 'zz-ov-nowe');
  check('zadanie zostało dodane do wybranej (długiej) listy', created);
  check('brak błędów w konsoli', problems.length === 0, problems.join(' | '));
} finally {
  await call('DELETE', `/projects/${P.id}`);
  await browser.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
