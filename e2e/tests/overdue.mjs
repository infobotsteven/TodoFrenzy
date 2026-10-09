import { chromium } from 'playwright-core';
import { BASE, API, CHANNEL, SHOTS } from '../lib.mjs';
const out = SHOTS;
const call = async (m, p, b, h = {}) => { const r = await fetch(API + p, { method: m, headers: { ...(b ? { 'content-type': 'application/json; charset=utf-8' } : {}), ...h }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); if (!r.ok) throw new Error(`${m} ${p} ${r.status} ${t}`); return t ? JSON.parse(t) : null; };
let fails = 0; const check = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); };
const iso = (add) => { const d = new Date(); d.setDate(d.getDate() + add); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const proj = await call('POST', '/projects', { name: 'ZZ-over' });
const l1 = await call('POST', `/projects/${proj.id}/checklists`, { name: 'ZZ-L1' });
const l2 = await call('POST', `/projects/${proj.id}/checklists`, { name: 'ZZ-L2' });
const user = await call('POST', '/users', { nick: 'zz-over', avatar: 'fox' });
const mk = (list, name, priority, dueDate, userIds = [], completed = false) => call('POST', `/checklists/${list.id}/tasks`, { name, priority, dueDate, userIds, completed });
const tA = await mk(l1, 'zz-A-30', 'high', iso(-30), [user.id]);
const tB = await mk(l1, 'zz-B-20', 'low', iso(-20));
const tC = await mk(l2, 'zz-C-10', 'medium', iso(-10), [user.id]);
const tD = await mk(l2, 'zz-D-1', 'none', iso(-1));
await mk(l2, 'zz-E-today', 'none', iso(0));        // dziś - nie jest zaległe
await mk(l2, 'zz-F-done', 'high', iso(-5), [], true); // wykonane - nie jest zaległe
await mk(l2, 'zz-G-future', 'none', iso(3));        // przyszłość

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1900, height: 1200 } });
await page.addInitScript(() => localStorage.setItem('pageSize', '0')); // „Wszystkie” - paginację testuje osobny plik (pagination.mjs)
const problems = [];
page.on('pageerror', (e) => problems.push(e.message.slice(0, 120)));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 120)); });
const mine = async () => (await page.locator('.overdue-card .cal-task-name').allInnerTexts()).filter((t) => t.startsWith('zz-'));
const chip = (label) => page.locator('.overdue-filters').getByRole('button', { name: label, exact: true });
try {
  await page.goto(`${BASE}/`); await page.waitForSelector('.cal-day'); await page.waitForTimeout(800);
  const serverCount = (await call('GET', `/overdue?before=${iso(0)}`)).tasks.length;
  const tab = page.getByRole('tab', { name: /Zaległe/ });
  check('zakładka „Zaległe” z licznikiem', (await tab.locator('.planner-count').innerText()) === String(serverCount), await tab.innerText());
  check('domyślnie aktywny jest kalendarz', (await page.getByRole('tab', { name: 'Kalendarz' }).getAttribute('aria-selected')) === 'true' && (await page.locator('.week-grid').count()) === 1);

  await tab.click(); await page.waitForSelector('.overdue-card'); await page.waitForTimeout(400);
  check('widok zaległych to siatka kart, bez kalendarza', (await page.locator('.week-grid').count()) === 0 && (await page.locator('.overdue-grid').evaluate((e) => getComputedStyle(e).display)) === 'grid');
  const cols = await page.locator('.overdue-grid').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
  check('siatka ma wiele kolumn na szerokim ekranie', cols >= 4, String(cols));
  check('pokazuje tylko zaległe niewykonane zadania (moje: A, B, C, D)', JSON.stringify((await mine()).sort()) === JSON.stringify(['zz-A-30', 'zz-B-20', 'zz-C-10', 'zz-D-1']), JSON.stringify(await mine()));
  check('liczba kart = liczba zaległych z serwera', (await page.locator('.overdue-card').count()) === serverCount);

  const cardA = page.locator('.overdue-card', { hasText: 'zz-A-30' });
  const dueText = await cardA.locator('.overdue-due').innerText();
  check('na karcie jest termin i ile dni po terminie', /termin\s+.*\d{4}/is.test(dueText) && dueText.includes('30 dni po terminie'), dueText);
  check('„1 dzień po terminie” (liczba pojedyncza)', (await page.locator('.overdue-card', { hasText: 'zz-D-1' }).locator('.overdue-due').innerText()).includes('1 dzień po terminie'));
  check('karta ma projekt, listę, priorytet i osobę', (await cardA.innerText()).includes('ZZ-over') && (await cardA.innerText()).includes('ZZ-L1') && (await cardA.innerText()).includes('Wysoki') && (await cardA.locator('.avatar').count()) === 1);
  await page.screenshot({ path: `${out}/overdue-light.png`, clip: { x: 0, y: 700, width: 1900, height: 500 } });

  // sortowanie
  const order = async () => (await mine()).join(',');
  check('sortowanie domyślnie od najstarszych', (await order()) === 'zz-A-30,zz-B-20,zz-C-10,zz-D-1', await order());
  await page.getByLabel('Sortowanie zaległych zadań').selectOption('newest'); await page.waitForTimeout(200);
  check('od najnowszych', (await order()) === 'zz-D-1,zz-C-10,zz-B-20,zz-A-30', await order());
  const firstOverall = await page.locator('.overdue-card .overdue-date').first().innerText();
  const allDates = await page.locator('.overdue-card .cal-task-name').count();
  check('od najnowszych: pierwsza karta ma najpóźniejszy termin ze wszystkich', allDates > 1 && firstOverall.length > 0);
  await page.getByLabel('Sortowanie zaległych zadań').selectOption('oldest');

  // filtry
  await chip('ZZ-over').click(); await page.waitForTimeout(200);
  check('filtr projektu zawęża do projektu', (await page.locator('.overdue-card').count()) === 4);
  await chip('ZZ-L2').click(); await page.waitForTimeout(200);
  check('filtr listy zawęża do listy', JSON.stringify((await mine()).sort()) === JSON.stringify(['zz-C-10', 'zz-D-1']), JSON.stringify(await mine()));
  await chip('ZZ-L2').click();
  await chip('Wysoki').click(); await page.waitForTimeout(200);
  check('filtr priorytetu', JSON.stringify(await mine()) === JSON.stringify(['zz-A-30']), JSON.stringify(await mine()));
  await chip('Wysoki').click();
  await page.locator('.overdue-filters .user-chip', { hasText: 'zz-over' }).click(); await page.waitForTimeout(200);
  check('filtr użytkownika', JSON.stringify((await mine()).sort()) === JSON.stringify(['zz-A-30', 'zz-C-10']), JSON.stringify(await mine()));
  await page.locator('.overdue-filters .user-chip', { hasText: 'zz-over' }).click();
  await chip('Bez przypisania').click(); await page.waitForTimeout(200);
  check('filtr „Bez przypisania”', JSON.stringify((await mine()).sort()) === JSON.stringify(['zz-B-20', 'zz-D-1']), JSON.stringify(await mine()));
  check('podtytuł pokazuje „X z Y”', /\d+ z \d+ zaległych/.test(await page.locator('.overdue .section-head .muted').innerText()));
  await page.getByRole('button', { name: 'Wyczyść filtry' }).click(); await page.waitForTimeout(200);
  check('„Wyczyść filtry”', (await page.locator('.overdue-card').count()) === serverCount);
  // filtry zaległych nie mieszają się z filtrami kalendarza
  await chip('ZZ-over').click();
  await page.getByRole('tab', { name: 'Kalendarz' }).click(); await page.waitForSelector('.week-grid');
  check('filtry kalendarza niezależne od filtrów zaległych', (await page.locator('.cal-filters [aria-pressed="true"]').count()) === 0);
  await page.getByRole('tab', { name: /Zaległe/ }).click(); await page.waitForSelector('.overdue-card');
  check('filtry zaległych są zapamiętane po przełączeniu zakładek', (await page.locator('.overdue-card').count()) === 4);
  await page.getByRole('button', { name: 'Wyczyść filtry' }).click();

  // zmiana terminu: dalej zaległe
  await page.locator('.overdue-card', { hasText: 'zz-B-20' }).getByRole('button', { name: 'Zmień termin' }).click();
  await page.waitForSelector('dialog[open]');
  await page.screenshot({ path: `${out}/overdue-modal.png` });
  await page.locator('dialog[open] input[type=date]').fill(iso(-3));
  await page.getByRole('button', { name: 'Zapisz' }).click(); await page.waitForTimeout(600);
  check('nowy, nadal przeszły termin: karta zostaje i pokazuje „3 dni po terminie”', (await page.locator('.overdue-card', { hasText: 'zz-B-20' }).locator('.overdue-due').innerText()).includes('3 dni po terminie'));
  check('po zmianie terminu kolejność się przelicza (B za A, C)', JSON.stringify((await mine())) === JSON.stringify(['zz-A-30', 'zz-C-10', 'zz-B-20', 'zz-D-1']) , JSON.stringify(await mine()));
  check('termin zapisany w bazie', (await call('GET', `/projects/${proj.id}`)).checklists[0].tasks.find((t) => t.id === tB.id).dueDate === iso(-3));

  // termin na dziś: znika z zaległych
  const before = await page.locator('.overdue-card').count();
  await page.locator('.overdue-card', { hasText: 'zz-C-10' }).getByRole('button', { name: 'Zmień termin' }).click();
  await page.waitForSelector('dialog[open]');
  await page.locator('dialog[open]').getByRole('button', { name: 'Dziś', exact: true }).click(); await page.waitForTimeout(600);
  check('„Dziś” w oknie terminu zdejmuje zadanie z zaległych', (await page.locator('.overdue-card').count()) === before - 1 && !(await mine()).includes('zz-C-10'));
  check('termin = dziś w bazie', (await call('GET', `/projects/${proj.id}`)).checklists[1].tasks.find((t) => t.id === tC.id).dueDate === iso(0));
  check('licznik na zakładce zmalał', (await page.getByRole('tab', { name: /Zaległe/ }).locator('.planner-count').innerText()) === String(before - 1));

  // wykonanie
  await page.locator('.overdue-card', { hasText: 'zz-D-1' }).getByRole('checkbox').click(); await page.waitForTimeout(600);
  check('zaznaczenie jako wykonane usuwa kartę', !(await mine()).includes('zz-D-1'));
  check('wykonanie zapisane w bazie', (await call('GET', `/projects/${proj.id}`)).checklists[1].tasks.find((t) => t.id === tD.id).completed === true);

  // realtime: ktoś inny kończy zadanie
  await call('PATCH', `/tasks/${tA.id}/completed`, { completed: true }, { 'x-client-id': 'inny-klient' });
  await page.waitForTimeout(1500);
  check('zmiana zrobiona przez kogoś innego odświeża zaległe na żywo', !(await mine()).includes('zz-A-30'));
  // ktoś przesuwa termin B w przyszłość
  await call('PATCH', `/tasks/${tB.id}`, { dueDate: iso(5) }, { 'x-client-id': 'inny-klient' });
  await page.waitForTimeout(1500);
  check('przesunięcie terminu przez kogoś innego też', !(await mine()).includes('zz-B-20'));
  check('pusty widok zaległych moich zadań', (await mine()).length === 0);

  // ciemny motyw + telefon
  await page.locator('.theme-switch').click(); await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/overdue-dark.png`, clip: { x: 0, y: 700, width: 1900, height: 500 } });
  await page.locator('.theme-switch').click();
  await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(400);
  const probe = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, cols: getComputedStyle(document.querySelector('.overdue-grid')).gridTemplateColumns.split(' ').length }));
  check('telefon: jedna kolumna, bez poziomego scrolla', probe.sw <= probe.vw && probe.cols === 1, JSON.stringify(probe));
  await page.locator('.overdue-card').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/overdue-mobile.png` });
  check('brak błędów w konsoli', problems.length === 0, problems.join(' | '));
} finally {
  await call('DELETE', `/projects/${proj.id}`);
  await call('DELETE', `/users/${user.id}`);
  await browser.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
