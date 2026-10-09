// Paginacja w zakładkach „Zaległe”, „Bez terminu” i „Archiwum”: rozmiar strony, nawigacja, reset przy zmianie filtra/sortowania,
// przycinanie strony przy kurczeniu się listy, „Wszystkie”, zapamiętanie rozmiaru, telefon.
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

// ZZ-projekt z 60 zadaniami bez terminu, 30 zaległymi i 30 wykonanymi — każda zakładka ma więcej pozycji niż strona (24)
const proj = await call('POST', '/projects', { name: 'ZZ-pagination' });
const list = await call('POST', `/projects/${proj.id}/checklists`, { name: 'ZZ-L' });
const undated = await call('POST', `/checklists/${list.id}/tasks/bulk`, { items: Array.from({ length: 60 }, (_, i) => ({ name: `zz-u-${pad(i + 1)}` })) });
for (let i = 1; i <= 30; i++) await call('POST', `/checklists/${list.id}/tasks`, { name: `zz-o-${pad(i)}`, dueDate: iso(-i) });
for (let i = 1; i <= 30; i++) await call('POST', `/checklists/${list.id}/tasks`, { name: `zz-d-${pad(i)}`, completed: true });

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1900, height: 1200 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message.slice(0, 120)));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 120)); });
const cards = () => page.locator('.overdue-card').count();
const names = async () => page.locator('.overdue-card .cal-task-name').allInnerTexts();
const range = () => page.locator('.pagination-range').innerText();
const pageBtn = (n) => page.getByRole('button', { name: `Strona ${n}`, exact: true });
const next = () => page.getByRole('button', { name: 'Następna strona' });
const prev = () => page.getByRole('button', { name: 'Poprzednia strona' });
const size = () => page.getByLabel('Liczba pozycji na stronie');
const views = () => page.getByRole('tablist', { name: 'Widok' });
const chip = (label) => page.locator('.undated-filters').getByRole('button', { name: label, exact: true });
try {
  await page.goto(`${BASE}/`); await page.waitForSelector('.cal-day');
  check('domyślny rozmiar strony to 24 (nic nie zapisane)', (await page.evaluate(() => localStorage.getItem('pageSize'))) === null);
  await views().getByRole('tab', { name: /Bez terminu/ }).click(); await page.waitForSelector('.overdue-card'); await page.waitForTimeout(300);

  const total = (await call('GET', '/undated')).tasks.length;
  const pages = Math.ceil(total / 24);
  check(`„Bez terminu”: 24 karty na stronie (z ${total}), jest paginacja`, (await cards()) === 24 && (await page.locator('nav.pagination').count()) === 1);
  check('zakres „Pozycje 1–24 z N”', (await range()).replace(/\s+/g, ' ') === `Pozycje 1–24 z ${total}`, await range());
  check('liczba numerków stron = ceil(N/24) (z wielokropkiem)', (await pageBtn(1).count()) === 1 && (await pageBtn(pages).count()) === 1, String(pages));
  check('na pierwszej stronie „Poprzednia” wyłączona, aktualna oznaczona', (await prev().isDisabled()) && (await pageBtn(1).getAttribute('aria-current')) === 'page');
  const first1 = (await names())[0];
  await page.screenshot({ path: `${SHOTS}/pagination-light.png`, clip: { x: 0, y: 700, width: 1900, height: 500 }, fullPage: true });

  await next().click(); await page.waitForTimeout(300);
  check('„Następna” → strona 2: zakres 25–48 i inne karty', (await range()).includes('25–48') && (await names())[0] !== first1 && (await pageBtn(2).getAttribute('aria-current')) === 'page', await range());
  await pageBtn(pages).click(); await page.waitForTimeout(300);
  const lastCount = total - 24 * (pages - 1);
  check('ostatnia strona: „Następna” wyłączona, reszta kart', (await next().isDisabled()) && (await cards()) === lastCount && (await range()).includes(`${24 * (pages - 1) + 1}–${total}`), `${await cards()} / ${lastCount} ${await range()}`);
  await prev().click(); await page.waitForTimeout(300);
  check('„Poprzednia” cofa o stronę', (await pageBtn(pages - 1).getAttribute('aria-current')) === 'page');

  // reset przy zmianie sortowania
  await page.getByLabel('Sortowanie zadań bez terminu').selectOption('newest'); await page.waitForTimeout(300);
  check('zmiana sortowania wraca na stronę 1', (await range()).includes('1–24') && (await pageBtn(1).getAttribute('aria-current')) === 'page');
  await page.getByLabel('Sortowanie zadań bez terminu').selectOption('order');

  // rozmiar strony: 12, zapamiętany
  await size().selectOption('12'); await page.waitForTimeout(300);
  check('rozmiar 12: 12 kart, zakres 1–12, zapisany w przeglądarce', (await cards()) === 12 && (await range()).includes('1–12') && (await page.evaluate(() => localStorage.getItem('pageSize'))) === '12');
  await page.reload(); await page.waitForSelector('.cal-day');
  await views().getByRole('tab', { name: /Bez terminu/ }).click(); await page.waitForSelector('.overdue-card'); await page.waitForTimeout(300);
  check('rozmiar strony przeżywa przeładowanie', (await size().inputValue()) === '12' && (await cards()) === 12);

  // filtr: tylko ZZ-projekt (60 pozycji), strona 3 → zmiana filtra wraca na 1
  await chip('ZZ-pagination').click(); await page.waitForTimeout(300);
  check('filtr projektu: 60 pozycji, 5 stron po 12', (await range()).includes('z 60') && (await pageBtn(5).count()) === 1 && (await pageBtn(6).count()) === 0);
  await next().click(); await next().click(); await page.waitForTimeout(200); // numerek „3” jest ukryty za wielokropkiem - idziemy przyciskiem
  await page.locator('.undated-filters').getByRole('button', { name: 'Brak', exact: true }).click(); await page.waitForTimeout(300);
  check('zmiana filtra wraca na stronę 1', (await range()).includes('1–12'));
  await page.locator('.undated-filters').getByRole('button', { name: 'Brak', exact: true }).click();

  // kurczenie listy: strona 5 z 5, wykonujemy 12 zadań z ostatniej strony (przez „innego klienta”) → strona przycinana do 4
  await pageBtn(5).click(); await page.waitForTimeout(300);
  const lastNames = await names();
  check('ostatnia strona zawiera 12 ostatnich zadań', lastNames.length === 12 && lastNames[11] === 'zz-u-60', lastNames.join());
  for (const t of undated.filter((x) => lastNames.includes(x.name))) await call('PATCH', `/tasks/${t.id}/completed`, { completed: true }, { 'x-client-id': 'inny-klient' });
  await page.waitForTimeout(1500);
  check('po skróceniu listy strona jest przycinana do ostatniej (4 z 4)', (await pageBtn(4).getAttribute('aria-current')) === 'page' && (await pageBtn(5).count()) === 0 && (await cards()) === 12 && (await range()).includes('z 48'), await range());

  // „Wszystkie”
  await size().selectOption('0'); await page.waitForTimeout(300);
  check('„Wszystkie”: wszystkie karty, bez numerków stron', (await cards()) === 48 && (await page.locator('.pagination-pages').count()) === 0 && (await range()).includes('1–48 z 48'));
  await size().selectOption('24');

  // mało pozycji: paginacja znika
  await chip('ZZ-pagination').click();
  await page.locator('.undated-filters').getByRole('button', { name: 'Wysoki', exact: true }).click(); await page.waitForTimeout(300);
  check('filtr zostawia 0 pozycji — brak paginacji', (await page.locator('nav.pagination').count()) === 0);
  await page.getByRole('button', { name: 'Wyczyść filtry' }).click();

  // przełączenie zakładek: strona wraca na 1, każda zakładka ma swoją paginację
  await pageBtn(2).click(); await page.waitForTimeout(200);
  await views().getByRole('tab', { name: /Zaległe/ }).click(); await page.waitForSelector('.overdue-card'); await page.waitForTimeout(300);
  const overdueTotal = (await call('GET', `/overdue?before=${iso(0)}`)).tasks.length;
  check(`„Zaległe”: strona 1, 24 karty z ${overdueTotal}, paginacja`, (await cards()) === 24 && (await range()).includes(`1–24 z ${overdueTotal}`) && (await pageBtn(1).getAttribute('aria-current')) === 'page', await range());
  await next().click(); await page.waitForTimeout(300);
  check('„Zaległe”: strona 2 działa', (await range()).includes('25–'));
  await views().getByRole('tab', { name: /^Archiwum/ }).click(); await page.waitForSelector('.overdue-card'); await page.waitForTimeout(300);
  const archTotal = (await call('GET', '/archive')).tasks.length;
  check(`„Archiwum”: strona 1, paginacja z ${archTotal} pozycji`, (await cards()) === Math.min(24, archTotal) && (await range()).includes(`z ${archTotal}`) && (await pageBtn(1).getAttribute('aria-current')) === 'page', await range());
  await page.screenshot({ path: `${SHOTS}/pagination-archive.png`, clip: { x: 0, y: 700, width: 1900, height: 500 } });

  // ciemny motyw + telefon
  await page.locator('.theme-switch').click(); await page.waitForTimeout(200);
  await page.locator('nav.pagination').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/pagination-dark.png` });
  await page.locator('.theme-switch').click();
  await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(400);
  const probe = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, navRight: document.querySelector('nav.pagination').getBoundingClientRect().right }));
  check('telefon: paginacja mieści się na ekranie', probe.sw <= probe.vw && probe.navRight <= probe.vw + 0.5, JSON.stringify(probe));
  await page.locator('nav.pagination').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/pagination-mobile.png` });
  check('brak błędów w konsoli', problems.length === 0, problems.join(' | '));
} finally {
  await call('DELETE', `/projects/${proj.id}`);
  await browser.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
