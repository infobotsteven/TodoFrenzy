import { chromium } from 'playwright-core';
import { BASE, CHANNEL, SHOTS } from '../lib.mjs';
const out = SHOTS;
let fails = 0; const check = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); };
const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  await page.goto(`${BASE}/`); await page.waitForSelector('.cal-day'); await page.waitForTimeout(800);
  const nowy = page.getByRole('button', { name: '+ Nowy projekt' });
  const users = page.getByRole('button', { name: 'Użytkownicy', exact: true });
  check('na stronie jest dokładnie jeden przycisk „Użytkownicy”', (await users.count()) === 1);
  check('przycisk NIE jest już w sekcji kalendarza', (await page.locator('.calendar').getByRole('button', { name: 'Użytkownicy', exact: true }).count()) === 0);
  const a = await nowy.boundingBox(); const b = await users.boundingBox();
  check('„Użytkownicy” po prawej stronie „+ Nowy projekt”, w jednej linii', b.x > a.x + a.width - 1 && Math.abs(b.y - a.y) < 4, JSON.stringify({ a, b }));
  const head = await page.locator('.page-head').boundingBox();
  check('przyciski przy prawej krawędzi nagłówka', Math.abs(b.x + b.width - (head.x + head.width)) < 2);
  await page.screenshot({ path: `${out}/users-btn.png`, clip: { x: 0, y: 60, width: 1440, height: 200 } });
  await users.click();
  await page.waitForSelector('dialog[open]');
  check('klik otwiera okno użytkowników', (await page.locator('dialog[open]').innerText()).includes('Użytkownicy') && (await page.locator('dialog[open] .avatar').count()) > 0);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('kalendarz nadal działa: „+ Zadanie” obecny', (await page.getByRole('button', { name: '+ Zadanie' }).count()) === 1);

  await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(400);
  const probe = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
  check('telefon: bez poziomego scrolla', probe.sw <= probe.vw, JSON.stringify(probe));
  await page.screenshot({ path: `${out}/users-btn-mobile.png`, clip: { x: 0, y: 0, width: 390, height: 260 } });
} finally { await browser.close(); }
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
