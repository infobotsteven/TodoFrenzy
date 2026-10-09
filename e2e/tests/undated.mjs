// Zakładka „Bez terminu”: niewykonane zadania bez daty — siatka kart, filtry, sortowanie, ustawianie terminu, realtime.
import { chromium } from 'playwright-core';
import { API, BASE, CHANNEL, SHOTS } from '../lib.mjs';

const call = async (m, p, b, h = {}) => {
  const r = await fetch(API + p, { method: m, headers: { ...(b ? { 'content-type': 'application/json; charset=utf-8' } : {}), ...h }, body: b ? JSON.stringify(b) : undefined });
  const t = await r.text();
  if (!r.ok && m !== 'DELETE') throw new Error(`${m} ${p} ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
};
let fails = 0;
const check = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); };
const pad = (n) => String(n).padStart(2, '0');
const iso = (add) => { const d = new Date(); d.setDate(d.getDate() + add); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const proj = await call('POST', '/projects', { name: 'ZZ-undated' });
const l1 = await call('POST', `/projects/${proj.id}/checklists`, { name: 'ZZ-L1' });
const l2 = await call('POST', `/projects/${proj.id}/checklists`, { name: 'ZZ-L2' });
const user = await call('POST', '/users', { nick: 'zz-undated', avatar: 'cat' });
// created_at w bazie ma rozdzielczość 1 s - zadania tworzymy w odstępach, żeby sortowanie po dacie dodania było jednoznaczne
const mk = async (list, name, extra = {}) => { const t = await call('POST', `/checklists/${list.id}/tasks`, { name, ...extra }); await wait(1100); return t; };
const tA = await mk(l1, 'zz-A', { priority: 'high', userIds: [user.id], description: 'opis A' });
const tB = await mk(l1, 'zz-B', { priority: 'low' });
const tC = await mk(l2, 'zz-C', { priority: 'medium', userIds: [user.id] });
const tD = await mk(l2, 'zz-D');
await mk(l2, 'zz-E-dated', { dueDate: iso(3) });          // ma termin — nie należy do widoku
await mk(l2, 'zz-F-done', { completed: true });            // wykonane — nie należy do widoku
const inne = (await call('GET', '/projects')).find((p) => p.isSystem);
const inneList = (await call('GET', `/projects/${inne.id}`)).checklists[0];
const tInne = await mk(inneList, 'zz-G-inne');

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1900, height: 1200 } });
await page.addInitScript(() => localStorage.setItem('pageSize', '0')); // „Wszystkie” - paginację testuje osobny plik (pagination.mjs)
const problems = [];
page.on('pageerror', (e) => problems.push(e.message.slice(0, 120)));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 120)); });
const mine = async () => (await page.locator('.overdue-card .cal-task-name').allInnerTexts()).filter((t) => t.startsWith('zz-'));
const chip = (label) => page.locator('.undated-filters').getByRole('button', { name: label, exact: true });
const tabUndated = () => page.getByRole('tab', { name: /Bez terminu/ });
try {
  await page.goto(`${BASE}/`); await page.waitForSelector('.cal-day'); await page.waitForTimeout(800);
  const serverCount = (await call('GET', '/undated')).tasks.length;
  check('trzecia zakładka „Bez terminu” z licznikiem', (await tabUndated().locator('.planner-count').innerText()) === String(serverCount), await tabUndated().innerText());
  const tabNames = (await page.getByRole('tablist', { name: 'Widok' }).getByRole('tab').allInnerTexts()).map((t) => t.split(/\s*\d+$/)[0].trim());
  check('kolejność zakładek: Kalendarz, Zaległe, Bez terminu, Archiwum', tabNames.join() === 'Kalendarz,Zaległe,Bez terminu,Archiwum', tabNames.join());

  await tabUndated().click(); await page.waitForSelector('.overdue-card'); await page.waitForTimeout(400);
  check('siatka kart, bez kalendarza', (await page.locator('.week-grid').count()) === 0 && (await page.locator('.overdue-grid').evaluate((e) => getComputedStyle(e).display)) === 'grid');
  check('liczba kart = liczba z serwera', (await page.locator('.overdue-card').count()) === serverCount);
  check('tylko niewykonane bez terminu (A, B, C, D, G)', JSON.stringify((await mine()).sort()) === JSON.stringify(['zz-A', 'zz-B', 'zz-C', 'zz-D', 'zz-G-inne']), JSON.stringify(await mine()));
  const cardA = page.locator('.overdue-card', { hasText: 'zz-A' });
  const txt = await cardA.innerText();
  check('karta: „Brak terminu”, data dodania, projekt › lista, priorytet, osoba, opis', /brak terminu/i.test(txt) && /dodano/i.test(txt) && txt.includes('ZZ-undated') && txt.includes('ZZ-L1') && txt.includes('Wysoki') && txt.includes('opis A') && (await cardA.locator('.avatar').count()) === 1, txt);
  check('przycisk „Ustaw termin” na karcie', (await cardA.getByRole('button', { name: 'Ustaw termin' }).count()) === 1);
  check('zadanie z „Inne” ma brązowy styl', (await page.locator('.overdue-card.fixed', { hasText: 'zz-G-inne' }).count()) === 1);
  await page.screenshot({ path: `${SHOTS}/undated-light.png`, clip: { x: 0, y: 700, width: 1900, height: 500 } });

  // domyślna kolejność: „Inne” pierwsze, potem projekt/lista/pozycja
  check('domyślnie: wg projektów i list („Inne” pierwsze)', (await mine()).join() === 'zz-G-inne,zz-A,zz-B,zz-C,zz-D', (await mine()).join());
  const sort = page.getByLabel('Sortowanie zadań bez terminu');
  await sort.selectOption('newest'); await page.waitForTimeout(200);
  check('od najnowszych (wg daty dodania)', (await mine()).join() === 'zz-G-inne,zz-D,zz-C,zz-B,zz-A', (await mine()).join());
  await sort.selectOption('oldest'); await page.waitForTimeout(200);
  check('od najstarszych', (await mine()).join() === 'zz-A,zz-B,zz-C,zz-D,zz-G-inne', (await mine()).join());
  await sort.selectOption('order');

  // filtry
  await chip('ZZ-undated').click(); await page.waitForTimeout(200);
  check('filtr projektu', (await page.locator('.overdue-card').count()) === 4);
  await chip('ZZ-L2').click(); await page.waitForTimeout(200);
  check('filtr listy', JSON.stringify((await mine()).sort()) === JSON.stringify(['zz-C', 'zz-D']), JSON.stringify(await mine()));
  await chip('ZZ-L2').click();
  await chip('ZZ-undated').click(); // zdejmujemy filtr projektu — kolejne sprawdzenia dotyczą wszystkich projektów
  await chip('Wysoki').click(); await page.waitForTimeout(200);
  check('filtr priorytetu', (await mine()).includes('zz-A') && !(await mine()).includes('zz-B'), JSON.stringify(await mine()));
  await chip('Wysoki').click();
  await page.locator('.undated-filters .user-chip', { hasText: 'zz-undated' }).click(); await page.waitForTimeout(200);
  check('filtr użytkownika', JSON.stringify((await mine()).sort()) === JSON.stringify(['zz-A', 'zz-C']), JSON.stringify(await mine()));
  await page.locator('.undated-filters .user-chip', { hasText: 'zz-undated' }).click();
  await chip('Bez przypisania').click(); await page.waitForTimeout(200);
  check('filtr „Bez przypisania”', JSON.stringify((await mine()).sort()) === JSON.stringify(['zz-B', 'zz-D', 'zz-G-inne']), JSON.stringify(await mine()));
  await page.getByRole('button', { name: 'Wyczyść filtry' }).click(); await page.waitForTimeout(200);
  check('wyczyść filtry', (await page.locator('.overdue-card').count()) === serverCount);
  // filtry zakładek są niezależne
  await chip('ZZ-undated').click();
  await page.getByRole('tab', { name: /Zaległe/ }).click(); await page.waitForSelector('.overdue-section, .overdue-grid');
  check('filtry „Zaległe” niezależne od filtrów „Bez terminu”', (await page.locator('.overdue-filters [aria-pressed="true"]').count()) === 0);
  await tabUndated().click(); await page.waitForSelector('.overdue-card');
  check('filtry „Bez terminu” zapamiętane po przełączeniu zakładek', (await page.locator('.overdue-card').count()) === 4);
  await page.getByRole('button', { name: 'Wyczyść filtry' }).click();

  // ustawianie terminu: konkretna data (poza tygodniem kalendarza nie ma znaczenia) -> karta znika
  const before = await page.locator('.overdue-card').count();
  await page.locator('.overdue-card', { hasText: 'zz-B' }).getByRole('button', { name: 'Ustaw termin' }).click();
  await page.waitForSelector('dialog[open]');
  const dlg = page.locator('dialog[open]');
  check('okno: tytuł „Ustaw termin”, brak „Usuń termin”, „Zapisz” wyłączone bez daty', (await dlg.innerText()).includes('Ustaw termin') && (await dlg.getByRole('button', { name: 'Usuń termin' }).count()) === 0 && (await dlg.getByRole('button', { name: 'Zapisz' }).isDisabled()));
  await page.screenshot({ path: `${SHOTS}/undated-modal.png` });
  await dlg.locator('input[type=date]').fill(iso(10));
  await dlg.getByRole('button', { name: 'Zapisz' }).click(); await page.waitForTimeout(600);
  check('po ustawieniu daty karta znika, licznik maleje', !(await mine()).includes('zz-B') && (await page.locator('.overdue-card').count()) === before - 1 && (await tabUndated().locator('.planner-count').innerText()) === String(before - 1));
  check('termin zapisany w bazie', (await call('GET', `/projects/${proj.id}`)).checklists[0].tasks.find((t) => t.id === tB.id).dueDate === iso(10));

  // szybkie „Dziś” -> zadanie ląduje w kalendarzu
  await page.locator('.overdue-card', { hasText: 'zz-C' }).getByRole('button', { name: 'Ustaw termin' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Dziś', exact: true }).click(); await page.waitForTimeout(600);
  check('„Dziś” zdejmuje z widoku', !(await mine()).includes('zz-C'));
  await page.getByRole('tab', { name: 'Kalendarz' }).click(); await page.waitForSelector('.week-grid'); await page.waitForTimeout(500);
  check('zadanie pojawia się w dzisiejszej kolumnie kalendarza', (await page.locator('.cal-day.today .cal-task', { hasText: 'zz-C' }).count()) === 1);
  await page.getByRole('tab', { name: /Bez terminu/ }).click(); await page.waitForSelector('.overdue-card');

  // wykonanie
  await page.locator('.overdue-card', { hasText: 'zz-D' }).getByRole('checkbox').click(); await page.waitForTimeout(600);
  check('wykonanie zdejmuje kartę i zapisuje się', !(await mine()).includes('zz-D') && (await call('GET', `/projects/${proj.id}`)).checklists[1].tasks.find((t) => t.id === tD.id).completed === true);

  // realtime: ktoś inny usuwa termin zadaniu z kalendarza -> pojawia się w „Bez terminu”
  await call('PATCH', `/tasks/${tC.id}`, { dueDate: null }, { 'x-client-id': 'inny-klient' });
  await page.waitForTimeout(1500);
  check('zadanie, któremu ktoś usunął termin, pojawia się na żywo', (await mine()).includes('zz-C'));
  await call('PATCH', `/tasks/${tA.id}/completed`, { completed: true }, { 'x-client-id': 'inny-klient' });
  await page.waitForTimeout(1500);
  check('wykonanie przez kogoś innego zdejmuje kartę na żywo', !(await mine()).includes('zz-A'));
  await call('PATCH', `/tasks/${tC.id}`, { dueDate: iso(2) }, { 'x-client-id': 'inny-klient' });
  await page.waitForTimeout(1500);
  check('ustawienie terminu przez kogoś innego też', !(await mine()).includes('zz-C'));

  // ciemny motyw + telefon
  await page.locator('.theme-switch').click(); await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/undated-dark.png`, clip: { x: 0, y: 700, width: 1900, height: 500 } });
  await page.locator('.theme-switch').click();
  await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(400);
  const probe = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, cols: getComputedStyle(document.querySelector('.overdue-grid')).gridTemplateColumns.split(' ').length }));
  check('telefon: jedna kolumna, bez poziomego scrolla', probe.sw <= probe.vw && probe.cols === 1, JSON.stringify(probe));
  check('brak błędów w konsoli', problems.length === 0, problems.join(' | '));
} finally {
  await call('DELETE', `/projects/${proj.id}`);
  await call('DELETE', `/users/${user.id}`);
  await call('DELETE', `/tasks/${tInne.id}`);
  await browser.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
