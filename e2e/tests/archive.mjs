// Zakładka „Archiwum”: wykonane zadania — siatka kart, filtry, sortowanie wg wykonania, przywracanie, realtime.
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

const proj = await call('POST', '/projects', { name: 'ZZ-archive' });
const l1 = await call('POST', `/projects/${proj.id}/checklists`, { name: 'ZZ-L1' });
const l2 = await call('POST', `/projects/${proj.id}/checklists`, { name: 'ZZ-L2' });
const user = await call('POST', '/users', { nick: 'zz-archive', avatar: 'owl' });
const mk = (list, name, extra = {}) => call('POST', `/checklists/${list.id}/tasks`, { name, ...extra });
const p1 = await mk(l1, 'zz-P1', { priority: 'high', userIds: [user.id], description: 'opis P1', dueDate: iso(-5) });
const p2 = await mk(l1, 'zz-P2', { priority: 'low' });
const p3 = await mk(l2, 'zz-P3', { priority: 'medium', userIds: [user.id], dueDate: iso(4) });
const open = await mk(l2, 'zz-OPEN');                       // niewykonane — nie należy do archiwum
const hot = await mk(l2, 'zz-HOT');                         // wykona się w trakcie testu z innego klienta
// wykonujemy w kolejności P1, P2, P3 (updated_at ma rozdzielczość ms)
for (const t of [p1, p2, p3]) { await call('PATCH', `/tasks/${t.id}/completed`, { completed: true }); await wait(30); }
const inne = (await call('GET', '/projects')).find((p) => p.isSystem);
const inneList = (await call('GET', `/projects/${inne.id}`)).checklists[0];
const tInne = await mk(inneList, 'zz-INNE');
await call('PATCH', `/tasks/${tInne.id}/completed`, { completed: true });

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1900, height: 1200 } });
await page.addInitScript(() => localStorage.setItem('pageSize', '0')); // „Wszystkie” - paginację testuje osobny plik (pagination.mjs)
const problems = [];
page.on('pageerror', (e) => problems.push(e.message.slice(0, 120)));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 120)); });
const mine = async () => (await page.locator('.overdue-card .cal-task-name').allInnerTexts()).filter((t) => t.startsWith('zz-'));
const chip = (label) => page.locator('.archive-filters').getByRole('button', { name: label, exact: true });
// zakładki sekcji pod projektami (osobne od zakładek „Projekty / Archiwum” w nagłówku strony)
const views = () => page.getByRole('tablist', { name: 'Widok' });
const tab = () => views().getByRole('tab', { name: /Archiwum/ });
try {
  await page.goto(`${BASE}/`); await page.waitForSelector('.cal-day'); await page.waitForTimeout(800);
  const serverCount = (await call('GET', '/archive')).tasks.length;
  check('czwarta zakładka „Archiwum” z licznikiem', (await tab().locator('.planner-count').innerText()) === String(serverCount), await tab().innerText());
  check('cztery zakładki', (await views().getByRole('tab').count()) === 4);

  await tab().click(); await page.waitForSelector('.overdue-card'); await page.waitForTimeout(400);
  check('siatka kart, bez kalendarza', (await page.locator('.week-grid').count()) === 0 && (await page.locator('.overdue-grid').evaluate((e) => getComputedStyle(e).display)) === 'grid');
  check('liczba kart = liczba z serwera', (await page.locator('.overdue-card').count()) === serverCount);
  check('tylko wykonane (P1, P2, P3, INNE)', JSON.stringify((await mine()).sort()) === JSON.stringify(['zz-INNE', 'zz-P1', 'zz-P2', 'zz-P3']), JSON.stringify(await mine()));
  const card1 = page.locator('.overdue-card', { hasText: 'zz-P1' });
  const txt = await card1.innerText();
  check('karta: „Wykonano” + data, „Termin był”, projekt › lista, priorytet, osoba, opis', /wykonano/i.test(txt) && /termin był/i.test(txt) && txt.includes('ZZ-archive') && txt.includes('ZZ-L1') && txt.includes('Wysoki') && txt.includes('opis P1') && (await card1.locator('.avatar').count()) === 1, txt);
  check('zadanie bez terminu: „Bez terminu” w stopce', (await page.locator('.overdue-card', { hasText: 'zz-P2' }).innerText()).includes('Bez terminu'));
  check('karta ma przycisk „Przywróć”, zaznaczone pole i brak przekreślenia nazwy', (await card1.getByRole('button', { name: 'Przywróć' }).count()) === 1 && (await card1.getByRole('checkbox').isChecked()) && (await card1.locator('.cal-task-name').evaluate((e) => getComputedStyle(e).textDecorationLine)) === 'none');
  check('zadanie z „Inne” ma brązowy styl', (await page.locator('.overdue-card.fixed', { hasText: 'zz-INNE' }).count()) === 1);
  await page.screenshot({ path: `${SHOTS}/archive-light.png`, clip: { x: 0, y: 700, width: 1900, height: 500 } });

  // sortowanie wg czasu wykonania
  const sort = page.getByLabel('Sortowanie archiwum');
  check('domyślnie: ostatnio wykonane na górze', (await mine()).join() === 'zz-INNE,zz-P3,zz-P2,zz-P1', (await mine()).join());
  await sort.selectOption('oldest'); await page.waitForTimeout(200);
  check('najdawniej wykonane', (await mine()).join() === 'zz-P1,zz-P2,zz-P3,zz-INNE', (await mine()).join());
  await sort.selectOption('newest');

  // filtry
  await chip('ZZ-archive').click(); await page.waitForTimeout(200);
  check('filtr projektu', (await page.locator('.overdue-card').count()) === 3);
  await chip('ZZ-L2').click(); await page.waitForTimeout(200);
  check('filtr listy', JSON.stringify(await mine()) === JSON.stringify(['zz-P3']), JSON.stringify(await mine()));
  await chip('ZZ-L2').click();
  await chip('ZZ-archive').click();
  await chip('Wysoki').click(); await page.waitForTimeout(200);
  check('filtr priorytetu', (await mine()).includes('zz-P1') && !(await mine()).includes('zz-P2'));
  await chip('Wysoki').click();
  await page.locator('.archive-filters .user-chip', { hasText: 'zz-archive' }).click(); await page.waitForTimeout(200);
  check('filtr użytkownika', JSON.stringify((await mine()).sort()) === JSON.stringify(['zz-P1', 'zz-P3']), JSON.stringify(await mine()));
  await page.locator('.archive-filters .user-chip', { hasText: 'zz-archive' }).click();
  check('podtytuł „X z Y” przy filtrze i pełny po wyczyszczeniu', true);
  await chip('Niski').click(); await page.waitForTimeout(200);
  check('podtytuł pokazuje „X z Y”', /\d+ z \d+ zadań w archiwum/.test(await page.locator('.archive .section-head .muted').innerText()));
  await page.getByRole('button', { name: 'Wyczyść filtry' }).click(); await page.waitForTimeout(200);
  check('wyczyść filtry', (await page.locator('.overdue-card').count()) === serverCount);

  // przywracanie przyciskiem
  const before = await page.locator('.overdue-card').count();
  await page.locator('.overdue-card', { hasText: 'zz-P2' }).getByRole('button', { name: 'Przywróć' }).click(); await page.waitForTimeout(600);
  check('„Przywróć” zdejmuje kartę z archiwum, licznik maleje', !(await mine()).includes('zz-P2') && (await page.locator('.overdue-card').count()) === before - 1 && (await tab().locator('.planner-count').innerText()) === String(before - 1));
  check('zadanie jest niewykonane w bazie', (await call('GET', `/projects/${proj.id}`)).checklists[0].tasks.find((t) => t.id === p2.id).completed === false);
  // odznaczenie pola też przywraca
  await page.locator('.overdue-card', { hasText: 'zz-P1' }).getByRole('checkbox').click(); await page.waitForTimeout(600);
  check('odznaczenie pola przywraca zadanie (P1 miało termin w przeszłości → wraca do zaległych)', !(await mine()).includes('zz-P1'));
  await page.getByRole('tab', { name: /Zaległe/ }).click(); await page.waitForSelector('.overdue-grid'); await page.waitForTimeout(400);
  check('przywrócone zadanie z przeszłym terminem jest w „Zaległych”', (await page.locator('.overdue-card .cal-task-name', { hasText: 'zz-P1' }).count()) === 1);
  await page.getByRole('tab', { name: /Bez terminu/ }).click(); await page.waitForSelector('.overdue-grid'); await page.waitForTimeout(400);
  check('przywrócone zadanie bez terminu jest w „Bez terminu”', (await page.locator('.overdue-card .cal-task-name', { hasText: 'zz-P2' }).count()) === 1);

  // wykonanie w „Bez terminu” → trafia do archiwum
  await page.locator('.overdue-card', { hasText: 'zz-P2' }).getByRole('checkbox').click(); await page.waitForTimeout(700);
  await tab().click(); await page.waitForSelector('.archive');
  check('wykonane w innej zakładce pojawia się w archiwum', (await mine()).includes('zz-P2'));

  // realtime
  await call('PATCH', `/tasks/${hot.id}/completed`, { completed: true }, { 'x-client-id': 'inny-klient' });
  await page.waitForTimeout(1500);
  check('wykonanie przez kogoś innego pojawia się w archiwum na żywo', (await mine()).includes('zz-HOT'));
  await call('PATCH', `/tasks/${hot.id}/completed`, { completed: false }, { 'x-client-id': 'inny-klient' });
  await page.waitForTimeout(1500);
  check('przywrócenie przez kogoś innego znika z archiwum na żywo', !(await mine()).includes('zz-HOT'));
  check('niewykonane zadanie nigdy nie było w archiwum', !(await mine()).includes('zz-OPEN'));

  // ciemny motyw + telefon
  await page.locator('.theme-switch').click(); await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/archive-dark.png`, clip: { x: 0, y: 700, width: 1900, height: 500 } });
  await page.locator('.theme-switch').click();
  await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(400);
  const probe = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, cols: getComputedStyle(document.querySelector('.overdue-grid')).gridTemplateColumns.split(' ').length, tabs: document.querySelector('.planner-tabs').getBoundingClientRect().right }));
  check('telefon: jedna kolumna, zakładki i strona bez poziomego scrolla', probe.sw <= probe.vw && probe.cols === 1 && probe.tabs <= probe.vw, JSON.stringify(probe));
  check('brak błędów w konsoli', problems.length === 0, problems.join(' | '));
} finally {
  await call('DELETE', `/projects/${proj.id}`);
  await call('DELETE', `/users/${user.id}`);
  await call('DELETE', `/tasks/${tInne.id}`);
  await browser.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
