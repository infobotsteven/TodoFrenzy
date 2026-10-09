import { chromium } from 'playwright-core';
import { BASE, API, CHANNEL, SHOTS } from '../lib.mjs';
const out = SHOTS;
const raw = async (method, path, body) => { const r = await fetch(API + path, { method, headers: body ? { 'content-type': 'application/json; charset=utf-8' } : {}, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); return t ? JSON.parse(t) : null; };
let fails = 0; const check = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = new Date(); const dow = (today.getDay() + 6) % 7; // 0 = poniedziałek
const monday = new Date(today); monday.setDate(today.getDate() - dow);
const day = (i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return iso(d); };

const projects = await raw('GET', '/projects');
const inne = projects.find((p) => p.isSystem);
const webinar = projects.find((p) => p.name.startsWith('Webinar'));
const webDetail = await raw('GET', `/projects/${webinar.id}`);
const emptyProj = await raw('POST', '/projects', { name: 'ZZ-bez-list' });
const user = await raw('POST', '/users', { nick: 'zz-add', avatar: 'owl' });
const created = [];
const findTask = async (name) => { const all = []; for (const p of await raw('GET', '/projects')) { const d = await raw('GET', `/projects/${p.id}`); for (const l of d.checklists) for (const t of l.tasks) if (t.name === name) all.push({ ...t, project: d.name, list: l.name }); } return all; };

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1900, height: 1200 } });
try {
  await page.goto(`${BASE}/`); await page.waitForSelector('.cal-day'); await page.waitForTimeout(800);

  // 1. tylko tytuł -> projekt Inne
  const friday = day(4);
  await page.locator('.cal-day').nth(4).locator('.cal-add').click();
  const dlg = page.locator('dialog[open]');
  await dlg.waitFor();
  await page.waitForTimeout(500);
  check('okno: domyślny projekt to Inne, lista Zadania, data = kliknięty dzień', (await dlg.locator('select').nth(0).inputValue()) === inne.id && (await dlg.locator('select').nth(1).innerText()).includes('Zadania') && (await dlg.getByLabel('Data').inputValue()) === friday);
  await page.screenshot({ path: `${out}/cal-add.png` });
  await dlg.getByLabel('Tytuł').fill('zz-add-1');
  await dlg.getByRole('button', { name: 'Dodaj zadanie' }).click();
  await page.waitForSelector('dialog[open]', { state: 'detached' });
  await page.waitForTimeout(700);
  const t1 = (await findTask('zz-add-1'))[0];
  created.push(t1?.id);
  check('zadanie bez wyboru projektu trafiło do Inne › Zadania z datą dnia', t1 && t1.project === 'Inne' && t1.list === 'Zadania' && t1.dueDate === friday, JSON.stringify(t1));
  check('zadanie widać w kalendarzu w kolumnie piątku', (await page.locator('.cal-day').nth(4).locator('.cal-task', { hasText: 'zz-add-1' }).count()) === 1);

  // 2. pełne dane: projekt, lista, opis, priorytet, osoba, zmieniona data
  await page.getByRole('button', { name: '+ Zadanie' }).click();
  const d2 = page.locator('dialog[open]'); await d2.waitFor(); await page.waitForTimeout(400);
  check('przycisk „+ Zadanie” ma domyślnie dzisiejszą datę', (await d2.getByLabel('Data').inputValue()) === iso(today));
  await d2.getByLabel('Tytuł').fill('zz-add-2');
  await d2.locator('textarea').fill('opis testowy');
  await d2.locator('select').nth(0).selectOption(webinar.id);
  await page.waitForTimeout(600);
  const listOpts = await d2.locator('select').nth(1).locator('option').allInnerTexts();
  check('po wyborze projektu lista zawiera jego listy', JSON.stringify(listOpts) === JSON.stringify(webDetail.checklists.map((l) => l.name)), JSON.stringify(listOpts));
  const secondList = webDetail.checklists[1];
  await d2.locator('select').nth(1).selectOption(secondList.id);
  await d2.getByLabel('Wysoki').check();
  await d2.getByRole('button', { name: '+ zz-add' }).click();
  await d2.getByLabel('Data').fill(day(2));
  await d2.getByRole('button', { name: 'Dodaj zadanie' }).click();
  await page.waitForSelector('dialog[open]', { state: 'detached' });
  await page.waitForTimeout(700);
  const t2 = (await findTask('zz-add-2'))[0];
  created.push(t2?.id);
  check('zadanie w wybranym projekcie/liście, z opisem, priorytetem, osobą i datą', t2 && t2.project === webinar.name && t2.list === secondList.name && t2.description === 'opis testowy' && t2.priority === 'high' && t2.dueDate === day(2) && t2.users.length === 1 && t2.users[0].nick === 'zz-add', JSON.stringify(t2));
  const card = page.locator('.cal-day').nth(2).locator('.cal-task', { hasText: 'zz-add-2' });
  check('w kalendarzu: środa, z projektem i listą', (await card.count()) === 1 && (await card.innerText()).includes('Webinar') && (await card.innerText()).includes(secondList.name));

  // 3. projekt bez list
  await page.locator('.cal-day').nth(1).locator('.cal-add').click();
  const d3 = page.locator('dialog[open]'); await d3.waitFor(); await page.waitForTimeout(300);
  await d3.getByLabel('Tytuł').fill('zz-add-3');
  await d3.locator('select').nth(0).selectOption(emptyProj.id);
  await page.waitForTimeout(600);
  check('projekt bez list: lista pokazuje „Brak list”', (await d3.locator('select').nth(1).innerText()).includes('Brak list'));
  await d3.getByRole('button', { name: 'Dodaj zadanie' }).click();
  check('projekt bez list: komunikat błędu, okno zostaje', (await d3.getByRole('alert').count()) === 1 && (await findTask('zz-add-3')).length === 0);
  // tytuł z samych spacji
  await d3.locator('select').nth(0).selectOption(inne.id); await page.waitForTimeout(500);
  await d3.getByLabel('Tytuł').fill('   ');
  await d3.getByRole('button', { name: 'Dodaj zadanie' }).click();
  check('pusty tytuł: komunikat, brak zadania', (await d3.getByRole('alert').count()) === 1);
  await page.keyboard.press('Escape');

  // 4. telefon
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(400);
  await page.locator('.cal-day').first().locator('.cal-add').click();
  await page.waitForSelector('dialog[open]'); await page.waitForTimeout(500);
  const probe = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, dlg: document.querySelector('dialog[open]').getBoundingClientRect().right }));
  check('telefon: okno mieści się na ekranie', probe.sw <= probe.vw && probe.dlg <= probe.vw + 0.5, JSON.stringify(probe));
  await page.screenshot({ path: `${out}/cal-add-mobile.png` });
} finally {
  for (const id of created) if (id) await raw('DELETE', `/tasks/${id}`);
  await raw('DELETE', `/projects/${emptyProj.id}`);
  await raw('DELETE', `/users/${user.id}`);
  await browser.close();
}
const left = []; for (const p of await raw('GET', '/projects')) { if (/^zz-/i.test(p.name)) left.push(p.name); const d = await raw('GET', `/projects/${p.id}`); for (const l of d.checklists) for (const t of l.tasks) if (/^zz-/i.test(t.name)) left.push(t.name); }
check('porządek po teście', left.length === 0, left.join(','));
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
