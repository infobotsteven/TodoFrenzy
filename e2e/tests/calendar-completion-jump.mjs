import { chromium } from 'playwright-core';
import { BASE, API, CHANNEL } from '../lib.mjs';
const call = async (method, path, body) => { const r = await fetch(API + path, { method, headers: body ? { 'content-type': 'application/json; charset=utf-8' } : {}, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); return t ? JSON.parse(t) : null; };
const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const proj = await call('POST', '/projects', { name: 'ZZ-jump' });
const list = await call('POST', `/projects/${proj.id}/checklists`, { name: 'L' });
for (const n of ['ZZ-A', 'ZZ-B', 'ZZ-C']) await call('POST', `/checklists/${list.id}/tasks`, { name: n, dueDate: today });
const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
let fail = 0;
try {
  await page.goto(`${BASE}/`);
  await page.waitForSelector('.cal-task');
  await page.waitForTimeout(800);
  const snap = () => page.evaluate(() => [...document.querySelectorAll('.cal-task-name')].filter((e) => e.textContent.startsWith('ZZ-')).map((e) => `${e.textContent}@${Math.round(e.getBoundingClientRect().top - document.querySelector(".cal-day.today")?.getBoundingClientRect().top)}`).join(' '));
  const before = await snap();
  console.log('przed:', before);
  await page.evaluate(() => { window.__log = []; const t0 = performance.now(); const f = () => { window.__log.push([...document.querySelectorAll('.cal-task-name')].filter((e) => e.textContent.startsWith('ZZ-')).map((e) => `${e.textContent}@${Math.round(e.getBoundingClientRect().top - document.querySelector(".cal-day.today")?.getBoundingClientRect().top)}`).join(' ')); if (performance.now() - t0 < 1500) setTimeout(f, 20); }; f(); });
  await page.getByRole('checkbox', { name: 'Wykonane: ZZ-A' }).click();
  await page.waitForTimeout(1700);
  const log = await page.evaluate(() => window.__log);
  const uniq = [...new Set(log)];
  console.log('stany w czasie:', uniq.length); uniq.forEach((u) => console.log('  ', u));
  if (uniq.length !== 1 || uniq[0] !== before) { fail++; }
  console.log(fail ? 'FAIL: kolejność/pozycje się zmieniły' : 'OK: brak przeskakiwania');
} finally {
  await call('DELETE', `/projects/${proj.id}`);
  await browser.close();
}
process.exit(fail ? 1 : 0);
