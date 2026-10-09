import { chromium } from 'playwright-core';
import { BASE, API, CHANNEL, SHOTS } from '../lib.mjs';

const shotDir = SHOTS;
const call = async (method, path, body) => {
  const res = await fetch(API + path, { method, headers: body ? { 'content-type': 'application/json; charset=utf-8' } : {}, body: body ? JSON.stringify(body) : undefined });
  const t = await res.text();
  return t ? JSON.parse(t) : null;
};
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const x = new Date(y, m - 1, d + n); return iso(x); };
const monday = (s) => { const [y, m, d] = s.split('-').map(Number); const x = new Date(y, m - 1, d); return addDays(s, -((x.getDay() + 6) % 7)); };
const today = iso(new Date());
const wk = monday(today);

// --- dane testowe (własny projekt) ---
const p1 = await call('POST', '/projects', { name: 'ZZ-kal Alfa', color: 'indigo' });
const p2 = await call('POST', '/projects', { name: 'ZZ-kal Beta', color: 'orange' });
const l1 = await call('POST', `/projects/${p1.id}/checklists`, { name: 'Lista Pierwsza', color: 'green' });
const l2 = await call('POST', `/projects/${p1.id}/checklists`, { name: 'Lista Druga', color: 'pink' });
const l3 = await call('POST', `/projects/${p2.id}/checklists`, { name: 'Lista Beta', color: 'teal' });
const mk = (l, name, extra) => call('POST', `/checklists/${l.id}/tasks`, { name, ...extra });
const tA = await mk(l1, 'Zadanie KAL-A', { dueDate: addDays(wk, 1), priority: 'high' }); // wtorek
const tB = await mk(l1, 'Zadanie KAL-B', { dueDate: addDays(wk, 1) });
const tC = await mk(l2, 'Zadanie KAL-C', { dueDate: addDays(wk, 3) });
const tD = await mk(l3, 'Zadanie KAL-D', { dueDate: addDays(wk, 3) });
const tE = await mk(l3, 'Zadanie KAL-E', { dueDate: addDays(wk, 8) }); // przyszły tydzień
const tNo = await mk(l1, 'Zadanie KAL-BEZ-TERMINU', {});
const ids = [p1.id, p2.id];

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1300 } });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text().slice(0, 150)}`); });
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message.slice(0, 150)));
let fails = 0;
const check = (name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); };
const task = async (id) => { for (const p of ids) { const d = await call('GET', `/projects/${p}`); const t = d.checklists.flatMap((c) => c.tasks).find((x) => x.id === id); if (t) return t; } };
const dayCol = (date) => page.locator(`.cal-day[aria-label]`).nth(Math.round((Date.parse(date) - Date.parse(currentWeek)) / 86400000));
let currentWeek = wk;
const namesIn = (i) => page.locator('.cal-day').nth(i).locator('.cal-task-name').allTextContents();
const label = () => page.locator('.week-picker-btn span').innerText();

try {
  await page.goto(`${BASE}/`);
  await page.waitForSelector('.calendar');
  await page.waitForTimeout(1200);

  // 1. układ: kalendarz pod projektami
  const pos = await page.evaluate(() => ({ grid: document.querySelector('.grid').getBoundingClientRect().bottom, cal: document.querySelector('.calendar').getBoundingClientRect().top }));
  check('kalendarz jest pod projektami', pos.cal >= pos.grid - 1, JSON.stringify(pos));
  check('widok 7 dni', (await page.locator('.cal-day').count()) === 7);
  check('dzisiejszy dzień oznaczony', (await page.locator('.cal-day.today').count()) === 1 && (await page.locator('.cal-day.today .cal-today-badge').count()) === 1);
  const todayIdx = Math.round((Date.parse(today) - Date.parse(wk)) / 86400000);
  check('„dziś" jest w kolumnie właściwego dnia tygodnia', (await page.locator('.cal-day').nth(todayIdx).getAttribute('class')).includes('today'));

  // 2. zadania w kolumnach, z projektem i listą
  check('wtorek: są KAL-A i KAL-B', (await namesIn(1)).includes('Zadanie KAL-A') && (await namesIn(1)).includes('Zadanie KAL-B'), (await namesIn(1)).join());
  check('czwartek: są KAL-C i KAL-D', (await namesIn(3)).includes('Zadanie KAL-C') && (await namesIn(3)).includes('Zadanie KAL-D'), (await namesIn(3)).join());
  const all = await page.locator('.cal-task-name').allTextContents();
  check('zadanie bez terminu i z przyszłego tygodnia nie są widoczne', !all.includes('Zadanie KAL-BEZ-TERMINU') && !all.includes('Zadanie KAL-E'));
  const cardA = page.locator('.cal-task', { hasText: 'Zadanie KAL-A' });
  const originA = (await cardA.locator('.cal-origin').innerText()).replace(/\s+/g, ' ');
  check('zadanie pokazuje projekt i listę', /ZZ-kal Alfa/.test(originA) && /Lista Pierwsza/.test(originA), originA);
  check('kropki kolorów projektu i listy', (await cardA.locator('.dot[data-color="indigo"]').count()) === 1 && (await cardA.locator('.dot[data-color="green"]').count()) === 1);
  check('priorytet widoczny', (await cardA.locator('.badge').count()) === 1);
  check('nazwa projektu to link do projektu', (await cardA.locator('a').getAttribute('href')) === `/project/${p1.id}`);
  await page.screenshot({ path: `${shotDir}/cal-week.png`, fullPage: true });

  // 3. nawigacja tygodni
  const startLabel = await label();
  await page.getByRole('button', { name: 'Następny tydzień' }).click();
  await page.waitForTimeout(500);
  check('następny tydzień: zmienia zakres i pokazuje KAL-E', (await label()) !== startLabel && (await page.locator('.cal-task-name').allTextContents()).includes('Zadanie KAL-E'), await label());
  check('w następnym tygodniu nie ma zadań z poprzedniego', !(await page.locator('.cal-task-name').allTextContents()).includes('Zadanie KAL-A'));
  check('przycisk „Dziś" aktywny poza bieżącym tygodniem', await page.getByRole('button', { name: 'Dziś', exact: true }).isEnabled());
  await page.getByRole('button', { name: 'Poprzedni tydzień' }).click();
  await page.waitForTimeout(400);
  check('poprzedni tydzień wraca do bieżącego', (await label()) === startLabel);
  check('„Dziś" nieaktywny w bieżącym tygodniu', await page.getByRole('button', { name: 'Dziś', exact: true }).isDisabled());
  await page.getByRole('button', { name: 'Poprzedni tydzień' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Dziś', exact: true }).click();
  await page.waitForTimeout(400);
  check('„Dziś" wraca do bieżącego tygodnia', (await label()) === startLabel);

  // 4. wybór tygodnia z kalendarza
  await page.locator('.week-picker-btn').click();
  await page.waitForSelector('.week-picker-panel');
  check('panel wyboru tygodnia: siatka 6 tygodni', (await page.locator('.wp-row:not(.wp-weekdays)').count()) === 6);
  check('bieżący tydzień zaznaczony w miniaturze', (await page.locator('.wp-row.selected').count()) === 1);
  await page.waitForTimeout(600);
  const dotDays = await page.locator('.wp-day:has(.wp-dot)').count();
  check(`kropki przy dniach z zadaniami (${dotDays})`, dotDays >= 2);
  await page.screenshot({ path: `${shotDir}/cal-picker.png` });
  await page.getByRole('button', { name: 'Następny miesiąc' }).click();
  await page.waitForTimeout(500);
  const nextMonthDay = page.locator('.wp-day:not(.out)').nth(14);
  const pickedLabel = await nextMonthDay.getAttribute('aria-label');
  await nextMonthDay.click();
  await page.waitForTimeout(600);
  check('kliknięcie dnia w kolejnym miesiącu przenosi do jego tygodnia', (await label()) !== startLabel && (await page.locator('.week-picker-panel').count()) === 0, `${pickedLabel} -> ${await label()}`);
  const weekAfterPick = await page.locator('.cal-day').first().getAttribute('aria-label');
  check('po wyborze widać 7 dni, pierwszy to poniedziałek', (await page.locator('.cal-day').count()) === 7 && /^pon/.test(weekAfterPick), weekAfterPick);
  // Esc zamyka panel, „Dzisiejszy tydzień" wraca
  await page.locator('.week-picker-btn').click();
  await page.keyboard.press('Escape');
  check('Esc zamyka panel', (await page.locator('.week-picker-panel').count()) === 0);
  await page.locator('.week-picker-btn').click();
  await page.getByRole('button', { name: 'Dzisiejszy tydzień' }).click();
  await page.waitForTimeout(500);
  check('„Dzisiejszy tydzień" w panelu wraca do bieżącego', (await label()) === startLabel);
  await page.locator('.week-picker-btn').click();
  await page.mouse.click(5, 300);
  check('klik poza panelem zamyka go', (await page.locator('.week-picker-panel').count()) === 0);

  // 5. filtry po projektach i listach
  const countBefore = (await page.locator('.cal-task-name').allTextContents()).length;
  await page.locator('.cal-filters .chip', { hasText: 'ZZ-kal Beta' }).click();
  await page.waitForTimeout(300);
  check('filtr projektu Beta: tylko jego zadania', (await page.locator('.cal-task-name').allTextContents()).join() === 'Zadanie KAL-D', (await page.locator('.cal-task-name').allTextContents()).join());
  check('po wyborze projektu pojawiają się jego listy', (await page.locator('.cal-filters .chips[aria-label^="Listy projektu"] .chip', { hasText: 'Lista Beta' }).count()) === 1);
  await page.locator('.cal-filters .chip', { hasText: 'ZZ-kal Alfa' }).click();
  await page.waitForTimeout(300);
  check('dwa projekty: zadania obu', (await page.locator('.cal-task-name').allTextContents()).sort().join() === 'Zadanie KAL-A,Zadanie KAL-B,Zadanie KAL-C,Zadanie KAL-D');
  await page.locator('.cal-filters .chips[aria-label^="Listy projektu ZZ-kal Alfa"] .chip', { hasText: 'Lista Druga' }).click();
  await page.waitForTimeout(300);
  check('lista Druga zawęża Alfa do swoich zadań, Beta bez zmian', (await page.locator('.cal-task-name').allTextContents()).sort().join() === 'Zadanie KAL-C,Zadanie KAL-D', (await page.locator('.cal-task-name').allTextContents()).join());
  await page.screenshot({ path: `${shotDir}/cal-filters.png`, fullPage: true });
  await page.locator('.cal-filters .chip', { hasText: 'ZZ-kal Alfa' }).click(); // odznaczenie projektu zdejmuje jego listy
  await page.waitForTimeout(300);
  check('odznaczenie projektu zdejmuje jego listy z filtra', (await page.locator('.cal-task-name').allTextContents()).join() === 'Zadanie KAL-D');
  await page.getByRole('button', { name: 'Wyczyść filtry' }).click();
  await page.waitForTimeout(300);
  check('wyczyść filtry: wracają wszystkie zadania', (await page.locator('.cal-task-name').allTextContents()).length === countBefore);

  // 6. edycja terminu z okna
  await page.locator('.cal-task', { hasText: 'Zadanie KAL-B' }).locator('.cal-task-name').click();
  await page.waitForSelector('dialog[open]');
  check('okno terminu pokazuje zadanie, projekt i listę', /Zadanie KAL-B/.test(await page.locator('dialog[open]').innerText()) && /ZZ-kal Alfa/.test(await page.locator('dialog[open]').innerText()));
  await page.locator('dialog[open] input[type=date]').fill(addDays(wk, 5)); // sobota
  await page.locator('dialog[open] button[type=submit]').click();
  await page.waitForTimeout(800);
  check('po zmianie terminu zadanie jest w sobotniej kolumnie', (await namesIn(5)).includes('Zadanie KAL-B') && !(await namesIn(1)).includes('Zadanie KAL-B'));
  check('termin zapisany w bazie', (await task(tB.id)).dueDate === addDays(wk, 5));
  // przeniesienie do innego tygodnia
  await page.locator('.cal-task', { hasText: 'Zadanie KAL-B' }).locator('.cal-task-name').click();
  await page.waitForSelector('dialog[open]');
  await page.locator('dialog[open] input[type=date]').fill(addDays(wk, 10));
  await page.locator('dialog[open] button[type=submit]').click();
  await page.waitForTimeout(800);
  check('zadanie przeniesione do przyszłego tygodnia znika z bieżącego', !(await page.locator('.cal-task-name').allTextContents()).includes('Zadanie KAL-B'));
  await page.getByRole('button', { name: 'Następny tydzień' }).click();
  await page.waitForTimeout(500);
  check('...i jest w następnym tygodniu we właściwym dniu', (await namesIn(3)).includes('Zadanie KAL-B'), (await namesIn(3)).join());
  await page.getByRole('button', { name: 'Dziś', exact: true }).click();
  await page.waitForTimeout(400);

  // usunięcie terminu
  await page.locator('.cal-task', { hasText: 'Zadanie KAL-A' }).locator('.cal-task-name').click();
  await page.waitForSelector('dialog[open]');
  await page.getByRole('button', { name: 'Usuń termin' }).click();
  await page.waitForTimeout(800);
  check('usunięcie terminu zdejmuje zadanie z kalendarza, a zadanie zostaje w liście', !(await page.locator('.cal-task-name').allTextContents()).includes('Zadanie KAL-A') && (await task(tA.id)).dueDate === null && (await task(tA.id)).name === 'Zadanie KAL-A');

  // 7. przeciąganie między dniami
  const src = page.locator('.cal-task', { hasText: 'Zadanie KAL-C' });
  const handle = await src.locator('.drag-handle').boundingBox();
  const target = await page.locator('.cal-day').nth(4).boundingBox(); // piątek
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) { await page.mouse.move(handle.x + ((target.x + target.width / 2 - handle.x) * i) / 30, handle.y + ((target.y + 60 - handle.y) * i) / 30); await page.waitForTimeout(16); }
  check('podczas przeciągania dzień docelowy jest podświetlony', (await page.locator('.cal-day.over').count()) === 1);
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(900);
  check('przeciągnięcie na piątek: zadanie w piątkowej kolumnie', (await namesIn(4)).includes('Zadanie KAL-C') && !(await namesIn(3)).includes('Zadanie KAL-C'), `pt: ${await namesIn(4)} czw: ${await namesIn(3)}`);
  check('przeciągnięcie zapisało termin w bazie', (await task(tC.id)).dueDate === addDays(wk, 4), String((await task(tC.id)).dueDate));

  // 8. odznaczenie jako wykonane
  await page.locator('.cal-task', { hasText: 'Zadanie KAL-D' }).locator('.cal-check').check();
  await page.waitForTimeout(700);
  check('zaznaczenie w kalendarzu zapisuje stan wykonania', (await task(tD.id)).completed === true && (await page.locator('.cal-task.done', { hasText: 'Zadanie KAL-D' }).count()) === 1);

  // 9. odświeżanie na żywo (zmiana z „innego urządzenia")
  await fetch(`${API}/tasks/${tC.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-client-id': 'inny-klient' }, body: JSON.stringify({ dueDate: addDays(wk, 2) }) });
  await page.waitForTimeout(1200);
  check('zmiana terminu przez kogoś innego odświeża kalendarz na żywo', (await namesIn(2)).includes('Zadanie KAL-C'), `śr: ${await namesIn(2)}`);

  // 10. zmiana terminu w widoku projektu jest widoczna w kalendarzu
  await page.goto(`${BASE}/project/${p2.id}`);
  await page.waitForSelector('.task');
  await page.locator('.task', { hasText: 'Zadanie KAL-E' }).locator('.task-name').click();
  await page.waitForSelector('dialog[open]');
  await page.locator('dialog[open] input[type=date]').fill(addDays(wk, 6));
  await page.locator('dialog[open] button[type=submit]').click();
  await page.waitForTimeout(700);
  await page.getByRole('link', { name: 'Wróć do projektów' }).click();
  await page.waitForSelector('.calendar');
  await page.waitForTimeout(1000);
  check('termin ustawiony w widoku projektu pojawia się w kalendarzu (niedziela)', (await namesIn(6)).includes('Zadanie KAL-E'), (await namesIn(6)).join());

  // 11. ciemny motyw i telefon
  await page.locator('.theme-switch').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${shotDir}/cal-dark.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(500);
  const mob = await page.evaluate(() => ({ hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth, cols: getComputedStyle(document.querySelector('.week-grid')).gridTemplateColumns.split(' ').length }));
  check('telefon: dni jeden pod drugim, bez poziomego scrolla', mob.cols === 1 && !mob.hscroll, JSON.stringify(mob));
  await page.locator('.week-picker-btn').click();
  const panel = await page.locator('.week-picker-panel').boundingBox();
  check('telefon: panel wyboru tygodnia mieści się na ekranie', panel.x >= 0 && panel.x + panel.width <= 390, JSON.stringify(panel));
  await page.screenshot({ path: `${shotDir}/cal-mobile.png` });
} finally {
  for (const id of ids) await call('DELETE', `/projects/${id}`);
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  console.log('console problems:', problems.filter((p) => !/WebSocket is closed before/.test(p)).join('\n') || 'none');
  await browser.close();
}

process.exitCode = fails ? 1 : 0;
