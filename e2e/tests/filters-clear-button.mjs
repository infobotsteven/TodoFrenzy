// Stały przycisk „Wyczyść filtry” w kalendarzu i zakładkach Zaległe / Bez terminu / Archiwum: widoczny od początku (nieaktywny, gdy nie ma co czyścić),
// w kalendarzu obok „Ukryj ukończone”, osobny stan w każdej zakładce.
import { chromium } from 'playwright-core';
import { BASE, CHANNEL, SHOTS } from '../lib.mjs';

let fails = 0;
const check = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); };
const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message.slice(0, 120)));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 120)); });

const TABS = [
  { name: 'Kalendarz', tab: /^Kalendarz/, panel: '.cal-filters' },
  { name: 'Zaległe', tab: /^Zaległe/, panel: '.overdue-filters' },
  { name: 'Bez terminu', tab: /^Bez terminu/, panel: '.undated-filters' },
  { name: 'Archiwum', tab: /^Archiwum\s*\d*$/, panel: '.archive-filters' },
];
try {
  await page.goto(`${BASE}/`); await page.waitForSelector('.cal-day'); await page.waitForTimeout(1000);

  for (const { name, tab, panel } of TABS) {
    await page.getByRole('tab', { name: tab }).last().click(); await page.waitForSelector(panel); await page.waitForTimeout(600);
    const clear = page.locator(panel).getByRole('button', { name: 'Wyczyść filtry' });
    check(`${name}: przycisk „Wyczyść filtry” jest widoczny od razu, jest jeden i nieaktywny`, (await clear.count()) === 1 && (await clear.isVisible()) && (await clear.isDisabled()));
    const toolbar = page.locator(`${panel} .filter-toolbar`);
    check(`${name}: przycisk jest w pasku nad filtrami (przed wierszami filtrów)`, await page.evaluate((sel) => { const p = document.querySelector(sel); return p.firstElementChild.classList.contains('filter-toolbar') && !!p.querySelector('.filter-row'); }, panel));
    await page.locator(panel).getByRole('button', { name: 'Wysoki' }).click(); await page.waitForTimeout(250);
    check(`${name}: po wybraniu filtra przycisk staje się aktywny`, await clear.isEnabled());
    await clear.click(); await page.waitForTimeout(250);
    check(`${name}: kliknięcie czyści filtr i przycisk znów jest nieaktywny (a nie znika)`, (await clear.count()) === 1 && (await clear.isDisabled()) && (await page.locator(panel).locator('[aria-pressed="true"]').count()) === 0);
    // osobny stan zakładek: filtr z tej zakładki nie włącza przycisku w pozostałych
    await page.locator(panel).getByRole('button', { name: 'Średni' }).click(); await page.waitForTimeout(200);
    for (const other of TABS.filter((o) => o.name !== name)) {
      await page.getByRole('tab', { name: other.tab }).last().click(); await page.waitForSelector(other.panel); await page.waitForTimeout(300);
      check(`${name}: filtr nie przecieka do zakładki ${other.name} (jej przycisk nieaktywny)`, await page.locator(other.panel).getByRole('button', { name: 'Wyczyść filtry' }).isDisabled());
    }
    await page.getByRole('tab', { name: tab }).last().click(); await page.waitForSelector(panel); await page.waitForTimeout(300);
    await clear.click(); await page.waitForTimeout(200);
  }

  // --- kalendarz: przycisk obok „Ukryj ukończone” ---
  await page.getByRole('tab', { name: /^Kalendarz/ }).click(); await page.waitForSelector('.cal-filters'); await page.waitForTimeout(500);
  const box = page.getByLabel('Ukryj ukończone');
  const clearBtn = page.locator('.cal-filters').getByRole('button', { name: 'Wyczyść filtry' });
  const label = await page.locator('.cal-filters .check-inline').boundingBox(); const btn = await clearBtn.boundingBox();
  check('kalendarz: „Wyczyść filtry” jest tuż obok „Ukryj ukończone” (ta sama linia, po prawej)', btn.x >= label.x + label.width - 1 && Math.abs(btn.y + btn.height / 2 - (label.y + label.height / 2)) < 12 && btn.x - (label.x + label.width) < 80, JSON.stringify({ label, btn }));
  await box.check(); await page.waitForTimeout(200);
  check('samo „Ukryj ukończone” nie aktywuje przycisku (to opcja widoku, nie filtr)', await clearBtn.isDisabled());
  await page.locator('.cal-filters').getByRole('button', { name: 'Niski' }).click(); await page.waitForTimeout(200);
  check('filtr aktywuje przycisk także przy włączonym „Ukryj ukończone”', await clearBtn.isEnabled());
  await clearBtn.click(); await page.waitForTimeout(200);
  check('czyszczenie nie wyłącza „Ukryj ukończone”', (await box.isChecked()) && (await clearBtn.isDisabled()));
  await box.uncheck();
  await page.screenshot({ path: `${SHOTS}/filters-clear-calendar.png`, clip: { x: 0, y: 380, width: 1440, height: 520 } }).catch(() => {});

  // --- język i telefon ---
  await page.locator('.lang-select').selectOption('en'); await page.waitForSelector('.cal-filters'); await page.waitForTimeout(500);
  check('EN: „Clear filters” (stały, nieaktywny)', (await page.locator('.cal-filters').getByRole('button', { name: 'Clear filters' }).isDisabled()));
  await page.locator('.lang-select').selectOption('pl'); await page.waitForTimeout(300);
  await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(400);
  const probe = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
  check('telefon: bez poziomego scrolla, przycisk widoczny', probe.sw <= probe.vw && (await clearBtn.isVisible()), JSON.stringify(probe));
  check('brak błędów w konsoli', problems.length === 0, problems.join(' | '));
} finally {
  await browser.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
