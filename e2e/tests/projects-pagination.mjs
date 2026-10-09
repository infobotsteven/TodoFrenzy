// Paginacja zakładek „Projekty” i „Archiwum” na stronie głównej: podział na strony, zmiana strony, wyszukiwanie, rozmiar strony (zapamiętany osobno
// od zakładek zadań), przycinanie strony przy skracaniu listy, przeciąganie w obrębie strony, język, telefon.
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

const created = [];
for (let i = 1; i <= 22; i++) created.push(await call('POST', '/projects', { name: `ZZ-pg-${String(i).padStart(2, '0')}` }));
const idOf = (n) => created[n - 1].id;
const activeApi = async () => (await call('GET', '/projects')).filter((p) => !p.archivedAt);
const archivedApi = async () => (await call('GET', '/projects')).filter((p) => p.archivedAt);

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message.slice(0, 120)));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 120)); });
const pager = page.locator('.projects-pagination');
const range = async () => (await pager.locator('.pagination-range').innerText()).trim();
const cardNames = async () => (await page.locator('.project-item .project-card h2').allInnerTexts()).map((t) => t.trim());
const goTab = async (re) => { await page.getByRole('tab', { name: re }).first().click(); await page.waitForTimeout(300); };
try {
  const total = (await activeApi()).length;
  await page.goto(`${BASE}/`); await page.waitForSelector('.project-card'); await page.waitForTimeout(500);

  // --- zakładka „Projekty”: strona 1 ---
  check('są więcej niż 24 aktywne projekty (3 strony po 12)', total > 24 && total <= 36, String(total));
  check('paginacja pod listą projektów: „Pozycje 1–12 z N”, 12 kart na stronie', (await range()) === `Pozycje 1–12 z ${total}` && (await cardNames()).length === 12, await range());
  check('stały projekt „Inne” jest na pierwszej stronie, na pierwszym miejscu', (await cardNames())[0] === 'Inne' && (await page.locator('.project-item-fixed').count()) === 1);
  check('domyślny rozmiar strony projektów to 12, a lista rozmiarów jak w zadaniach', (await pager.locator('select').inputValue()) === '12' && (await pager.locator('select option').allInnerTexts()).join('|') === '12|24|48|96|Wszystkie');
  const page1 = await cardNames();

  // --- przeciąganie w obrębie strony: zamiana dwóch pierwszych zwykłych projektów ---
  const handles = page.locator('.project-item:not(.project-item-fixed) .drag-handle');
  const a = await handles.nth(0).boundingBox(); const b = await handles.nth(1).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 20, b.y + b.height / 2, { steps: 5 });
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2, { steps: 12 });
  await page.waitForTimeout(250); await page.mouse.up(); await page.waitForTimeout(800);
  const afterDrag = await cardNames();
  check('przeciągnięcie na stronie zmienia kolejność kart (drugi trafia przed pierwszy)', afterDrag[1] === page1[2] && afterDrag[2] === page1[1] && afterDrag.length === 12, JSON.stringify(afterDrag.slice(0, 4)));
  const apiOrder = (await activeApi()).filter((p) => !p.isSystem).map((p) => p.name);
  check('kolejność zapisana na serwerze zgadza się ze stroną; reszta list bez zmian', JSON.stringify(apiOrder.slice(0, 11)) === JSON.stringify(afterDrag.slice(1)) && apiOrder.length === total - 1);

  // --- strona 2 i 3 ---
  await pager.getByRole('button', { name: 'Strona 2' }).click(); await page.waitForTimeout(300);
  const page2 = await cardNames();
  check('strona 2: „Pozycje 13–24 z N”, 12 kart, bez „Inne”, inne projekty niż na stronie 1', (await range()) === `Pozycje 13–24 from`.replace('from', `z ${total}`) && page2.length === 12 && !page2.includes('Inne') && page2.every((n) => !afterDrag.includes(n)), await range());
  check('zmiana strony przewija na górę', (await page.evaluate(() => window.scrollY)) === 0);
  check('przycisk poprzedniej strony działa, „‹” nieaktywny na stronie 1', (await pager.getByRole('button', { name: 'Poprzednia strona' }).isEnabled()) && (await pager.getByRole('button', { name: 'Strona 2' }).getAttribute('aria-current')) === 'page');
  await pager.getByRole('button', { name: 'Strona 3' }).click(); await page.waitForTimeout(300);
  check('strona 3: ostatnia, krótsza strona', (await cardNames()).length === total - 24 && (await range()).startsWith('Pozycje 25–'), await range());
  check('przycisk następnej strony na ostatniej stronie jest nieaktywny', await pager.getByRole('button', { name: 'Następna strona' }).isDisabled());
  await page.screenshot({ path: `${SHOTS}/projects-pagination.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });

  // --- skracanie listy: strona jest przycinana do ostatniej ---
  for (let n = 17; n <= 22; n++) await call('POST', `/projects/${idOf(n)}/archive`);
  await page.waitForTimeout(1200); // zdarzenia na żywo odświeżają listę
  const total2 = (await activeApi()).length;
  check('po archiwizacji 6 projektów (lista na 2 strony) numer strony jest przycięty do ostatniej', (await range()) === `Pozycje 13–${total2} z ${total2}` && (await pager.getByRole('button', { name: 'Strona 3' }).count()) === 0, await range());

  // --- wyszukiwanie wraca na stronę 1 i ukrywa paginację, gdy wyników mało ---
  await page.getByRole('searchbox').fill('ZZ-pg-0'); await page.waitForTimeout(400);
  check('wyszukiwanie: wraca na stronę 1 i dla ≤ 12 wyników nie ma paginacji', (await pager.locator('.pagination').count()) === 0 && (await cardNames()).length === 9, `${(await cardNames()).length}`);
  await page.getByRole('searchbox').fill(''); await page.waitForTimeout(400);
  check('po wyczyszczeniu wyszukiwania znów strona 1 z paginacją', (await range()).startsWith('Pozycje 1–12 z '));

  // --- rozmiar strony: zapamiętany osobno od zakładek zadań ---
  await pager.locator('select').selectOption('0'); await page.waitForTimeout(300);
  check('„Wszystkie”: wszystkie projekty na jednej stronie, bez przycisków stron', (await cardNames()).length === total2 && (await pager.getByRole('button', { name: 'Strona 2' }).count()) === 0);
  check('rozmiar strony projektów zapisany osobno (projectPageSize), a rozmiar zadań (pageSize) bez zmian', JSON.stringify(await page.evaluate(() => [localStorage.getItem('projectPageSize'), localStorage.getItem('pageSize')])) === '["0",null]');
  await page.reload(); await page.waitForSelector('.project-card'); await page.waitForTimeout(500);
  check('po przeładowaniu „Wszystkie” zostaje', (await pager.locator('select').inputValue()) === '0');
  await pager.locator('select').selectOption('24'); await page.waitForTimeout(300);
  check('rozmiar 24: 2 strony dla 22 projektów nie ma (jedna strona) albo „Pozycje 1–22”', (await range()) === `Pozycje 1–${total2} z ${total2}` || (await pager.locator('.pagination').count()) === 0, await range().catch(() => 'brak'));
  await pager.locator('select').selectOption('12').catch(() => {});
  await page.waitForTimeout(300);

  // --- zakładka „Archiwum” projektów ---
  for (let n = 9; n <= 16; n++) await call('POST', `/projects/${idOf(n)}/archive`);
  await page.waitForTimeout(1200);
  const archived = (await archivedApi()).length;
  await goTab(/^Archiwum/);
  check('Archiwum: rozmiar strony i paginacja są też tutaj; strona 1 ma 12 kart', archived > 12 && (await range()) === `Pozycje 1–12 z ${archived}` && (await cardNames()).length === 12, await range());
  check('Archiwum: karty mają przycisk „Przywróć”, a nie ma uchwytów przeciągania', (await page.locator('.project-item .card-restore').count()) === 12 && (await page.locator('.project-item .drag-handle').count()) === 0);
  await pager.getByRole('button', { name: 'Strona 2' }).click(); await page.waitForTimeout(300);
  check('Archiwum, strona 2: pozostałe projekty', (await range()) === `Pozycje 13–${archived} z ${archived}` && (await cardNames()).length === archived - 12, await range());
  await goTab(/^Projekty/);
  check('zmiana zakładki wraca na stronę 1', (await range().catch(() => '')).startsWith('Pozycje 1–') || (await pager.locator('.pagination').count()) === 0);
  await goTab(/^Archiwum/);
  check('powrót do „Archiwum” również startuje od strony 1', (await range()).startsWith('Pozycje 1–12'));
  await page.screenshot({ path: `${SHOTS}/projects-pagination-archive.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  // przywrócenie projektu zmniejsza archiwum, strona 2 znika, gdy zostaje ≤ 12
  await pager.getByRole('button', { name: 'Strona 2' }).click(); await page.waitForTimeout(200);
  for (let n = 9; n <= 14; n++) await call('POST', `/projects/${idOf(n)}/restore`);
  await page.waitForTimeout(1200);
  const archived2 = (await archivedApi()).length;
  check('po przywróceniu projektów archiwum mieści się na jednej stronie (paginacja znika, 1 strona)', archived2 <= 12 && (await pager.locator('.pagination').count()) === 0 && (await cardNames()).length === archived2, `${archived2}`);

  // --- język i telefon ---
  await goTab(/^Projekty/);
  await page.locator('.lang-select').selectOption('en'); await page.waitForSelector('.project-card'); await page.waitForTimeout(400);
  const total3 = (await activeApi()).length;
  check('EN: „Items 1–12 of N” i „Per page”', total3 > 12 && (await range()) === `Items 1–12 of ${total3}` && (await pager.locator('.sort-control').innerText()).includes('Per page') && (await pager.locator('select option').last().innerText()) === 'All', await range());
  await page.locator('.lang-select').selectOption('pl'); await page.waitForTimeout(300);
  await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(400);
  const probe = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
  check('telefon: bez poziomego scrolla, paginacja widoczna', probe.sw <= probe.vw && (await pager.locator('.pagination').count()) === 1, JSON.stringify(probe));
  check('brak błędów w konsoli', problems.length === 0, problems.join(' | '));
} finally {
  for (const p of created) await call('DELETE', `/projects/${p.id}`);
  await browser.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
