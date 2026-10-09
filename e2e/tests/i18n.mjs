// Języki interfejsu (PL / EN): lista wyboru obok przełącznika motywu, tłumaczenie tekstów, dat, liczby mnogiej, nazw stałego projektu,
// komunikatów błędów z serwera, zapamiętanie wyboru i działanie na ekranie logowania.
import { chromium } from 'playwright-core';
import { BASE, CHANNEL, SHOTS } from '../lib.mjs';
const out = SHOTS;
let fails = 0; const check = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); };
const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message.slice(0, 120)));
// 404 z celowo otwartego nieistniejącego projektu to nie błąd aplikacji
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && problems.push(m.text().slice(0, 120)));
const lang = () => page.evaluate(() => document.documentElement.lang);
const MONTHS_PL = /\b(sty|lut|mar|kwi|maj|cze|lip|sie|wrz|paź|lis|gru)\b/;
try {
  await page.goto(`${BASE}/`); await page.waitForSelector('.cal-day'); await page.waitForTimeout(500);

  // --- domyślnie polski ---
  const select = page.locator('.lang-select');
  check('lista języka jest w pasku obok przełącznika motywu (przed nim)', (await select.count()) === 1 && (await page.evaluate(() => document.querySelector('.lang-select').nextElementSibling?.classList.contains('theme-switch'))));
  check('domyślnie PL: <html lang="pl">, wybrane „PL · Polski”, opcje PL i EN', (await lang()) === 'pl' && (await select.inputValue()) === 'pl' && (await select.locator('option').allInnerTexts()).join('|') === 'PL · Polski|EN · English');
  check('PL: zakładki i przyciski po polsku', (await page.getByRole('tab', { name: /^Projekty/ }).count()) === 1 && (await page.getByRole('button', { name: '+ Nowy projekt' }).count()) === 1 && (await page.getByRole('tab', { name: /^Zaległe/ }).count()) === 1);
  check('nazwa aplikacji: „TodoFrenzy” w tytule karty i w pasku u góry (na szerokim ekranie)', (await page.title()) === 'TodoFrenzy' && (await page.locator('.topbar .brand-text').innerText()).trim() === 'TodoFrenzy' && !(await page.content()).includes('TodoHub'));
  check('PL: stały projekt „Inne”', (await page.locator('.project-card.fixed h2').innerText()).trim() === 'Inne');
  await page.screenshot({ path: `${out}/i18n-pl.png`, clip: { x: 0, y: 0, width: 1440, height: 420 } });

  // --- przełączenie na angielski ---
  await select.selectOption('en'); await page.waitForTimeout(500);
  check('EN: <html lang="en">, zapis w localStorage', (await lang()) === 'en' && (await page.evaluate(() => localStorage.getItem('lang'))) === 'en');
  check('EN: nagłówek strony głównej', (await page.getByRole('tab', { name: /^Projects/ }).count()) === 1 && (await page.getByRole('button', { name: '+ New project' }).count()) === 1 && (await page.getByRole('button', { name: 'Users', exact: true }).count()) === 1 && (await page.getByRole('button', { name: 'Log out' }).count()) === 1);
  check('EN: zakładki kalendarza', (await page.getByRole('tab', { name: /^Calendar/ }).count()) === 1 && (await page.getByRole('tab', { name: /^Overdue/ }).count()) === 1 && (await page.getByRole('tab', { name: /^No due date/ }).count()) === 1);
  check('EN: stały projekt wyświetla się jako „Other” (w bazie nadal „Inne”)', (await page.locator('.project-card.fixed h2').innerText()).trim() === 'Other' && (await page.locator('.project-card.fixed p.clamp').innerText()).startsWith('Loose tasks'));
  const weekRange = await page.locator('.week-picker-btn').innerText();
  check('EN: daty z angielskimi miesiącami (bez polskich skrótów)', /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b/.test(weekRange) && !MONTHS_PL.test(weekRange), weekRange);
  check('EN: „Today”, podsumowanie tygodnia', (await page.getByRole('button', { name: 'Today' }).count()) === 1 && /tasks? this week|No tasks with a due date/.test(await page.locator('.calendar .section-head .muted').innerText()));
  check('EN: przyciski „+ Task”, filtry i etykiety', (await page.getByRole('button', { name: '+ Task' }).count()) === 1 && (await page.locator('.filter-label', { hasText: 'Priority' }).count()) >= 1);
  check('EN: nazwy priorytetów w filtrze', (await page.locator('.cal-filters .chips').nth(-1).innerText()).length > 0 && (await page.getByRole('button', { name: 'High' }).count()) >= 1);

  // --- zaległe: liczba mnoga i dni po terminie ---
  await page.getByRole('tab', { name: /^Overdue/ }).click(); await page.waitForSelector('.overdue-grid'); await page.waitForTimeout(300);
  const sub = await page.locator('section.overdue .section-head .muted').innerText();
  check('EN „Overdue”: podpis z liczbą mnogą', /^\d+ overdue tasks?$/.test(sub) || /^No overdue tasks$/.test(sub), sub);
  if ((await page.locator('.overdue-card').count()) > 0) {
    check('EN „Overdue”: karta ma „Change due date” i „… overdue”', (await page.locator('.overdue-card').first().innerText()).includes('Change due date') && /days? overdue/.test(await page.locator('.overdue-card').first().innerText()));
  }

  // --- okno dodawania projektu ---
  await page.getByRole('button', { name: '+ New project' }).click(); await page.waitForSelector('dialog[open]');
  const dlg = await page.locator('dialog[open]').innerText();
  check('EN: okno „New project” (pola i przyciski)', dlg.includes('New project') && dlg.includes('Project name') && dlg.includes('Description (optional)') && dlg.includes('Cancel') && dlg.includes('Create'), dlg.replace(/\n/g, ' | '));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);

  // --- strona projektu ---
  await page.locator('.project-card:not(.fixed)').first().click(); await page.waitForSelector('.project-head');
  check('EN: strona projektu: „Projects”, „Lists”, „Tags”, „+ New list”', (await page.locator('.back-btn').innerText()).trim() === 'Projects' && (await page.getByRole('heading', { name: 'Lists' }).count()) === 1 && (await page.getByRole('button', { name: 'Tags', exact: true }).count()) === 1 && (await page.getByRole('button', { name: '+ New list' }).count()) === 1);
  check('EN: postęp projektu „completed”', /completed \(\d+%\)/.test(await page.locator('.project-progress .count').innerText()));
  await page.screenshot({ path: `${out}/i18n-en-project.png`, clip: { x: 0, y: 0, width: 1440, height: 700 } });

  // --- zapamiętanie wyboru po przeładowaniu ---
  await page.reload(); await page.waitForSelector('.project-head');
  check('po przeładowaniu język EN zostaje (lista i tekst)', (await select.inputValue()) === 'en' && (await lang()) === 'en' && (await page.locator('.back-btn').innerText()).trim() === 'Projects');

  // --- komunikaty błędów z serwera w języku interfejsu ---
  const apiErrors = await page.evaluate(async () => {
    const get = async (l) => (await (await fetch('/api/projects/zz-nie-ma', { headers: { 'x-lang': l } })).json()).error;
    return { en: await get('en'), pl: await get('pl'), none: (await (await fetch('/api/projects/zz-nie-ma')).json()).error };
  });
  check('serwer: „Project not found” dla x-lang=en, po polsku dla pl i bez nagłówka', apiErrors.en === 'Project not found' && apiErrors.pl === 'Projekt nie istnieje' && apiErrors.none === 'Projekt nie istnieje', JSON.stringify(apiErrors));
  // toast z błędem serwera w EN: usunięty projekt otwarty po adresie
  await page.goto(`${BASE}/project/zz-nie-ma`); await page.waitForSelector('.notice');
  check('EN: strona nieistniejącego projektu', (await page.locator('.notice').innerText()).includes('This project does not exist'));

  // --- powrót do polskiego bez przeładowania ---
  await page.goto(`${BASE}/`); await page.waitForSelector('.cal-day');
  await page.locator('.lang-select').selectOption('pl'); await page.waitForTimeout(400);
  check('PL: po przełączeniu wracają polskie teksty, <html lang="pl">', (await lang()) === 'pl' && (await page.getByRole('tab', { name: /^Projekty/ }).count()) === 1 && (await page.locator('.project-card.fixed h2').innerText()).trim() === 'Inne');

  // --- telefon: pasek mieści się w jednym rzędzie także z listą języka ---
  await page.locator('.lang-select').selectOption('en');
  await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(400);
  const probe = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, right: document.querySelector('.theme-switch').getBoundingClientRect().right }));
  check('telefon: pasek z listą języka bez poziomego scrolla, przełącznik motywu widoczny', probe.sw <= probe.vw && probe.right <= probe.vw, JSON.stringify(probe));
  await page.screenshot({ path: `${out}/i18n-mobile.png`, clip: { x: 0, y: 0, width: 390, height: 300 } });
  await page.locator('.lang-select').selectOption('pl');

  // --- ekran logowania (bez sesji) ---
  const anon = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const login = await anon.newPage();
  await login.goto(`${BASE}/`); await login.waitForSelector('form button[type=submit]');
  check('logowanie: jest lista języka, domyślnie PL (nowa przeglądarka)', (await login.locator('.lang-select').inputValue()) === 'pl' && (await login.getByRole('heading', { name: 'Zaloguj się' }).count()) === 1);
  await login.locator('.lang-select').selectOption('en'); await login.waitForTimeout(300);
  check('logowanie w EN: „Log in”, „Username”, „Password”', (await login.getByRole('heading', { name: 'Log in' }).count()) === 1 && (await login.getByLabel('Username').count()) === 1 && (await login.getByLabel('Password').count()) === 1 && (await login.getByRole('button', { name: 'Log in' }).count()) === 1);
  await login.getByLabel('Username').fill('zz-nie-ma'); await login.getByLabel('Password').fill('zz-zle-haslo');
  await login.getByRole('button', { name: 'Log in' }).click(); await login.waitForSelector('[role=alert]');
  check('logowanie w EN: błąd z serwera po angielsku', (await login.locator('[role=alert]').innerText()) === 'Invalid username or password', await login.locator('[role=alert]').innerText());
  await login.screenshot({ path: `${out}/i18n-login-en.png` });
  check('logowanie EN: podpis z nową nazwą „TodoFrenzy”', (await login.locator('.login-head .muted').innerText()).startsWith('TodoFrenzy is available'));
  await anon.close();

  check('brak błędów w konsoli i wyjątków strony', problems.length === 0, JSON.stringify(problems.slice(0, 3)));
} finally { await browser.close(); }
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
