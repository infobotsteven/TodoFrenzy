import { chromium } from 'playwright-core';
import { BASE, API, CHANNEL, SHOTS } from '../lib.mjs';
const out = SHOTS;
const raw = async (method, path, body) => { const r = await fetch(API + path, { method, headers: body ? { 'content-type': 'application/json; charset=utf-8' } : {}, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); return { status: r.status, body: t ? JSON.parse(t) : null }; };
let fails = 0; const check = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); };

const list = (await raw('GET', '/projects')).body;
const inne = list.find((p) => p.isSystem);
check('Inne jest pierwszy na liście i jest jedyny stały', list[0].id === inne.id && list.filter((p) => p.isSystem).length === 1);
check('Inne: nazwa, kolor', inne.name === 'Inne' && inne.color === 'brown');
const detail = (await raw('GET', `/projects/${inne.id}`)).body;
check('Inne ma dokładnie 1 listę „Zadania”', detail.checklists.length === 1 && detail.checklists[0].name === 'Zadania');
const listId = detail.checklists[0].id;

// strażnicy API
check('DELETE projektu → 403', (await raw('DELETE', `/projects/${inne.id}`)).status === 403);
check('POST nowej listy → 403', (await raw('POST', `/projects/${inne.id}/checklists`, { name: 'zz-x' })).status === 403);
check('duplikowanie listy → 403', (await raw('POST', `/checklists/${listId}/duplicate`)).status === 403);
check('usuwanie listy → 403', (await raw('DELETE', `/checklists/${listId}`)).status === 403);
const other = list.find((p) => !p.isSystem);
check('reorder z Inne → 400', (await raw('PATCH', '/projects/reorder', { ids: [inne.id, other.id] })).status === 400);
const pr = await raw('PATCH', `/projects/${inne.id}`, { name: 'zz-zmiana', color: 'red' });
check('zmiana nazwy/koloru Inne jest ignorowana', pr.status === 200 && pr.body.name === 'Inne' && pr.body.color === 'brown', JSON.stringify(pr.body));
check('nikt nie może ustawić koloru brown', (await raw('POST', '/projects', { name: 'zz-brown', color: 'brown' })).status === 400);
check('stan po próbach: lista wciąż jest', (await raw('GET', `/projects/${inne.id}`)).body.checklists.length === 1);

// kopia projektu Inne trafia do zwykłych projektów
const dup = await raw('POST', `/projects/${inne.id}/duplicate`);
check('kopia Inne: zwykły projekt, bez koloru brown', dup.status === 201 && !dup.body.isSystem && dup.body.color === null && dup.body.name === 'Inne (kopia)', JSON.stringify(dup.body));
if (dup.body?.id) await raw('DELETE', `/projects/${dup.body.id}`);

// UI
const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const task = (await raw('POST', `/checklists/${listId}/tasks`, { name: 'zz-inne-zadanie', dueDate: today })).body;
const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  await page.goto(`${BASE}/`);
  await page.waitForSelector('.project-card');
  await page.waitForTimeout(800);
  const first = page.locator('.project-item').first();
  check('UI: pierwsza karta to Inne bez znaczka „Stały”', (await first.locator('h2').innerText()).trim() === 'Inne' && (await page.locator('.badge-fixed').count()) === 0);
  check('UI: karta Inne bez przycisku duplikowania i uchwytu', (await first.locator('.card-action, .drag-handle').count()) === 0);
  check('UI: inne projekty mają uchwyt', (await page.locator('.project-item').nth(1).locator('.drag-handle').count()) === 1);
  check('UI: kafelek Inne ma kolor brązowy (kropka przy tytule)', await first.locator('.project-card').evaluate((e) => {
    const dot = getComputedStyle(e.querySelector('h2'), '::before').backgroundColor;
    return e.dataset.color === 'brown' && dot !== 'rgba(0, 0, 0, 0)';
  }));
  await page.screenshot({ path: `${out}/inne-home.png` });
  const calTask = page.locator('.cal-task', { hasText: 'zz-inne-zadanie' });
  check('kalendarz pokazuje zadanie z Inne', (await calTask.count()) === 1);
  await page.locator('.cal-day.today').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/inne-cal.png` });

  await first.locator('a.project-card').click();
  await page.waitForSelector('.checklist');
  await page.waitForTimeout(600);
  check('widok Inne: nagłówek bez znaczka', (await page.locator('h1').innerText()).trim() === 'Inne');
  check('widok Inne: brak „+ Nowa lista”', (await page.getByRole('button', { name: '+ Nowa lista' }).count()) === 0);
  await page.screenshot({ path: `${out}/inne-project.png` });
  await page.getByRole('button', { name: /Edytuj projekt/ }).click();
  await page.waitForSelector('dialog[open]');
  const dlg = page.locator('dialog[open]');
  check('formularz projektu: bez Usuń i Duplikuj, nazwa tylko do odczytu', (await dlg.getByRole('button', { name: 'Usuń' }).count()) === 0 && (await dlg.getByRole('button', { name: 'Duplikuj' }).count()) === 0 && (await dlg.locator('input').first().getAttribute('readonly')) !== null);
  await page.screenshot({ path: `${out}/inne-edit.png` });
  await page.keyboard.press('Escape');
  await page.locator('button[aria-label="Edytuj listę"]').first().click();
  await page.waitForSelector('dialog[open]');
  const dlg2 = page.locator('dialog[open]');
  check('formularz listy: bez Usuń i Duplikuj', (await dlg2.getByRole('button', { name: 'Usuń' }).count()) === 0 && (await dlg2.getByRole('button', { name: 'Duplikuj' }).count()) === 0);
  await page.keyboard.press('Escape');
} finally {
  await raw('DELETE', `/tasks/${task.id}`);
  await browser.close();
}
const after = (await raw('GET', '/projects')).body;
check('porządek: brak śmieci po teście', after.length === list.length && after.every((p) => !/^zz-/i.test(p.name)));
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
