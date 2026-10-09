// Podstawowe funkcje aplikacji od strony użytkownika: projekty (tworzenie, edycja, kolor, wyszukiwanie, kopiowanie), listy (tagi, kopiowanie),
// zadania (szybkie dodawanie, wklejanie listy, edycja, wykonanie, usuwanie z „Cofnij”), filtry w projekcie, układ list, motyw, strony błędów.
import { chromium } from 'playwright-core';
import { API, BASE, CHANNEL, SHOTS } from '../lib.mjs';

const call = async (m, p, b) => {
  const r = await fetch(API + p, { method: m, headers: b ? { 'content-type': 'application/json; charset=utf-8' } : {}, body: b ? JSON.stringify(b) : undefined });
  const t = await r.text();
  if (!r.ok && m !== 'DELETE') throw new Error(`${m} ${p} ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
};
let fails = 0;
const check = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); };
const pad = (n) => String(n).padStart(2, '0');
const iso = (add) => { const d = new Date(); d.setDate(d.getDate() + add); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

const createdProjectIds = [];
const users = await call('GET', '/users');
const ania = users.find((u) => u.nick === 'Ania');
const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
const problems = [];
let native = 0;
page.on('dialog', (d) => { native++; d.dismiss(); });
page.on('pageerror', (e) => problems.push(e.message.slice(0, 120)));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 120)); });
const cardTitles = async () => (await page.locator('.project-card h2').allInnerTexts()).map((t) => t.trim());
const taskNames = async (list) => (await list.locator('.task .task-name').evaluateAll((els) => els.map((e) => e.childNodes[0]?.textContent?.trim() ?? ''))).filter(Boolean);
const dialog = () => page.locator('dialog[open]');
const serverProject = async (id) => call('GET', `/projects/${id}`);
try {
  await page.goto(`${BASE}/`); await page.waitForSelector('.cal-day');

  // ===== PROJEKT: tworzenie z kolorem =====
  await page.getByRole('button', { name: '+ Nowy projekt' }).click();
  await dialog().getByLabel('Nazwa projektu').fill('ZZ-core');
  await dialog().locator('textarea').fill('Opis projektu testowego');
  await dialog().locator('label.swatch[data-color="blue"]').click();
  await dialog().getByRole('button', { name: 'Utwórz' }).click();
  await page.waitForSelector('.project-card h2:has-text("ZZ-core")');
  const proj = (await call('GET', '/projects')).find((p) => p.name === 'ZZ-core');
  createdProjectIds.push(proj.id);
  check('projekt utworzony z opisem i kolorem niebieskim', proj.description === 'Opis projektu testowego' && proj.color === 'blue');
  check('karta projektu ma kolor (data-color) i licznik 0 / 0', (await page.locator('.project-card[data-color="blue"] h2', { hasText: 'ZZ-core' }).count()) === 1 && (await page.locator('.project-card', { hasText: 'ZZ-core' }).innerText()).includes('0 / 0'));

  // ===== wyszukiwanie =====
  await page.getByLabel('Szukaj projektów').fill('zz-core');
  await page.waitForTimeout(200);
  check('wyszukiwanie zawęża listę do pasującego projektu (+ komunikat o wyłączonym przeciąganiu)', (await cardTitles()).length === 1 && (await page.getByText('Zmiana kolejności jest wyłączona').count()) === 1, JSON.stringify(await cardTitles()));
  await page.getByLabel('Szukaj projektów').fill('zzz-nie-ma-takiego');
  check('brak wyników: komunikat „Brak projektów pasujących”', (await page.getByText('Brak projektów pasujących').count()) === 1);
  await page.getByLabel('Szukaj projektów').fill('');

  // ===== wejście w projekt, powrót =====
  await page.locator('.project-card', { hasText: 'ZZ-core' }).click();
  await page.waitForSelector('h1:has-text("ZZ-core")');
  check('klik w kartę otwiera /project/:id', new URL(page.url()).pathname === `/project/${proj.id}`);
  await page.getByRole('link', { name: 'Wróć do projektów' }).click();
  await page.waitForSelector('.cal-day');
  check('„Projekty” wraca na stronę główną', new URL(page.url()).pathname === '/');
  await page.goto(`${BASE}/project/${proj.id}`); await page.waitForSelector('h1:has-text("ZZ-core")');

  // ===== edycja projektu =====
  await page.getByRole('button', { name: /Edytuj projekt/ }).click();
  await dialog().getByLabel('Nazwa projektu').fill('ZZ-core-2');
  await dialog().locator('label.swatch[data-color="green"]').click();
  await dialog().getByRole('button', { name: 'Zapisz' }).click();
  await page.waitForSelector('h1:has-text("ZZ-core-2")');
  const edited = await serverProject(proj.id);
  check('edycja projektu: nowa nazwa i kolor zielony zapisane', edited.name === 'ZZ-core-2' && edited.color === 'green');
  check('nagłówek projektu przyjmuje kolor', (await page.locator('.project-head[data-color="green"]').count()) === 1);

  // ===== LISTA: tworzenie z nowym tagiem i kolorem =====
  await page.getByRole('button', { name: '+ Nowa lista' }).click();
  await dialog().getByLabel('Nazwa listy').fill('Lista A');
  await dialog().locator('textarea').fill('Opis listy A');
  await dialog().locator('label.swatch[data-color="red"]').click();
  await dialog().getByLabel('Nowy tag').fill('zz-core-tag');
  await dialog().getByLabel('Nowy tag').press('Enter');
  await page.waitForTimeout(500);
  await dialog().getByRole('button', { name: 'Utwórz' }).click();
  await page.waitForSelector('.checklist h3:has-text("Lista A")');
  const withList = await serverProject(proj.id);
  const listA = withList.checklists[0];
  check('lista z opisem, kolorem czerwonym i nowym tagiem', listA.description === 'Opis listy A' && listA.color === 'red' && listA.tags.some((t) => t.name === 'zz-core-tag'));
  check('tag widoczny na liście', (await page.locator('.checklist', { hasText: 'Lista A' }).locator('.list-tags', { hasText: 'zz-core-tag' }).count()) === 1);
  const list = page.locator('.checklist', { hasText: 'Lista A' });

  // ===== ZADANIA: szybkie dodawanie =====
  const addInput = list.getByLabel('Nazwa nowego zadania');
  await addInput.fill('Zadanie 1'); await addInput.press('Enter'); await page.waitForTimeout(400);
  await addInput.fill('Zadanie 2'); await addInput.press('Enter'); await page.waitForTimeout(400);
  check('szybkie dodawanie: Enter dodaje zadanie i czyści pole, fokus zostaje', (await taskNames(list)).join() === 'Zadanie 1,Zadanie 2' && (await addInput.inputValue()) === '' && (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Nazwa nowego zadania');
  check('puste pole: przycisk dodawania wyłączony', await list.getByRole('button', { name: 'Dodaj zadanie' }).isDisabled());

  // ===== wklejanie listy (wiele linii) =====
  await addInput.focus();
  await page.evaluate(() => {
    const el = document.querySelector('input[aria-label="Nazwa nowego zadania"]');
    const dt = new DataTransfer();
    dt.setData('text', '- Wklejone A\n* Wklejone B\n1. Wklejone C\n[x] Wklejone D (gotowe)\n\n');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(800);
  const pasted = (await serverProject(proj.id)).checklists[0].tasks;
  check('wklejenie wielu linii dodaje zadania (bez punktorów), „[x]” = wykonane', pasted.slice(2).map((t) => t.name).join() === 'Wklejone A,Wklejone B,Wklejone C,Wklejone D (gotowe)' && pasted[5].completed === true && pasted[2].completed === false, pasted.map((t) => t.name).join());
  check('komunikat o dodanych zadaniach z wklejonej listy', (await page.locator('.toast', { hasText: 'z wklejonej listy' }).count()) === 1);

  // ===== wykonanie, licznik =====
  await list.locator('.task', { hasText: 'Zadanie 1' }).getByRole('checkbox').click();
  await page.waitForTimeout(500);
  check('zaznaczenie zadania: przekreślone, zostaje na miejscu, licznik listy 2 / 6', (await list.locator('.task.done', { hasText: 'Zadanie 1' }).count()) === 1 && (await taskNames(list))[0] === 'Zadanie 1' && (await list.locator('.checklist-head .count').innerText()).replace(/\s+/g, '') === '2/6');

  // ===== edycja zadania: opis, priorytet, termin, osoba =====
  await list.locator('.task', { hasText: 'Zadanie 2' }).locator('.task-name').click();
  await dialog().getByLabel('Opis (opcjonalnie)').fill('Opis zadania 2');
  await dialog().getByLabel('Wysoki').check();
  await dialog().getByLabel('Termin', { exact: true }).fill(iso(2));
  await dialog().getByRole('button', { name: new RegExp(`\\+ ${ania.nick}`) }).click();
  await dialog().getByRole('button', { name: 'Zapisz' }).click();
  await page.waitForTimeout(700);
  const t2 = (await serverProject(proj.id)).checklists[0].tasks.find((t) => t.name === 'Zadanie 2');
  check('edycja zadania zapisana (opis, priorytet wysoki, termin, osoba)', t2.description === 'Opis zadania 2' && t2.priority === 'high' && t2.dueDate === iso(2) && t2.users.length === 1 && t2.users[0].id === ania.id);
  const row2 = list.locator('.task', { hasText: 'Zadanie 2' });
  check('na wierszu widać priorytet, termin i osobę', (await row2.innerText()).includes('Wysoki') && (await row2.locator('.avatar').count()) === 1 && /\d/.test(await row2.locator('.task-meta').innerText()));

  // ===== usuwanie jednym kliknięciem + Cofnij (miejsce zachowane) =====
  const before = await taskNames(list);
  await list.getByRole('button', { name: 'Usuń zadanie Wklejone B' }).click();
  await page.waitForTimeout(500);
  check('usunięcie jednym kliknięciem (bez okna), komunikat z „Cofnij”', !(await taskNames(list)).includes('Wklejone B') && (await page.locator('.toast-action', { hasText: 'Cofnij' }).count()) === 1 && native === 0);
  await page.locator('.toast-action', { hasText: 'Cofnij' }).click();
  await page.waitForTimeout(800);
  check('„Cofnij” przywraca zadanie na to samo miejsce', (await taskNames(list)).join() === before.join(), (await taskNames(list)).join());

  // ===== FILTRY w projekcie =====
  const filters = page.locator('.filters');
  await filters.getByLabel('Filtruj po priorytecie').selectOption('high');
  await page.waitForTimeout(300);
  check('filtr priorytetu: tylko zadanie wysokie', (await taskNames(list)).join() === 'Zadanie 2');
  await filters.getByLabel('Filtruj po priorytecie').selectOption('');
  await filters.getByLabel('Ukryj wykonane').check(); await page.waitForTimeout(300);
  check('„Ukryj wykonane” chowa wykonane (Zadanie 1, Wklejone D)', !(await taskNames(list)).includes('Zadanie 1') && !(await taskNames(list)).includes('Wklejone D (gotowe)') && (await list.locator('.checklist-head .count').innerText()).replace(/\s+/g, '') === '2/6');
  await filters.getByLabel('Ukryj wykonane').uncheck();
  await filters.locator('.user-chip', { hasText: ania.nick }).click(); await page.waitForTimeout(300);
  check('filtr użytkownika: tylko zadania Ani', (await taskNames(list)).join() === 'Zadanie 2');
  await filters.getByRole('button', { name: 'Wyczyść filtry' }).click(); await page.waitForTimeout(300);
  check('„Wyczyść filtry” przywraca wszystkie zadania', (await taskNames(list)).length === 6);
  await filters.getByRole('button', { name: 'zz-core-tag', exact: true }).click(); await page.waitForTimeout(300);
  check('filtr tagu pokazuje listę z tym tagiem', (await page.locator('.checklist').count()) === 1);
  await filters.getByRole('button', { name: 'Wyczyść filtry' }).click();

  // ===== KOPIOWANIE listy =====
  await page.locator('button[aria-label="Edytuj listę"]').first().click();
  await dialog().getByRole('button', { name: 'Duplikuj' }).click();
  await page.waitForTimeout(900);
  const afterDup = await serverProject(proj.id);
  check('kopia listy: „Lista A (kopia)” z tagiem i zadaniami (niewykonanymi), tuż za oryginałem', afterDup.checklists.length === 2 && afterDup.checklists[1].name === 'Lista A (kopia)' && afterDup.checklists[1].tags.length === 1 && afterDup.checklists[1].tasks.length === 6 && afterDup.checklists[1].tasks.every((t) => !t.completed));

  // ===== układ list: siatka / slider, zapamiętany =====
  await page.getByRole('radio', { name: 'Slider' }).check({ force: true });
  await page.waitForTimeout(300);
  check('przełączenie na slider: klasa planszy i zapis w przeglądarce', (await page.locator('.board-slider').count()) === 1 && (await page.evaluate(() => localStorage.getItem('listView'))) === 'slider');
  await page.reload(); await page.waitForSelector('.checklist');
  check('układ „Slider” przeżywa przeładowanie', (await page.locator('.board-slider').count()) === 1);
  await page.getByRole('radio', { name: 'Siatka' }).check({ force: true });
  check('powrót do siatki', (await page.locator('.board-masonry').count()) === 1);

  // ===== KOPIOWANIE projektu z karty =====
  await page.goto(`${BASE}/`); await page.waitForSelector('.cal-day');
  await page.getByRole('button', { name: 'Duplikuj projekt ZZ-core-2' }).click();
  await page.waitForSelector('.project-card h2:has-text("ZZ-core-2 (kopia)")');
  const copy = (await call('GET', '/projects')).find((p) => p.name === 'ZZ-core-2 (kopia)');
  createdProjectIds.push(copy.id);
  const copyDetail = await serverProject(copy.id);
  check('kopia projektu: te same listy i zadania, wszystko niewykonane, ten sam kolor', copyDetail.checklists.length === 2 && copyDetail.taskCount === 12 && copyDetail.completedCount === 0 && copy.color === 'green');

  // ===== postęp na karcie =====
  const originalCard = page.locator(`a.project-card[href="/project/${proj.id}"]`);
  check('licznik postępu na karcie oryginału: 2 / 12', (await originalCard.innerText()).replace(/\s+/g, ' ').includes('2 / 12'), await originalCard.innerText());

  // ===== MOTYW =====
  const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.locator('.theme-switch').click();
  const themeAfter = await page.evaluate(() => document.documentElement.dataset.theme);
  check('przełącznik motywu zmienia motyw i zapisuje wybór', themeBefore !== themeAfter && (await page.evaluate(() => localStorage.getItem('theme'))) === themeAfter);
  await page.reload(); await page.waitForSelector('.cal-day');
  check('motyw przeżywa przeładowanie (bez mignięcia: ustawiony przed renderem)', (await page.evaluate(() => document.documentElement.dataset.theme)) === themeAfter);
  await page.locator('.theme-switch').click();

  // ===== STRONY BŁĘDÓW =====
  await page.goto(`${BASE}/nie-ma-takiej-strony`);
  check('nieznany adres: „Nie ma takiej strony” z linkiem powrotu', (await page.getByText('Nie ma takiej strony').count()) === 1 && (await page.getByRole('link', { name: /Wróć do projektów/ }).count()) === 1);
  await page.goto(`${BASE}/project/zzzzzzzzzzzzzzzz`);
  await page.waitForTimeout(1500);
  check('nieistniejący projekt: komunikat „Taki projekt nie istnieje”', (await page.getByText('Taki projekt nie istnieje').count()) === 1);

  // ===== UWAGI OGÓLNE =====
  check('nigdzie nie pojawiło się natywne okno przeglądarki', native === 0, String(native));
  check('brak błędów JS/konsoli (poza oczekiwanym 404 projektu)', problems.filter((p) => !/404|Failed to load resource/.test(p)).length === 0, problems.join(' | '));
} finally {
  for (const id of createdProjectIds) await call('DELETE', `/projects/${id}`);
  const tags = await call('GET', '/tags');
  for (const t of tags.filter((x) => x.name === 'zz-core-tag')) await call('DELETE', `/tags/${t.id}`);
  await browser.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
