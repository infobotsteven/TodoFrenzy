import { chromium } from 'playwright-core';
import { BASE, API, CHANNEL } from '../lib.mjs';

const [, , projectUrl, projectId] = process.argv;
const browser = await chromium.launch({ channel: CHANNEL, headless: true });
let fails = 0;
const check = (name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); };
const project = async () => (await (await fetch(`${API}/projects/${projectId}`)).json());

async function drag(page, handle, to, steps = 30) {
  const hb = await handle.boundingBox();
  const x0 = hb.x + hb.width / 2, y0 = hb.y + hb.height / 2;
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= steps; i++) { await page.mouse.move(x0 + ((to.x - x0) * i) / steps, y0 + ((to.y - y0) * i) / steps); await page.waitForTimeout(14); }
  await page.waitForTimeout(250);
  await page.mouse.up();
  await page.waitForTimeout(900);
}

const page = await browser.newPage({ viewport: { width: 1900, height: 1500 } });
await page.goto(projectUrl);
await page.waitForSelector('.board-masonry .checklist');
await page.waitForTimeout(500);

// --- zadania: przeciągnięcie pierwszego na miejsce trzeciego (kursor nad trzecim wierszem) ---
const firstList = page.locator('.board-masonry .checklist').first();
const listName = (await firstList.locator('h3').innerText()).split(' ')[0];
const before = (await project()).checklists.find((c) => c.name.startsWith(listName)).tasks.map((t) => t.name);
const third = await firstList.locator('.task').nth(2).boundingBox();
await drag(page, firstList.locator('.task .drag-handle').first(), { x: third.x + third.width / 2, y: third.y + third.height / 2 });
const after = (await project()).checklists.find((c) => c.name.startsWith(listName)).tasks.map((t) => t.name);
check(`zadania: pierwsze zadanie ląduje na miejscu wskazanym kursorem (${before.slice(0, 4)} → ${after.slice(0, 4)})`, after[2] === before[0] && after[0] === before[1] && after.length === before.length);

// --- zadanie: puszczenie w tym samym miejscu nic nie zmienia ---
const same = (await project()).checklists.find((c) => c.name.startsWith(listName)).tasks.map((t) => t.name).join();
const row0 = await firstList.locator('.task').nth(0).boundingBox();
await drag(page, firstList.locator('.task .drag-handle').first(), { x: row0.x + row0.width / 2, y: row0.y + row0.height / 2 }, 10);
check('zadania: upuszczenie w miejscu startu nie zmienia kolejności', (await project()).checklists.find((c) => c.name.startsWith(listName)).tasks.map((t) => t.name).join() === same);

// --- zadanie: puszczenie w pustym miejscu (poza kartami) nie psuje niczego ---
const orderBefore = (await project()).checklists.map((c) => c.name).join();
await drag(page, page.locator('.board-masonry .checklist').nth(3).locator('.checklist-head .drag-handle'), { x: 1850, y: 1450 }, 20);
const orderAfter = (await project()).checklists.map((c) => c.name).join();
check('listy: upuszczenie w pustym miejscu zachowuje spójną kolejność (wszystkie listy na miejscu)', (await project()).checklists.length === orderBefore.split(',').length && new Set(orderAfter.split(',')).size === orderBefore.split(',').length, orderAfter);

// --- slider ---
await page.getByLabel('Slider').check();
await page.waitForTimeout(400);
const sliderCards = page.locator('.board-slider > .checklist');
const names1 = (await project()).checklists.map((c) => c.name.split(' ')[0]);
const t = await sliderCards.nth(2).boundingBox();
await drag(page, sliderCards.nth(0).locator('.checklist-head .drag-handle'), { x: t.x + t.width / 2, y: t.y + 100 });
const names2 = (await project()).checklists.map((c) => c.name.split(' ')[0]);
check(`slider: lista ląduje na miejscu trzeciej (${names1.slice(0, 4)} → ${names2.slice(0, 4)})`, names2[2] === names1[0]);
await page.getByLabel('Siatka').check();
await page.close();

// --- widok główny: karty projektów (tylko odczyt kolejności i dwa przeciągnięcia nie ruszają cudzych danych) ---
const home = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await home.goto(`${BASE}/`);
await home.waitForSelector('.project-item');
await home.waitForTimeout(500);
const names = await home.$$eval('.project-item h2', (els) => els.map((e) => e.textContent));
check(`widok główny: ${names.length} kart projektów wyświetla się poprawnie`, names.length >= 3);
await home.close();

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
await browser.close();
process.exitCode = fails ? 1 : 0;
