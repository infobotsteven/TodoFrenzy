// Archiwizacja projektów: zakładka „Archiwum” projektów, zadania w archiwum zadań, brak w kalendarzu/zaległych/bez terminu,
// filtr „Projekty archiwalne”, przywracanie całego projektu (także z karty zadania), reguły „Inne”.
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
const iso = (add) => { const d = new Date(); d.setDate(d.getDate() + add); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

const A = await call('POST', '/projects', { name: 'ZZ-arch-A' });   // będzie archiwizowany
const B = await call('POST', '/projects', { name: 'ZZ-arch-B' });   // zostaje aktywny
const la = await call('POST', `/projects/${A.id}/checklists`, { name: 'ZZ-la' });
const lb = await call('POST', `/projects/${B.id}/checklists`, { name: 'ZZ-lb' });
const user = await call('POST', '/users', { nick: 'zz-arch', avatar: 'fox' });
const mk = (list, name, extra = {}) => call('POST', `/checklists/${list.id}/tasks`, { name, ...extra });
const aToday = await mk(la, 'zz-A-dzis', { dueDate: iso(0), priority: 'high', userIds: [user.id] });   // w kalendarzu
const aOver = await mk(la, 'zz-A-zalegle', { dueDate: iso(-5) });                                        // zaległe
const aNone = await mk(la, 'zz-A-bez');                                                                  // bez terminu
const aDone = await mk(la, 'zz-A-done', { completed: true });                                            // wykonane
const bToday = await mk(lb, 'zz-B-dzis', { dueDate: iso(0) });
const inne = (await call('GET', '/projects')).find((p) => p.isSystem);

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1900, height: 1200 } });
await page.addInitScript(() => localStorage.setItem('pageSize', '0')); // „Wszystkie” - paginację testuje osobny plik (pagination.mjs)
const problems = [];
page.on('pageerror', (e) => problems.push(e.message.slice(0, 120)));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 120)); });
const ids = (tasks) => tasks.map((t) => t.name).filter((n) => n.startsWith('zz-'));
const calNames = async () => (await page.locator('.cal-day .cal-task-name').allInnerTexts()).filter((t) => t.startsWith('zz-'));
const gridNames = async () => (await page.locator('.overdue-card .cal-task-name').allInnerTexts()).filter((t) => t.startsWith('zz-'));
try {
  // --- API ---
  check('„Inne” nie podlega archiwizacji (403)', (await raw('POST', `/projects/${inne.id}/archive`)).status === 403);
  check('archiwizacja nieistniejącego projektu → 404', (await raw('POST', '/projects/nie-ma/archive')).status === 404);

  // --- UI: archiwizacja z okna edycji projektu ---
  await page.goto(`${BASE}/project/${A.id}`); await page.waitForSelector('.task');
  check('aktywny projekt nie ma banera archiwum', (await page.locator('.archived-banner').count()) === 0);
  await page.getByRole('button', { name: /Edytuj projekt/ }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Archiwizuj', exact: true }).click();
  await page.waitForTimeout(800);
  check('po archiwizacji powrót na stronę główną i komunikat z „Cofnij”', new URL(page.url()).pathname === '/' && (await page.locator('.toast', { hasText: 'Zarchiwizowano' }).count()) === 1 && (await page.locator('.toast-action', { hasText: 'Cofnij' }).count()) === 1);
  check('projekt ma archived_at w bazie', !!(await call('GET', `/projects/${A.id}`)).archivedAt);

  // karty projektów
  await page.waitForSelector('.cal-day');
  const cardNames = async () => (await page.locator('.project-card h2').allInnerTexts()).map((t) => t.trim());
  check('zakładka „Projekty” nie pokazuje zarchiwizowanego, aktywny zostaje', !(await cardNames()).includes('ZZ-arch-A') && (await cardNames()).includes('ZZ-arch-B'));
  await page.getByRole('tab', { name: /^Archiwum/ }).first().click(); await page.waitForTimeout(300);
  check('zakładka „Archiwum” (projekty) pokazuje go z przyciskiem „Przywróć”', (await cardNames()).includes('ZZ-arch-A') && !(await cardNames()).includes('ZZ-arch-B') && (await page.getByRole('button', { name: 'Przywróć projekt ZZ-arch-A' }).count()) === 1);
  check('karta archiwalna ma opis „Zarchiwizowano …”', (await page.locator('.project-card.archived', { hasText: 'ZZ-arch-A' }).innerText()).includes('Zarchiwizowano'));
  await page.screenshot({ path: `${SHOTS}/project-archive-tab.png`, clip: { x: 0, y: 60, width: 1900, height: 420 } });
  // przycisk powrotu na stronie projektu z archiwum prowadzi do zakładki „Archiwum”, a nie „Projekty”
  await page.locator('.project-card.archived', { hasText: 'ZZ-arch-A' }).click(); await page.waitForSelector('.back-btn');
  check('strona archiwalnego projektu: przycisk powrotu to „Archiwum”', (await page.locator('.back-btn').innerText()).trim() === 'Archiwum');
  await page.locator('.back-btn').click(); await page.waitForSelector('.project-card.archived');
  check('powrót z archiwalnego projektu otwiera zakładkę „Archiwum” (z jego kartą)', (await page.getByRole('tab', { name: /^Archiwum/ }).first().getAttribute('aria-selected')) === 'true' && (await cardNames()).includes('ZZ-arch-A'));
  await page.getByRole('tab', { name: /^Projekty/ }).click();
  await page.locator('.project-card', { hasText: 'ZZ-arch-B' }).click(); await page.waitForSelector('.back-btn');
  check('strona aktywnego projektu: przycisk powrotu to „Projekty” i wraca do zakładki „Projekty”', (await page.locator('.back-btn').innerText()).trim() === 'Projekty');
  await page.locator('.back-btn').click(); await page.waitForSelector('.project-card');
  check('powrót z aktywnego projektu otwiera „Projekty”', (await page.getByRole('tab', { name: /^Projekty/ }).getAttribute('aria-selected')) === 'true');

  // --- zadania: kalendarz, zaległe, bez terminu, archiwum ---
  check('kalendarz domyślnie NIE pokazuje zadań zarchiwizowanego projektu', !(await calNames()).includes('zz-A-dzis') && (await calNames()).includes('zz-B-dzis'), JSON.stringify(await calNames()));
  const sections = await Promise.all([call('GET', `/overdue?before=${iso(0)}`), call('GET', '/undated'), call('GET', '/archive')]);
  check('API: zaległe i bez terminu nie zawierają zadań zarchiwizowanego projektu', !ids(sections[0].tasks).includes('zz-A-zalegle') && !ids(sections[1].tasks).includes('zz-A-bez'));
  check('API: archiwum zawiera WSZYSTKIE jego zadania (także niewykonane)', ['zz-A-dzis', 'zz-A-zalegle', 'zz-A-bez', 'zz-A-done'].every((n) => ids(sections[2].tasks).includes(n)));
  check('API: zadania z flagą projectArchivedAt', sections[2].tasks.filter((t) => t.projectId === A.id).every((t) => !!t.projectArchivedAt));
  await page.getByRole('tab', { name: /Zaległe/ }).click(); await page.waitForSelector('.overdue-grid'); await page.waitForTimeout(300);
  check('UI „Zaległe”: brak zadań zarchiwizowanego projektu', !(await gridNames()).includes('zz-A-zalegle'));
  await page.getByRole('tab', { name: /Bez terminu/ }).click(); await page.waitForSelector('.overdue-grid'); await page.waitForTimeout(300);
  check('UI „Bez terminu”: brak zadań zarchiwizowanego projektu', !(await gridNames()).includes('zz-A-bez'));
  await page.getByRole('tab', { name: /^Archiwum\s*\d*$/ }).last().click(); await page.waitForSelector('.archive'); await page.waitForTimeout(400);
  check('UI archiwum zadań: wszystkie 4 zadania projektu', JSON.stringify((await gridNames()).filter((n) => n.startsWith('zz-A')).sort()) === JSON.stringify(['zz-A-bez', 'zz-A-done', 'zz-A-dzis', 'zz-A-zalegle']), JSON.stringify(await gridNames()));
  const cardBez = page.locator('.overdue-card', { hasText: 'zz-A-bez' });
  check('karta: „Projekt zarchiwizowany”, „Przywróć projekt”, pole zablokowane', /projekt zarchiwizowany/i.test(await cardBez.innerText()) && (await cardBez.getByRole('button', { name: 'Przywróć projekt' }).count()) === 1 && (await cardBez.getByRole('checkbox').isDisabled()));
  await page.screenshot({ path: `${SHOTS}/project-archive-tasks.png`, clip: { x: 0, y: 700, width: 1900, height: 500 } });

  // --- filtry w archiwum zadań: „Projekty” i „Projekty archiwalne” to osobne sekcje ---
  const archFilters = page.locator('.archive-filters');
  const archSection = archFilters.locator('.filter-row', { hasText: 'Projekty archiwalne' });
  check('archiwum zadań: sekcja „Projekty archiwalne” z zarchiwizowanym projektem', (await archSection.count()) === 1 && (await archSection.getByRole('button', { name: 'ZZ-arch-A' }).count()) === 1);
  check('archiwum zadań: zarchiwizowany projekt NIE jest wśród zwykłych chipów „Projekty”', (await archFilters.locator('.filter-row').first().getByRole('button', { name: 'ZZ-arch-A' }).count()) === 0 && (await archFilters.locator('.filter-row').first().innerText()).includes('Projekty'));
  const allBefore = (await gridNames()).length;
  await archSection.getByRole('button', { name: 'ZZ-arch-A' }).click(); await page.waitForTimeout(300);
  const onlyA = await gridNames();
  check('wybranie projektu archiwalnego zawęża archiwum do jego zadań', onlyA.length === 4 && onlyA.every((n) => n.startsWith('zz-A')), JSON.stringify(onlyA));
  const listRow = (label) => archFilters.locator('.filter-row').filter({ has: page.locator('.filter-label', { hasText: new RegExp(`^${label}$`) }) });
  check('po wyborze projektu archiwalnego pojawia się wiersz „Listy archiwalne” (a zwykłych „Listy” nie ma)', (await listRow('Listy archiwalne').count()) === 1 && (await listRow('Listy').count()) === 0);
  check('wiersz „Listy archiwalne” jest pod „Projekty archiwalne”', await page.evaluate(() => { const rows = [...document.querySelectorAll('.archive-filters .filter-row')].map((r) => r.querySelector('.filter-label').textContent); return rows.indexOf('Listy archiwalne') === rows.indexOf('Projekty archiwalne') + 1; }));
  const listsOfA = await listRow('Listy archiwalne').locator('.chip').count();
  check('listy archiwalne mają przerywane chipy', listsOfA > 0 && (await listRow('Listy archiwalne').locator('.chip.chip-archived').count()) === listsOfA);
  const activeChip = archFilters.locator('.filter-row').first().getByRole('button').first();
  await activeChip.click(); await page.waitForTimeout(300);
  check('wybór projektu aktywnego dodaje osobny wiersz „Listy”, nie miesza go z archiwalnymi', (await listRow('Listy').count()) === 1 && (await listRow('Listy archiwalne').count()) === 1 && (await listRow('Listy').locator('.chip.chip-archived').count()) === 0);
  const mixed = await gridNames();
  check('wybór chipa z obu sekcji łączy ich zadania (alternatywa)', mixed.includes('zz-A-dzis') && mixed.length >= 4, `${mixed.length}`);
  await page.getByRole('button', { name: 'Wyczyść filtry' }).click(); await page.waitForTimeout(300);
  check('„Wyczyść filtry” przywraca całe archiwum', (await gridNames()).length === allBefore);

  // --- filtr „Projekty archiwalne” w kalendarzu ---
  await page.getByRole('tab', { name: 'Kalendarz' }).click(); await page.waitForSelector('.week-grid'); await page.waitForTimeout(1500); // źródła filtrów odświeżają się po wejściu na zakładkę
  const archRow = page.locator('.cal-filters .filter-row', { hasText: 'Projekty archiwalne' });
  check('w filtrach kalendarza jest sekcja „Projekty archiwalne” z projektem', (await archRow.count()) === 1 && (await archRow.getByRole('button', { name: 'ZZ-arch-A' }).count()) === 1);
  check('archiwalny projekt nie jest wśród zwykłych chipów „Projekty”', (await page.locator('.cal-filters .filter-row').filter({ has: page.getByText('Projekty', { exact: true }) }).getByRole('button', { name: 'ZZ-arch-A' }).count()) === 0);
  await archRow.getByRole('button', { name: 'ZZ-arch-A' }).click(); await page.waitForTimeout(300);
  check('po włączeniu chipa zadanie zarchiwizowanego projektu pojawia się w kalendarzu (przygaszone)', (await calNames()).includes('zz-A-dzis') && (await page.locator('.cal-task.archived-project', { hasText: 'zz-A-dzis' }).count()) === 1);
  await page.screenshot({ path: `${SHOTS}/project-archive-calendar.png`, clip: { x: 0, y: 700, width: 1900, height: 500 } });
  // filtr priorytetu stosuje się także do archiwalnych
  await page.locator('.cal-filters').getByRole('button', { name: 'Niski', exact: true }).click(); await page.waitForTimeout(200);
  check('filtr priorytetu działa także na zadania archiwalne', !(await calNames()).includes('zz-A-dzis'));
  await page.getByRole('button', { name: 'Wyczyść filtry' }).click(); await page.waitForTimeout(300);
  check('„Wyczyść filtry” ponownie ukrywa archiwalne', !(await calNames()).includes('zz-A-dzis') && (await archRow.locator('[aria-pressed="true"]').count()) === 0);

  // --- okno dodawania zadania nie oferuje zarchiwizowanych projektów ---
  await page.getByRole('button', { name: '+ Zadanie' }).click(); await page.waitForSelector('dialog[open]'); await page.waitForTimeout(400);
  const opts = await page.locator('dialog[open] select').first().locator('option').allInnerTexts();
  check('okno „Nowe zadanie” pomija zarchiwizowane projekty', !opts.includes('ZZ-arch-A') && opts.includes('ZZ-arch-B'), JSON.stringify(opts.slice(0, 4)));
  await page.keyboard.press('Escape');

  // --- baner na stronie zarchiwizowanego projektu ---
  await page.goto(`${BASE}/project/${A.id}`); await page.waitForSelector('.task');
  check('strona zarchiwizowanego projektu ma baner z „Przywróć projekt”', (await page.locator('.archived-banner').count()) === 1);

  // --- przywrócenie CAŁEGO projektu z karty zadania w archiwum ---
  await page.goto(`${BASE}/`); await page.waitForSelector('.cal-day');
  await page.getByRole('tab', { name: /^Archiwum\s*\d*$/ }).last().click(); await page.waitForSelector('.archive'); await page.waitForTimeout(400);
  await page.locator('.overdue-card', { hasText: 'zz-A-bez' }).getByRole('button', { name: 'Przywróć projekt' }).click(); await page.waitForTimeout(900);
  check('przywrócenie zadania przywróciło cały projekt (baza)', (await call('GET', `/projects/${A.id}`)).archivedAt === null);
  const rest = await gridNames();
  check('z archiwum znikły zadania projektu poza wykonanym (zostaje zz-A-done)', JSON.stringify(rest.filter((n) => n.startsWith('zz-A'))) === JSON.stringify(['zz-A-done']), JSON.stringify(rest));
  check('wykonane zadanie jest już zwykłą kartą wykonanego zadania (z „Przywróć”)', (await page.locator('.overdue-card', { hasText: 'zz-A-done' }).getByRole('button', { name: 'Przywróć', exact: true }).count()) === 1);
  await page.getByRole('tab', { name: 'Kalendarz' }).click(); await page.waitForSelector('.week-grid'); await page.waitForTimeout(500);
  check('zadania wróciły do kalendarza', (await calNames()).includes('zz-A-dzis'));
  await page.getByRole('tab', { name: /Zaległe/ }).click(); await page.waitForSelector('.overdue-grid'); await page.waitForTimeout(300);
  check('i do „Zaległych”', (await gridNames()).includes('zz-A-zalegle'));
  await page.getByRole('tab', { name: /Bez terminu/ }).click(); await page.waitForSelector('.overdue-grid'); await page.waitForTimeout(300);
  check('i do „Bez terminu”', (await gridNames()).includes('zz-A-bez'));

  // --- przywrócenie przyciskiem z zakładki „Archiwum” projektów + realtime ---
  await call('POST', `/projects/${A.id}/archive`);              // inny klient archiwizuje
  await page.waitForTimeout(1500);
  check('archiwizacja przez kogoś innego: projekt znika z „Projektów” na żywo', !(await page.locator('.project-card h2').allInnerTexts()).map((t) => t.trim()).includes('ZZ-arch-A'));
  await page.getByRole('tab', { name: /^Archiwum/ }).first().click(); await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Przywróć projekt ZZ-arch-A' }).click(); await page.waitForTimeout(800);
  check('przycisk „Przywróć” na karcie przywraca projekt', (await call('GET', `/projects/${A.id}`)).archivedAt === null && (await page.locator('.project-card h2', { hasText: 'ZZ-arch-A' }).count()) === 0);
  await page.getByRole('tab', { name: /^Projekty/ }).click();
  check('projekt jest znów na liście aktywnych', (await page.locator('.project-card h2', { hasText: 'ZZ-arch-A' }).count()) === 1);

  // --- usuwanie zarchiwizowanego projektu działa, kopia jest aktywna ---
  await call('POST', `/projects/${A.id}/archive`);
  const copy = await call('POST', `/projects/${A.id}/duplicate`);
  check('kopia zarchiwizowanego projektu jest aktywna', copy.archivedAt === null);
  await call('DELETE', `/projects/${copy.id}`);

  // --- telefon ---
  await page.setViewportSize({ width: 390, height: 900 });
  await page.reload(); await page.waitForSelector('.cal-day');
  const probe = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
  check('telefon: bez poziomego scrolla', probe.sw <= probe.vw, JSON.stringify(probe));
  check('brak błędów w konsoli', problems.length === 0, problems.join(' | '));
} finally {
  await call('DELETE', `/projects/${A.id}`);
  await call('DELETE', `/projects/${B.id}`);
  await call('DELETE', `/users/${user.id}`);
  await browser.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
