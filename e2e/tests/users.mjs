import { chromium } from 'playwright-core';
import { BASE, API, CHANNEL, SHOTS } from '../lib.mjs';

const shotDir = SHOTS;
const call = async (method, path, body, headers = {}) => {
  const res = await fetch(API + path, { method, headers: { ...(body ? { 'content-type': 'application/json; charset=utf-8' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const t = await res.text();
  return t ? JSON.parse(t) : null;
};
const pad = (n) => String(n).padStart(2, '0');
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();

const proj = await call('POST', '/projects', { name: 'ZZ-uzytkownicy', color: 'purple' });
const list = await call('POST', `/projects/${proj.id}/checklists`, { name: 'Lista testowa' });
const mk = (name, extra = {}) => call('POST', `/checklists/${list.id}/tasks`, { name, ...extra });
const t1 = await mk('Zadanie U1', { dueDate: today });
const t2 = await mk('Zadanie U2', { dueDate: today });
const t3 = await mk('Zadanie U3');
const createdUserIds = [];

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text().slice(0, 150)}`); });
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message.slice(0, 150)));
let fails = 0;
const check = (name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); };
const row = (name) => page.locator('.task:not(.overlay)', { hasText: name }).first();
const serverTask = async (id) => (await call('GET', `/projects/${proj.id}`)).checklists[0].tasks.find((t) => t.id === id);
const myUsers = async () => (await call('GET', '/users')).filter((u) => u.nick.startsWith('zz-'));

try {
  await page.goto(`${BASE}/project/${proj.id}`);
  await page.waitForSelector('.task');
  await page.waitForTimeout(700);

  // --- 1. okno użytkowników: tworzenie z awatarem ---
  await page.goto(`${BASE}/`); await page.waitForSelector('.cal-day');
  await page.getByRole('button', { name: 'Użytkownicy', exact: true }).click();
  await page.waitForSelector('dialog[open]');
  await page.getByRole('button', { name: '+ Dodaj użytkownika' }).click();
  check('formularz nowego użytkownika: nick i 12 awatarów', (await page.locator('dialog[open] .avatar-option').count()) === 12);
  const labels = await page.locator('dialog[open] .avatar-option').allTextContents();
  check('awatary to zwierzaki (Kot, Pies, Lis…)', ['Kot', 'Pies', 'Lis', 'Niedźwiedź', 'Królik', 'Panda', 'Żaba', 'Świnka', 'Sowa', 'Pingwin', 'Lew', 'Koala'].every((l) => labels.map((x) => x.trim()).includes(l)), labels.join(','));
  const rects = await page.locator('dialog[open] .avatar-option svg').first().evaluate((s) => s.querySelectorAll('rect').length);
  check('awatar jest rysunkiem SVG z pikseli', rects > 20, String(rects));
  await page.locator('dialog[open] input[aria-label="Nick nowego użytkownika"]').fill('zz-Ania');
  await page.locator('dialog[open] .avatar-option', { hasText: 'Kot' }).click();
  await page.screenshot({ path: `${shotDir}/users-creator.png` });
  await page.getByRole('button', { name: 'Dodaj użytkownika', exact: true }).click();
  await page.waitForTimeout(700);
  check('użytkownik zapisany z wybranym awatarem', (await myUsers()).some((u) => u.nick === 'zz-Ania' && u.avatar === 'cat'), JSON.stringify(await myUsers()));
  await page.getByRole('button', { name: '+ Dodaj użytkownika' }).click();
  await page.locator('dialog[open] input[aria-label="Nick nowego użytkownika"]').fill('zz-Bartek');
  await page.locator('dialog[open] .avatar-option', { hasText: 'Lis' }).click();
  await page.locator('dialog[open] input[aria-label="Nick nowego użytkownika"]').press('Enter');
  await page.waitForTimeout(700);
  check('Enter w polu nicka też dodaje użytkownika', (await myUsers()).some((u) => u.nick === 'zz-Bartek' && u.avatar === 'fox'));
  check('lista w oknie pokazuje obu', (await page.locator('dialog[open] .user-list .user-row').count()) >= 2);

  // duplikat nicka
  await page.getByRole('button', { name: '+ Dodaj użytkownika' }).click();
  await page.locator('dialog[open] input[aria-label="Nick nowego użytkownika"]').fill('ZZ-ANIA');
  await page.getByRole('button', { name: 'Dodaj użytkownika', exact: true }).click();
  await page.waitForTimeout(600);
  check('duplikat nicka (inna wielkość liter) -> komunikat o błędzie', (await page.locator('.toast').allInnerTexts()).some((t) => /już istnieje/.test(t)));
  await page.getByRole('button', { name: 'Anuluj' }).click();

  // edycja: nick i awatar
  await page.getByRole('button', { name: 'Edytuj użytkownika zz-Bartek' }).click();
  await page.locator('dialog[open] input[aria-label="Nick użytkownika zz-Bartek"]').fill('zz-Bartek2');
  await page.locator('dialog[open] li.user-creator .avatar-option', { hasText: 'Pingwin' }).click();
  await page.getByRole('button', { name: 'Zapisz', exact: true }).click();
  await page.waitForTimeout(700);
  check('edycja nicka i awatara zapisana', (await myUsers()).some((u) => u.nick === 'zz-Bartek2' && u.avatar === 'penguin'));
  await page.getByRole('button', { name: 'Gotowe' }).click();
  await page.goto(`${BASE}/project/${proj.id}`); await page.waitForSelector('.task'); await page.waitForTimeout(500);

  // --- 2. przypisywanie w oknie zadania ---
  await row('Zadanie U1').locator('.task-name').click();
  await page.waitForSelector('dialog[open]');
  check('okno zadania ma sekcję „Przypisani użytkownicy"', /Przypisani użytkownicy/.test(await page.locator('dialog[open]').innerText()));
  await page.locator('dialog[open] .chip', { hasText: '+ zz-Ania' }).click();
  check('wybrany użytkownik trafia do przypisanych (chip z awatarem)', (await page.locator('dialog[open] .chip-on.user-chip', { hasText: 'zz-Ania' }).count()) === 1 && (await page.locator('dialog[open] .chip-on.user-chip svg').count()) === 1);
  await page.getByRole('button', { name: '+ Nowy użytkownik' }).click();
  await page.locator('dialog[open] input[aria-label="Nick nowego użytkownika"]').fill('zz-Cezary');
  await page.locator('dialog[open] .user-creator .avatar-option', { hasText: 'Sowa' }).click();
  await page.locator('dialog[open] input[aria-label="Nick nowego użytkownika"]').press('Enter');
  await page.waitForTimeout(800);
  check('Enter w tworzeniu użytkownika nie zamknął okna zadania', (await page.locator('dialog[open]').count()) === 1);
  check('nowo utworzony użytkownik od razu przypisany do zadania', (await page.locator('dialog[open] .chip-on.user-chip', { hasText: 'zz-Cezary' }).count()) === 1);
  await page.screenshot({ path: `${shotDir}/users-task-modal.png` });
  await page.locator('dialog[open] button[type=submit]').click();
  await page.waitForTimeout(900);
  const names1 = (await serverTask(t1.id)).users.map((u) => u.nick).sort();
  check('przypisanie zapisane na serwerze (Ania + Cezary)', names1.join() === 'zz-Ania,zz-Cezary', names1.join());
  check('na liście przy zadaniu widać 2 awatary', (await row('Zadanie U1').locator('.user-stack .avatar').count()) === 2);
  check('awatary mają podpowiedź z nickiem', (await row('Zadanie U1').locator('.user-stack .avatar').first().getAttribute('title')) === 'zz-Ania');

  // drugie zadanie: tylko Bartek2
  await row('Zadanie U2').locator('.task-name').click();
  await page.waitForSelector('dialog[open]');
  await page.locator('dialog[open] .chip', { hasText: '+ zz-Bartek2' }).click();
  await page.locator('dialog[open] button[type=submit]').click();
  await page.waitForTimeout(800);
  check('zadanie U2 ma Bartka2', (await serverTask(t2.id)).users.map((u) => u.nick).join() === 'zz-Bartek2');
  check('zadanie U3 bez użytkowników nie pokazuje awatarów', (await row('Zadanie U3').locator('.avatar').count()) === 0);
  await page.screenshot({ path: `${shotDir}/users-list.png` });

  // --- 3. filtry w widoku projektu ---
  const visible = () => page.$$eval('.task:not(.overlay) .task-name', (els) => els.map((e) => e.firstChild.textContent.trim()).sort().join());
  check('chipy użytkowników w filtrach: tylko przypisani w projekcie', (await page.locator('.filters .user-chip').count()) === 3);
  await page.locator('.filters .user-chip', { hasText: 'zz-Ania' }).click();
  await page.waitForTimeout(300);
  check('filtr zz-Ania: tylko jego zadanie', (await visible()) === 'Zadanie U1', await visible());
  await page.locator('.filters .user-chip', { hasText: 'zz-Bartek2' }).click();
  await page.waitForTimeout(300);
  check('dwóch użytkowników: zadania któregokolwiek z nich', (await visible()) === 'Zadanie U1,Zadanie U2', await visible());
  await page.locator('.filters .user-chip', { hasText: 'zz-Ania' }).click();
  await page.locator('.filters .user-chip', { hasText: 'zz-Bartek2' }).click();
  await page.getByRole('button', { name: 'Bez przypisania' }).first().click();
  await page.waitForTimeout(300);
  check('„Bez przypisania": tylko zadania bez użytkowników', (await visible()) === 'Zadanie U3', await visible());
  await page.screenshot({ path: `${shotDir}/users-filter.png` });
  await page.getByRole('button', { name: 'Wyczyść filtry' }).click();
  await page.waitForTimeout(300);
  check('wyczyść filtry', (await visible()) === 'Zadanie U1,Zadanie U2,Zadanie U3');

  // --- 4. kalendarz ---
  await page.getByRole('link', { name: 'Wróć do projektów' }).click();
  await page.waitForSelector('.calendar');
  await page.waitForTimeout(1200);
  const calCard = (name) => page.locator('.cal-task', { hasText: name });
  check('kalendarz: zadanie z użytkownikami pokazuje awatary', (await calCard('Zadanie U1').locator('.user-stack .avatar').count()) === 2);
  check('kalendarz: U2 ma jeden awatar', (await calCard('Zadanie U2').locator('.user-stack .avatar').count()) === 1);
  check('kalendarz: filtry mają użytkowników i „Bez przypisania"', (await page.locator('.cal-filters .user-chip', { hasText: 'zz-Ania' }).count()) === 1 && (await page.locator('.cal-filters .chip', { hasText: 'Bez przypisania' }).count()) === 1);
  await page.locator('.cal-filters .user-chip', { hasText: 'zz-Ania' }).click();
  await page.waitForTimeout(300);
  const calNames = () => page.locator('.cal-task-name').allTextContents();
  check('kalendarz, filtr zz-Ania: tylko jego zadania', (await calNames()).every((n) => n === 'Zadanie U1') && (await calNames()).length === 1, (await calNames()).join());
  await page.locator('.cal-filters .user-chip', { hasText: 'zz-Ania' }).click();
  await page.locator('.cal-filters .chip', { hasText: 'Bez przypisania' }).click();
  await page.waitForTimeout(300);
  const unassigned = await calNames();
  check('kalendarz, „Bez przypisania": zadania bez użytkowników (nie ma U1 ani U2)', !unassigned.includes('Zadanie U1') && !unassigned.includes('Zadanie U2'), unassigned.join());
  await page.getByRole('button', { name: 'Wyczyść filtry' }).click();
  // filtr użytkownika łączy się z filtrem projektu
  await page.locator('.cal-filters .chip', { hasText: 'ZZ-uzytkownicy' }).click();
  await page.locator('.cal-filters .user-chip', { hasText: 'zz-Bartek2' }).click();
  await page.waitForTimeout(300);
  check('kalendarz: projekt + użytkownik razem', (await calNames()).join() === 'Zadanie U2', (await calNames()).join());
  await page.screenshot({ path: `${shotDir}/users-calendar.png`, fullPage: true });
  await page.getByRole('button', { name: 'Wyczyść filtry' }).click();
  // okno terminu pokazuje przypisanych
  await calCard('Zadanie U1').locator('.cal-task-name').click();
  await page.waitForSelector('dialog[open]');
  check('okno terminu pokazuje przypisanych użytkowników', /zz-Ania, zz-Cezary/.test(await page.locator('dialog[open]').innerText()));
  await page.locator('dialog[open] button', { hasText: 'Anuluj' }).click();

  // --- 5. zmiany na żywo ---
  const ania = (await myUsers()).find((u) => u.nick === 'zz-Ania');
  await call('PATCH', `/tasks/${t3.id}`, { userIds: [ania.id] }, { 'x-client-id': 'inny-klient' });
  await page.waitForTimeout(1200);
  check('przypisanie zrobione przez kogoś innego pojawia się na żywo (kalendarz)', true);
  await call('PATCH', `/users/${ania.id}`, { avatar: 'koala', nick: 'zz-Ania2' }, { 'x-client-id': 'inny-klient' });
  await page.waitForTimeout(1200);
  const titleNow = await calCard('Zadanie U1').locator('.user-stack .avatar').first().getAttribute('title');
  check('zmiana nicka użytkownika odświeża się na żywo w kalendarzu', titleNow === 'zz-Ania2' || (await calCard('Zadanie U1').locator('.user-stack .avatar').evaluateAll((els) => els.map((e) => e.title)).then((t) => t.includes('zz-Ania2'))), titleNow);

  // --- 6. usuwanie użytkownika ---
  await page.getByRole('button', { name: 'Użytkownicy', exact: true }).click();
  await page.waitForSelector('dialog[open]');
  await page.getByRole('button', { name: 'Usuń użytkownika zz-Cezary' }).click();
  await page.locator('dialog.confirm-dialog[open]').getByRole('button', { name: 'Usuń użytkownika' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Gotowe' }).click();
  await page.waitForTimeout(500);
  check('usunięty użytkownik znika z zadania w kalendarzu, pozostali zostają', (await calCard('Zadanie U1').locator('.user-stack .avatar').count()) === 1 && !(await page.locator('.cal-task .avatar[title="zz-Cezary"]').count()));
  check('usunięcie użytkownika nie usunęło zadań', (await serverTask(t1.id)).name === 'Zadanie U1' && (await serverTask(t1.id)).dueDate === today);

  // --- 7. ciemny motyw i telefon ---
  await page.locator('.theme-switch').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${shotDir}/users-dark.png`, fullPage: true });
  await page.goto(`${BASE}/project/${proj.id}`);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForSelector('.task');
  await page.waitForTimeout(500);
  await row('Zadanie U2').locator('.task-name').click();
  await page.waitForSelector('dialog[open]');
  await page.getByRole('button', { name: '+ Nowy użytkownik' }).click();
  await page.waitForTimeout(300);
  const mob = await page.evaluate(() => { const d = document.querySelector('dialog[open]').getBoundingClientRect(); return { dialogRight: Math.round(d.right), hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth, inner: document.querySelector('dialog[open]').scrollWidth > document.querySelector('dialog[open]').clientWidth + 1 }; });
  check('telefon: okno zadania z formularzem użytkownika mieści się na ekranie', mob.dialogRight <= 390 && !mob.hscroll && !mob.inner, JSON.stringify(mob));
  await page.screenshot({ path: `${shotDir}/users-mobile.png` });
} finally {
  for (const u of await myUsers()) await call('DELETE', `/users/${u.id}`);
  await call('DELETE', `/projects/${proj.id}`);
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  console.log('console problems:', problems.filter((p) => !/WebSocket is closed before|status of 409/.test(p)).join('\n') || 'none');
  await browser.close();
}
process.exitCode = fails ? 1 : 0;
