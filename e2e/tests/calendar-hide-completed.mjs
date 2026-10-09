// Kalendarz: opcja „Ukryj ukończone” (ukrywa wykonane zadania w dniach, zapamiętana w przeglądarce, niezależna od filtrów, działa z odznaczaniem na bieżąco).
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
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();

const P = await call('POST', '/projects', { name: 'ZZ-hc' });
const list = await call('POST', `/projects/${P.id}/checklists`, { name: 'ZZ-hc-lista' });
const user = await call('POST', '/users', { nick: 'zz-hc', avatar: 'owl' });
const mk = (name, extra = {}) => call('POST', `/checklists/${list.id}/tasks`, { name, dueDate: today, ...extra });
const open1 = await mk('zz-hc-open1');
await mk('zz-hc-open2');
await mk('zz-hc-done1', { completed: true, userIds: [user.id] });
await mk('zz-hc-done2', { completed: true, userIds: [user.id] });

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message.slice(0, 120)));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 120)); });
const names = async () => (await page.locator('.cal-day .cal-task-name').allInnerTexts()).filter((n) => n.startsWith('zz-hc'));
const box = page.getByLabel('Ukryj ukończone');
const summary = async () => (await page.locator('.calendar .section-head .muted').first().innerText()).trim();
const todayCount = async () => Number((await page.locator('.cal-day.today .cal-count').innerText()).trim() || 0);
try {
  await page.goto(`${BASE}/`); await page.waitForSelector('.cal-day'); await page.waitForTimeout(1000);

  check('opcja „Ukryj ukończone” jest w kalendarzu i domyślnie wyłączona', (await box.count()) === 1 && !(await box.isChecked()));
  check('domyślnie widać wszystkie 4 zadania (otwarte i wykonane)', JSON.stringify((await names()).sort()) === JSON.stringify(['zz-hc-done1', 'zz-hc-done2', 'zz-hc-open1', 'zz-hc-open2']), JSON.stringify(await names()));
  const summaryBefore = await summary(); const countBefore = await todayCount();

  // --- włączenie ---
  await box.check(); await page.waitForTimeout(300);
  check('po włączeniu wykonane znikają, otwarte zostają', JSON.stringify((await names()).sort()) === JSON.stringify(['zz-hc-open1', 'zz-hc-open2']), JSON.stringify(await names()));
  check('licznik zadań w dniu pokazuje tylko widoczne (−2)', (await todayCount()) === countBefore - 2, `${await todayCount()} vs ${countBefore}`);
  check('podsumowanie tygodnia nadal liczy wszystkie zadania (bez zmian)', (await summary()) === summaryBefore, `${await summary()} vs ${summaryBefore}`);
  check('wybór zapisany w przeglądarce (calendarHideCompleted)', (await page.evaluate(() => localStorage.getItem('calendarHideCompleted'))) === '1');
  check('wykonane zadania nie znikają z innych widoków (kalendarz tylko ukrywa)', (await call('GET', `/calendar?from=${today}&to=${today}`)).tasks.filter((t) => t.name.startsWith('zz-hc') && t.completed).length === 2);

  // --- odznaczenie zadania przy włączonej opcji: znika od razu ---
  await page.locator('.cal-task', { hasText: 'zz-hc-open1' }).getByRole('checkbox').click(); await page.waitForTimeout(600);
  check('wykonanie zadania przy włączonej opcji ukrywa je od razu (zapis w bazie)', (await names()).join() === 'zz-hc-open2' && (await call('GET', `/calendar?from=${today}&to=${today}`)).tasks.find((t) => t.id === open1.id).completed === true, JSON.stringify(await names()));

  // --- niezależność od filtrów ---
  await page.locator('.cal-filters').getByRole('button', { name: /zz-hc/ }).click(); await page.waitForTimeout(300);
  check('filtr osoby + ukrywanie: zostają tylko wykonane przypisane osobie, więc komunikat „wszystkie ukryte”', (await names()).length === 0 && (await page.getByText('Wszystkie zadania w tym tygodniu są ukończone i ukryte.').count()) === 1);
  await page.getByRole('button', { name: 'Wyczyść filtry' }).click(); await page.waitForTimeout(300);
  check('„Wyczyść filtry” nie wyłącza opcji ukrywania (to opcja widoku)', (await box.isChecked()) && (await names()).join() === 'zz-hc-open2');

  // --- wyłączenie ---
  await box.uncheck(); await page.waitForTimeout(300);
  check('po wyłączeniu wracają wszystkie zadania', JSON.stringify((await names()).sort()) === JSON.stringify(['zz-hc-done1', 'zz-hc-done2', 'zz-hc-open1', 'zz-hc-open2']) && (await page.evaluate(() => localStorage.getItem('calendarHideCompleted'))) === '0');

  // --- zapamiętanie po przeładowaniu, język, telefon ---
  await box.check(); await page.reload(); await page.waitForSelector('.cal-day'); await page.waitForTimeout(1000);
  check('po przeładowaniu opcja zostaje włączona i działa', (await box.isChecked()) && (await names()).join() === 'zz-hc-open2', JSON.stringify(await names()));
  await page.screenshot({ path: `${SHOTS}/calendar-hide-completed.png`, clip: { x: 0, y: 0, width: 1440, height: 1000 } });
  await page.locator('.lang-select').selectOption('en'); await page.waitForSelector('.cal-day'); await page.waitForTimeout(500);
  check('EN: „Hide completed”, nadal włączone', (await page.getByLabel('Hide completed').isChecked()) && (await page.getByLabel('Hide completed').count()) === 1);
  await page.locator('.lang-select').selectOption('pl'); await page.waitForTimeout(300);
  await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(400);
  const probe = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
  check('telefon: bez poziomego scrolla, opcja widoczna', probe.sw <= probe.vw && (await box.isVisible()), JSON.stringify(probe));
  check('brak błędów w konsoli', problems.length === 0, problems.join(' | '));
} finally {
  await call('DELETE', `/projects/${P.id}`);
  await call('DELETE', `/users/${user.id}`);
  await browser.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
