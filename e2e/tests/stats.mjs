// Statystyki: moment wykonania zadania (completed_at) i endpoint /stats/completions oraz zakładka „Statystyki”
// (ukończone dziś, suma z ostatnich dni, wykres słupkowy, mapa aktywności miesiąca, zmiana zakresów, język, telefon).
import { chromium } from 'playwright-core';
import { API, BASE, CHANNEL, SHOTS, plainFetch } from '../lib.mjs';

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

// zakres [początek dnia, początek następnego) w strefie tego komputera - tak jak liczy go przeglądarka
const startOf = (offsetDays) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offsetDays); return d; };
const stamps = async (fromOffset, toOffset) =>
  (await call('GET', `/stats/completions?from=${encodeURIComponent(startOf(fromOffset).toISOString())}&to=${encodeURIComponent(startOf(toOffset + 1).toISOString())}`)).tasks.map((t) => t.completedAt);
const todayCount = async () => (await stamps(0, 0)).length;

const N0 = await todayCount();
const P = await call('POST', '/projects', { name: 'ZZ-stats' });
const Q = await call('POST', '/projects', { name: 'ZZ-stats-arch' });
const listQ = await call('POST', `/projects/${Q.id}/checklists`, { name: 'ZZ-stats-arch-lista' });
await call('POST', `/checklists/${listQ.id}/tasks`, { name: 'zz-s-q1' });
await call('POST', `/checklists/${listQ.id}/tasks`, { name: 'zz-s-q2' }); // niewykonane: nie zmieniają dzisiejszych statystyk ukończonych
const list = await call('POST', `/projects/${P.id}/checklists`, { name: 'ZZ-stats-lista' });
const mk = (name, extra = {}) => call('POST', `/checklists/${list.id}/tasks`, { name, ...extra });
const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message.slice(0, 120)));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 120)); });
try {
  // --- API: moment wykonania ---
  const t1 = await mk('zz-s-1');
  const t2 = await mk('zz-s-2');
  check('nowe, niewykonane zadania nie liczą się do statystyk', (await todayCount()) === N0);
  await call('PATCH', `/tasks/${t1.id}/completed`, { completed: true });
  check('wykonanie zadania zwiększa dzisiejszy licznik o 1', (await todayCount()) === N0 + 1);
  const stampBefore = (await stamps(0, 0)).slice(-1)[0];
  await new Promise((r) => setTimeout(r, 30));
  await call('PATCH', `/tasks/${t1.id}/completed`, { completed: true });
  check('powtórne „wykonane” nie dubluje i nie przesuwa momentu wykonania', (await todayCount()) === N0 + 1 && (await stamps(0, 0)).slice(-1)[0] === stampBefore);
  await call('PATCH', `/tasks/${t1.id}/completed`, { completed: false });
  check('odznaczenie zadania zdejmuje je ze statystyk', (await todayCount()) === N0);
  await mk('zz-s-3', { completed: true });
  check('zadanie utworzone jako wykonane liczy się od razu', (await todayCount()) === N0 + 1);
  await call('POST', `/checklists/${list.id}/tasks/bulk`, { items: [{ name: 'zz-s-b1', completed: true }, { name: 'zz-s-b2' }] });
  check('wklejone zadania: liczą się tylko wykonane', (await todayCount()) === N0 + 2);
  const copy = await call('POST', `/projects/${P.id}/duplicate`);
  check('kopia projektu nie dubluje statystyk (zadania niewykonane)', (await todayCount()) === N0 + 2);
  await call('DELETE', `/projects/${copy.id}`);
  const day = async (offset) => (await stamps(offset, offset)).length;
  check('wczoraj i jutro bez naszych zadań (zakres dni jest dokładny)', (await day(1)) === 0);

  // --- API: walidacja i dostęp ---
  const q = (from, to) => raw('GET', `/stats/completions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  check('walidacja: from >= to → 400', (await q('2026-10-08T00:00:00.000Z', '2026-10-08T00:00:00.000Z')).status === 400);
  check('walidacja: zakres dłuższy niż 400 dni → 400', (await q('2024-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).status === 400);
  check('walidacja: zła data → 400', (await q('wczoraj', 'dzisiaj')).status === 400);
  const anon = await plainFetch(`${API}/stats/completions?from=2026-10-01T00:00:00.000Z&to=2026-10-02T00:00:00.000Z`);
  check('bez logowania → 401', anon.status === 401);

  // --- UI: karty ---
  const expectedToday = N0 + 2; // t1 (odznaczone), zz-s-3, zz-s-b1 + zadania z wcześniej wykonanych
  await page.goto(`${BASE}/?widok=statystyki`); await page.waitForSelector('.stats-grid'); await page.waitForTimeout(800);
  check('zakładka „Statystyki” jest zaznaczona i ma trzy zakładki obok siebie', (await page.getByRole('tab', { name: 'Statystyki' }).getAttribute('aria-selected')) === 'true' && (await page.locator('.page-tabs [role=tab]').count()) === 3);
  const num = async (sel) => Number((await page.locator(`${sel} .stat-number`).innerText()).trim());
  check('„Ukończone dzisiaj” = liczba z API', (await num('.stat-today')) === expectedToday, `${await num('.stat-today')} vs ${expectedToday}`);
  const apiSum = async (days) => (await stamps(1 - days, 0)).length;
  check('suma z ostatnich 7 dni (domyślnie) = liczba z API', (await num('.stat-sum')) === (await apiSum(7)), `${await num('.stat-sum')} vs ${await apiSum(7)}`);
  check('lista zakresu sumy: 7 / 14 / 30 / 90 dni, domyślnie 7', (await page.locator('.stat-sum select option').allInnerTexts()).join('|') === 'Ostatnie 7 dni|Ostatnie 14 dni|Ostatnie 30 dni|Ostatnie 90 dni' && (await page.locator('.stat-sum select').inputValue()) === '7');
  await page.locator('.stat-sum select').selectOption('90'); await page.waitForTimeout(500);
  check('zmiana zakresu sumy na 90 dni przelicza wynik', (await num('.stat-sum')) === (await apiSum(90)), `${await num('.stat-sum')} vs ${await apiSum(90)}`);
  check('średnia dziennie jest pokazana', /średnio .+ dziennie/.test(await page.locator('.stat-sum .muted').innerText()));

  // --- UI: projekty aktywne i zarchiwizowane ---
  const projectCounts = async () => { const all = await call('GET', '/projects'); return { active: all.filter((p) => !p.archivedAt && !p.isSystem).length, archived: all.filter((p) => p.archivedAt).length }; };
  const projNums = async () => ({ active: Number(await page.locator('.stat-projects .stat-metric').nth(0).locator('.stat-number').innerText()), archived: Number(await page.locator('.stat-projects .stat-metric').nth(1).locator('.stat-number').innerText()) });
  const pc0 = await projectCounts();
  check('pudełko „Projekty”: aktywne i zarchiwizowane (bez stałego „Inne”) = liczby z API', JSON.stringify(await projNums()) === JSON.stringify(pc0), `${JSON.stringify(await projNums())} vs ${JSON.stringify(pc0)}`);
  const projText = async () => (await page.locator('.stat-projects').innerText());
  check('pudełko „Projekty”: podpisy kafli i uwaga o „Inne”', (await projText()).includes('Aktywne projekty') && (await projText()).includes('Zarchiwizowane projekty') && (await projText()).includes('Bez stałego projektu „Inne”'));
  const taskTotals = async () => { const all = (await call('GET', '/projects')).filter((p) => !p.isSystem); const sum = (list) => ({ tasks: list.reduce((a, p) => a + p.taskCount, 0), done: list.reduce((a, p) => a + p.completedCount, 0) }); return { active: sum(all.filter((p) => !p.archivedAt)), archived: sum(all.filter((p) => p.archivedAt)) }; };
  const tileText = async (i) => (await page.locator('.stat-projects .stat-metric').nth(i).innerText());
  const tt = await taskTotals();
  const pct = (d, t) => (t === 0 ? 0 : Math.round((d / t) * 100));
  // bez zadań kafel pokazuje „Brak zadań” (bez procentu), inaczej „Ukończono X z Y zadań” i procent
  const tileOk = async (i, tot) => { const txt = await tileText(i); return tot.tasks === 0 ? txt.includes('Brak zadań') : txt.includes(`Ukończono ${tot.done} z ${tot.tasks} zad`) && txt.includes(`${pct(tot.done, tot.tasks)}%`); };
  check('kafel „Aktywne projekty”: „Ukończono X z Y zadań” i procent z API', await tileOk(0, tt.active), await tileText(0));
  check('kafel „Zarchiwizowane projekty”: zadania i procent z API', await tileOk(1, tt.archived), await tileText(1));
  check('kafle mają widoczny pasek postępu, a zarchiwizowany jest w stylu archiwum (przerywana obwódka)', (await page.locator('.stat-projects .stat-metric .progress').evaluateAll((els) => els.every((e) => e.getBoundingClientRect().height >= 4))) && (await page.locator('.stat-metric.archived').evaluate((e) => getComputedStyle(e).borderTopStyle)) === 'dashed');
  check('szerokość wypełnienia paska = procent postępu', await page.locator('.stat-projects .stat-metric').nth(0).locator('.progress-fill').evaluate((e, p) => Math.abs(e.getBoundingClientRect().width / e.parentElement.getBoundingClientRect().width * 100 - p) < 1.5, pct(tt.active.done, tt.active.tasks)));
  await call('POST', `/projects/${Q.id}/archive`);
  await page.waitForFunction((n) => Number(document.querySelectorAll('.stat-projects .stat-number')[1]?.textContent) === n, pc0.archived + 1, { timeout: 8000 }).catch(() => {});
  const pc1 = await projectCounts();
  const tt1 = await taskTotals();
  check('archiwizacja przenosi też zadania projektu między kaflami (liczba zadań na żywo)', tt1.archived.tasks >= tt.archived.tasks && (await tileOk(1, tt1.archived)) && (await tileOk(0, tt1.active)), await tileText(1));
  check('archiwizacja projektu zmienia liczby na żywo (aktywne −1, zarchiwizowane +1)', pc1.active === pc0.active - 1 && pc1.archived === pc0.archived + 1 && JSON.stringify(await projNums()) === JSON.stringify(pc1), JSON.stringify(await projNums()));
  check('liczby projektów są linkami do zakładek „Projekty” i „Archiwum”', (await page.locator('.stat-projects a').nth(0).getAttribute('href')) === '/' && (await page.locator('.stat-projects a').nth(1).getAttribute('href')) === '/?widok=archiwum');

  // --- UI: wykres słupkowy (jeden tydzień, przesuwanie tygodni) ---
  const monday = startOf(0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const mondayOffset = Math.round((monday - startOf(0)) / 86_400_000);
  const barValues = async () => (await page.locator('.bar-value').allInnerTexts()).map((v) => Number(v || 0));
  const rangeText = async () => (await page.locator('.week-nav-range').innerText()).trim();
  check('wykres: nie ma już listy zakresu (7/14/30), jest nawigacja tygodni', (await page.locator('.stat-chart select').count()) === 0 && (await page.getByRole('button', { name: 'Poprzedni tydzień' }).count()) === 1 && (await page.getByRole('button', { name: 'Następny tydzień' }).count()) === 1);
  check('wykres: domyślnie bieżący tydzień (od poniedziałku), 7 słupków, dzisiejszy z poprawną liczbą', (await page.locator('.bar-col').count()) === 7 && (await rangeText()).startsWith(String(monday.getDate())) && (await page.locator('.bar-col.today .bar-value').innerText()).trim() === String(expectedToday), await rangeText());
  const weekApi = (await stamps(mondayOffset, mondayOffset + 6)).length;
  check('wykres: suma słupków tygodnia = liczba z API', (await barValues()).reduce((a, b) => a + b, 0) === weekApi, `${(await barValues()).join(',')} vs ${weekApi}`);
  check('wykres: dni po dzisiejszym są puste i przygaszone', (await page.locator('.bar-col.future').count()) === 6 - ((new Date().getDay() + 6) % 7) && (await page.locator('.bar-col.future .bar.zero').count()) === (await page.locator('.bar-col.future').count()));
  check('wykres: słupek dzisiejszy ma wysokość, a każdy słupek podpowiedź', (await page.locator('.bar-col.today .bar').evaluate((e) => e.getBoundingClientRect().height)) > 0 && (await page.locator('.bar-col[title]').count()) === 7);
  check('„Ten tydzień” jest nieaktywny w bieżącym tygodniu', await page.getByRole('button', { name: 'Ten tydzień' }).isDisabled());
  const thisRange = await rangeText();
  await page.getByRole('button', { name: 'Poprzedni tydzień' }).click(); await page.waitForTimeout(500);
  const prevMonday = new Date(monday); prevMonday.setDate(prevMonday.getDate() - 7);
  const prevApi = (await stamps(mondayOffset - 7, mondayOffset - 1)).length;
  check('wykres: poprzedni tydzień (inny zakres, bez dzisiejszego słupka, suma z API)', (await rangeText()) !== thisRange && (await page.locator('.bar-col.today').count()) === 0 && (await page.locator('.bar-col').count()) === 7 && (await barValues()).reduce((a, b) => a + b, 0) === prevApi && (await rangeText()).startsWith(String(prevMonday.getDate())), await rangeText());
  check('wykres: w poprzednim tygodniu „Ten tydzień” jest aktywny', await page.getByRole('button', { name: 'Ten tydzień' }).isEnabled());
  check('przesuwanie tygodni nie zmienia sumy w sąsiednim pudełku', (await num('.stat-sum')) === (await apiSum(90)));
  await page.getByRole('button', { name: 'Następny tydzień' }).click(); await page.getByRole('button', { name: 'Następny tydzień' }).click(); await page.waitForTimeout(500);
  check('wykres: następny tydzień jest pusty', (await barValues()).every((v) => v === 0) && (await page.locator('.bar-col.future').count()) === 7);
  await page.getByRole('button', { name: 'Ten tydzień' }).click(); await page.waitForTimeout(400);
  check('wykres: „Ten tydzień” wraca do bieżącego', (await rangeText()) === thisRange && (await page.locator('.bar-col.today').count()) === 1);

  // --- UI: mapa aktywności ---
  const now = new Date();
  const monthName = (y, m) => new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(new Date(y, m, 1)).toLowerCase();
  const heatTitle = async () => (await page.locator('.heatmap-title').innerText()).toLowerCase();
  const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
  check('mapa: domyślnie bieżący miesiąc z właściwą liczbą dni', (await heatTitle()) === monthName(now.getFullYear(), now.getMonth()) && (await page.locator('.heat-cell[role=img]').count()) === daysIn(now.getFullYear(), now.getMonth()), await heatTitle());
  const todayCell = page.locator('.heat-cell.today');
  check('mapa: dzisiejsza komórka jest oznaczona i ma kolor aktywności', (await todayCell.count()) === 1 && Number(await todayCell.getAttribute('data-level')) > 0);
  check('mapa: podpowiedź mówi, ile zadań ukończono', /ukończon/.test((await todayCell.getAttribute('title')) ?? '') && (await todayCell.getAttribute('title')).includes(String(expectedToday)));
  const levels = await page.locator('.heat-cell[role=img]').evaluateAll((els) => els.map((e) => Number(e.dataset.level)));
  check('mapa: poziomy kolorów 0-4 (są puste i aktywne dni)', levels.every((l) => l >= 0 && l <= 4) && levels.some((l) => l === 0) && levels.some((l) => l > 0));
  check('mapa: kafelek dnia pokazuje numer dnia, liczbę ukończonych i nazwy zadań', (await todayCell.locator('.heat-day').innerText()).trim() === String(now.getDate()) && (await todayCell.locator('.heat-count').innerText()).trim() === String(expectedToday) && (await todayCell.locator('.heat-task').count()) >= 1 && (await todayCell.locator('.heat-task').count()) <= 2);
  check('mapa: nazwy zadań na kafelku są z dzisiaj (podpowiedź listuje je punktorami)', ((await todayCell.getAttribute('title')) ?? '').includes('• '));
  check('mapa: kafelek ma najwyżej 3 linie, a nadmiar to „+N więcej”', (await todayCell.locator('.heat-more').count()) === (expectedToday > 2 ? 1 : 0) && (expectedToday <= 2 || /^\+\d+ więcej$/.test((await todayCell.locator('.heat-more').innerText()).trim())));
  const fill = await page.evaluate(() => { const g = document.querySelector('.heat-grid').getBoundingClientRect(); const c = document.querySelector('.stat-heat').getBoundingClientRect(); const cells = [...document.querySelectorAll('.heat-grid .heat-cell[role=img]')].map((e) => e.getBoundingClientRect()); const right = Math.max(...cells.map((r) => r.right)); return { gridW: g.width, cardW: c.width, right, cardRight: c.right, cellW: cells[0].width, cellH: cells[0].height }; });
  check('mapa: kafelki wypełniają szerokość karty (prawa krawędź przy krawędzi karty) i są duże', fill.cardRight - fill.right < 40 && fill.cellW > 80 && fill.cellH > 60, JSON.stringify(fill));
  check('mapa: „Ten miesiąc” jest nieaktywny w bieżącym miesiącu', await page.getByRole('button', { name: 'Ten miesiąc' }).isDisabled());
  await page.getByRole('button', { name: 'Poprzedni miesiąc' }).click(); await page.waitForTimeout(500);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  check('mapa: poprzedni miesiąc (nazwa i liczba dni)', (await heatTitle()) === monthName(prev.getFullYear(), prev.getMonth()) && (await page.locator('.heat-cell[role=img]').count()) === daysIn(prev.getFullYear(), prev.getMonth()));
  check('mapa: w poprzednim miesiącu nie ma dzisiejszej komórki, a „Ten miesiąc” działa', (await page.locator('.heat-cell.today').count()) === 0 && (await page.getByRole('button', { name: 'Ten miesiąc' }).isEnabled()));
  await page.getByRole('button', { name: 'Następny miesiąc' }).click(); await page.getByRole('button', { name: 'Następny miesiąc' }).click(); await page.waitForTimeout(400);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  check('mapa: następny miesiąc jest pusty', (await heatTitle()) === monthName(next.getFullYear(), next.getMonth()) && (await page.locator('.heat-cell[role=img][data-level="0"]').count()) === daysIn(next.getFullYear(), next.getMonth()));
  await page.getByRole('button', { name: 'Ten miesiąc' }).click(); await page.waitForTimeout(300);
  check('mapa: „Ten miesiąc” wraca do bieżącego', (await heatTitle()) === monthName(now.getFullYear(), now.getMonth()));
  await page.screenshot({ path: `${SHOTS}/stats-desktop.png` });

  // --- UI: realtime (wykonanie przez kogoś innego odświeża liczby bez przeładowania) ---
  await call('PATCH', `/tasks/${t2.id}/completed`, { completed: true });
  await page.waitForFunction((n) => Number(document.querySelector('.stat-today .stat-number')?.textContent) === n, expectedToday + 1, { timeout: 8000 }).catch(() => {});
  check('wykonanie zadania w innym miejscu odświeża „dzisiaj” na żywo', (await num('.stat-today')) === expectedToday + 1, `${await num('.stat-today')}`);

  // --- UI: karta projektów i inne zakładki dalej działają ---
  await page.getByRole('tab', { name: /^Projekty/ }).click(); await page.waitForSelector('.project-card');
  check('powrót na „Projekty”: lista projektów i kalendarz widoczne, statystyk nie ma', (await page.locator('.stats-grid').count()) === 0 && (await page.locator('.cal-day').count()) > 0);
  await page.getByRole('tab', { name: 'Statystyki' }).click(); await page.waitForSelector('.stats-grid');
  check('na „Statystykach” nie ma wyszukiwarki projektów ani kalendarza', (await page.locator('input.search').count()) === 0 && (await page.locator('.cal-day').count()) === 0);

  // --- UI: angielski ---
  await page.locator('.lang-select').selectOption('en'); await page.waitForSelector('.stats-grid'); await page.waitForTimeout(500);
  check('EN: zakładka i tytuły pudełek', (await page.getByRole('tab', { name: 'Statistics' }).count()) === 1 && (await page.getByRole('heading', { name: 'Completed today' }).count()) === 1 && (await page.getByRole('heading', { name: 'Completed in the week' }).count()) === 1);
  check('EN: nawigacja tygodni wykresu', (await page.getByRole('button', { name: 'Previous week' }).count()) === 1 && (await page.getByRole('button', { name: 'This week' }).count()) === 1 && /^\d+ – \d+ [A-Z][a-z]+ \d{4}$|^\d+ [A-Z][a-z]+ – \d+ [A-Z][a-z]+ \d{4}$/.test(await page.locator('.week-nav-range').innerText()), await page.locator('.week-nav-range').innerText());
  check('EN: „+N more” na kafelku, jeśli dzień ma więcej niż 2 zadania', (await page.locator('.heat-cell.today .heat-more').count()) === 0 || /^\+\d+ more$/.test((await page.locator('.heat-cell.today .heat-more').innerText()).trim()));
  check('EN: lista zakresu i podpis', (await page.locator('.stat-sum select option').first().innerText()) === 'Last 7 days' && /per day on average/.test(await page.locator('.stat-sum .muted').innerText()));
  check('EN: mapa aktywności (miesiąc i legenda)', /^[A-Z][a-z]+ \d{4}$/.test((await page.locator('.heatmap-title').innerText()).trim()) && (await page.locator('.heat-legend').innerText()).includes('Less'));
  check('EN: podpowiedź komórki po angielsku', /tasks? completed/.test((await page.locator('.heat-cell.today').getAttribute('title')) ?? ''));
  await page.locator('.lang-select').selectOption('pl');

  // --- telefon ---
  await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(400);
  const probe = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
  check('telefon: bez poziomego scrolla, trzy zakładki w jednym rzędzie', probe.sw <= probe.vw && (await page.evaluate(() => { const t = [...document.querySelectorAll('.page-tabs [role=tab]')].map((e) => Math.round(e.getBoundingClientRect().top)); return new Set(t).size === 1; })), JSON.stringify(probe));
  await page.screenshot({ path: `${SHOTS}/stats-mobile.png`, fullPage: true });
  check('brak błędów w konsoli', problems.length === 0, problems.join(' | '));
} finally {
  await call('DELETE', `/projects/${Q.id}`);
  await call('DELETE', `/projects/${P.id}`);
  await browser.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
