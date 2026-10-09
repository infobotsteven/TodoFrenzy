import { chromium } from 'playwright-core';
import { BASE, API, CHANNEL, SHOTS } from '../lib.mjs';
const out = SHOTS;
const raw = async (m, p, b) => { const r = await fetch(API + p, { method: m, headers: b ? { 'content-type': 'application/json; charset=utf-8' } : {}, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); return t ? JSON.parse(t) : null; };
let fails = 0; const check = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); };
const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const proj = await raw('POST', '/projects', { name: 'ZZ-prio' });
const list = await raw('POST', `/projects/${proj.id}/checklists`, { name: 'L' });
const user = await raw('POST', '/users', { nick: 'zz-prio', avatar: 'cat' });
for (const [name, priority, userIds] of [['zz-hi', 'high', [user.id]], ['zz-med', 'medium', []], ['zz-low', 'low', [user.id]], ['zz-none', 'none', []]]) {
  await raw('POST', `/checklists/${list.id}/tasks`, { name, priority, dueDate: today, userIds });
}
const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1900, height: 1200 } });
const visible = async () => (await page.locator('.cal-task-name').allInnerTexts()).filter((t) => t.startsWith('zz-')).sort().join(',');
const chip = (label) => page.locator('.cal-filters').getByRole('button', { name: label, exact: true });
try {
  await page.goto(`${BASE}/`); await page.waitForSelector('.cal-task'); await page.waitForTimeout(800);
  check('bez filtra: 4 zadania', (await visible()) === 'zz-hi,zz-low,zz-med,zz-none', await visible());
  check('wiersz „Priorytet” z 4 chipami', (await page.locator('.cal-filters .filter-row', { hasText: 'Priorytet' }).locator('.chip').count()) === 4);
  await page.screenshot({ path: `${out}/cal-prio.png`, clip: { x: 0, y: 700, width: 1900, height: 450 } });

  await chip('Wysoki').click(); await page.waitForTimeout(200);
  check('Wysoki: tylko zz-hi', (await visible()) === 'zz-hi', await visible());
  await chip('Niski').click(); await page.waitForTimeout(200);
  check('Wysoki + Niski: zz-hi, zz-low (wielokrotny wybór)', (await visible()) === 'zz-hi,zz-low', await visible());
  check('chip ma aria-pressed', (await chip('Niski').getAttribute('aria-pressed')) === 'true');

  // razem z użytkownikiem i projektem
  await page.locator('.cal-filters .user-chip', { hasText: 'zz-prio' }).click(); await page.waitForTimeout(200);
  check('priorytet + użytkownik: oba spełnione', (await visible()) === 'zz-hi,zz-low', await visible());
  await chip('Niski').click(); await chip('Wysoki').click(); await chip('Brak').click(); await page.waitForTimeout(200);
  check('Brak + użytkownik zz-prio: nic (zz-none nie ma osoby)', (await visible()) === '', await visible());
  await chip('Brak').click();
  // wybór projektu nie kasuje priorytetów
  await chip('Średni').click();
  await page.locator('.cal-filters .chip:not(.user-chip)', { hasText: 'ZZ-prio' }).click(); await page.waitForTimeout(200);
  await page.locator('.cal-filters .chip:not(.user-chip)', { hasText: 'ZZ-prio' }).click(); await page.waitForTimeout(200);
  check('przełączenie projektu zachowuje filtr priorytetu', (await chip('Średni').getAttribute('aria-pressed')) === 'true');

  // wyczyść
  await page.getByRole('button', { name: 'Wyczyść filtry' }).click(); await page.waitForTimeout(200);
  check('„Wyczyść filtry” zdejmuje też priorytety', (await visible()) === 'zz-hi,zz-low,zz-med,zz-none' && (await page.locator('.cal-filters [aria-pressed="true"]').count()) === 0);

  // telefon
  await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(300);
  const probe = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
  check('telefon: bez poziomego scrolla', probe.sw <= probe.vw, JSON.stringify(probe));
} finally {
  await raw('DELETE', `/projects/${proj.id}`);
  await raw('DELETE', `/users/${user.id}`);
  await browser.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
