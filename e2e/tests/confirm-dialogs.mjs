// Okna potwierdzenia w stylu aplikacji (zamiast natywnego confirm): usuwanie projektu, listy, zadania, tagu i użytkownika.
import { chromium } from 'playwright-core';
import { API, BASE, CHANNEL, SHOTS } from '../lib.mjs';

const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: body ? { 'content-type': 'application/json; charset=utf-8' } : {}, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok && method !== 'DELETE') throw new Error(`${method} ${path} ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
};
let fails = 0;
const check = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); };

const proj = await call('POST', '/projects', { name: 'ZZ-confirm' });
const list = await call('POST', `/projects/${proj.id}/checklists`, { name: 'ZZ-lista' });
const task = await call('POST', `/checklists/${list.id}/tasks`, { name: 'zz-zadanie' });
const tag = await call('POST', '/tags', { name: 'zz-tag' });
await call('PATCH', `/checklists/${list.id}`, { tagIds: [tag.id] });
const user = await call('POST', '/users', { nick: 'zz-osoba', avatar: 'owl' });
const extraProject = await call('POST', '/projects', { name: 'ZZ-confirm-2' });

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const problems = [];
let native = 0;
page.on('dialog', (d) => { native++; d.dismiss(); }); // natywne okno = błąd (test sprawdza, że już się nie pojawia)
page.on('pageerror', (e) => problems.push(e.message.slice(0, 120)));
const confirmDlg = page.locator('dialog.confirm-dialog[open]');
const exists = async (path) => { try { const r = await fetch(API + path); return r.ok; } catch { return false; } };
try {
  await page.goto(`${BASE}/project/${proj.id}`);
  await page.waitForSelector('.task');

  // --- zadanie ---
  await page.locator('.task-name', { hasText: 'zz-zadanie' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Usuń', exact: true }).click();
  await confirmDlg.waitFor();
  check('zadanie: okno potwierdzenia ma tytuł i treść z nazwą', (await confirmDlg.innerText()).includes('Usunąć zadanie?') && (await confirmDlg.innerText()).includes('zz-zadanie'));
  check('fokus startuje na „Anuluj”', (await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Anuluj');
  await page.screenshot({ path: `${SHOTS}/confirm-task.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('Esc anuluje: zadanie zostaje, okno edycji nadal otwarte', (await call('GET', `/projects/${proj.id}`)).checklists[0].tasks.length === 1 && (await page.locator('dialog[open]').count()) === 1);
  await page.locator('dialog[open]').getByRole('button', { name: 'Usuń', exact: true }).click();
  await confirmDlg.getByRole('button', { name: 'Anuluj' }).click();
  await page.waitForTimeout(300);
  check('Anuluj: zadanie zostaje', (await call('GET', `/projects/${proj.id}`)).checklists[0].tasks.length === 1);
  await page.locator('dialog[open]').getByRole('button', { name: 'Usuń', exact: true }).click();
  await confirmDlg.getByRole('button', { name: 'Usuń zadanie' }).click();
  await page.waitForTimeout(700);
  check('potwierdzenie usuwa zadanie i zamyka okna', (await call('GET', `/projects/${proj.id}`)).checklists[0].tasks.length === 0 && (await page.locator('dialog[open]').count()) === 0);

  // --- tag ---
  await page.getByRole('button', { name: 'Tagi', exact: true }).click();
  await page.locator('dialog[open]').waitFor();
  const row = page.locator('dialog[open] li.tag-row').filter({ has: page.getByLabel('Nazwa tagu zz-tag') });
  await row.getByRole('button', { name: 'Usuń' }).click();
  await confirmDlg.waitFor();
  check('tag: treść z nazwą', (await confirmDlg.innerText()).includes('zz-tag'));
  await confirmDlg.getByRole('button', { name: 'Anuluj' }).click();
  await page.waitForTimeout(300);
  check('tag: Anuluj zostawia tag', (await call('GET', '/tags')).some((t) => t.id === tag.id));
  await row.getByRole('button', { name: 'Usuń' }).click();
  await confirmDlg.getByRole('button', { name: 'Usuń tag' }).click();
  await page.waitForTimeout(700);
  check('tag: potwierdzenie usuwa', !(await call('GET', '/tags')).some((t) => t.id === tag.id));
  await page.keyboard.press('Escape');

  // --- lista ---
  await page.locator('button[aria-label="Edytuj listę"]').first().click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Usuń', exact: true }).click();
  await confirmDlg.waitFor();
  check('lista: treść z nazwą listy', (await confirmDlg.innerText()).includes('ZZ-lista'));
  await confirmDlg.getByRole('button', { name: 'Usuń listę' }).click();
  await page.waitForTimeout(700);
  check('lista: usunięta po potwierdzeniu', (await call('GET', `/projects/${proj.id}`)).checklists.length === 0);

  // --- użytkownik (strona główna) ---
  await page.goto(`${BASE}/`);
  await page.waitForSelector('.cal-day');
  await page.getByRole('button', { name: 'Użytkownicy', exact: true }).click();
  await page.getByRole('button', { name: 'Usuń użytkownika zz-osoba' }).click();
  await confirmDlg.waitFor();
  check('użytkownik: okno z nickiem', (await confirmDlg.innerText()).includes('zz-osoba'));
  await page.screenshot({ path: `${SHOTS}/confirm-user.png` });
  await confirmDlg.getByRole('button', { name: 'Anuluj' }).click();
  await page.waitForTimeout(300);
  check('użytkownik: Anuluj zostawia go', (await call('GET', '/users')).some((u) => u.id === user.id));
  await page.getByRole('button', { name: 'Usuń użytkownika zz-osoba' }).click();
  await confirmDlg.getByRole('button', { name: 'Usuń użytkownika' }).click();
  await page.waitForTimeout(700);
  check('użytkownik: usunięty po potwierdzeniu', !(await call('GET', '/users')).some((u) => u.id === user.id));
  await page.keyboard.press('Escape');

  // --- projekt ---
  await page.goto(`${BASE}/project/${extraProject.id}`);
  await page.getByRole('button', { name: /Edytuj projekt/ }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Usuń', exact: true }).click();
  await confirmDlg.waitFor();
  check('projekt: treść z nazwą', (await confirmDlg.innerText()).includes('ZZ-confirm-2'));
  await confirmDlg.getByRole('button', { name: 'Usuń projekt' }).click();
  await page.waitForTimeout(900);
  check('projekt: usunięty i przekierowanie na stronę główną', !(await exists(`/projects/${extraProject.id}`)) && new URL(page.url()).pathname === '/');

  // --- telefon + ciemny motyw ---
  const p2 = await call('POST', '/projects', { name: 'ZZ-confirm-3' });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`${BASE}/project/${p2.id}`);
  await page.locator('.theme-switch').click();
  await page.getByRole('button', { name: /Edytuj projekt/ }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Usuń', exact: true }).click();
  await confirmDlg.waitFor();
  const probe = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, right: document.querySelector('dialog.confirm-dialog[open]').getBoundingClientRect().right }));
  check('telefon: okno potwierdzenia mieści się na ekranie', probe.sw <= probe.vw && probe.right <= probe.vw, JSON.stringify(probe));
  await page.screenshot({ path: `${SHOTS}/confirm-mobile-dark.png` });
  await confirmDlg.getByRole('button', { name: 'Anuluj' }).click();
  await call('DELETE', `/projects/${p2.id}`);

  check('natywne okna przeglądarki się nie pojawiły', native === 0, String(native));
  check('brak błędów JS', problems.length === 0, problems.join(' | '));
} finally {
  await call('DELETE', `/projects/${proj.id}`);
  await call('DELETE', `/projects/${extraProject.id}`);
  await call('DELETE', `/tags/${tag.id}`);
  await call('DELETE', `/users/${user.id}`);
  await browser.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
