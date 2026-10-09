// Uruchamia testy E2E na jednorazowej instancji: zbudowany serwer (serwuje też frontend) z tymczasową bazą na wolnym porcie.
// Nie dotyka danych deweloperskich. Wymaga wcześniejszego `npm run build` (robi to `npm run test:e2e`).
// Użycie: node e2e/run.mjs [fragment nazwy testu ...]   np.  node e2e/run.mjs calendar overdue
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedDemo } from './seed-demo.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = path.join(root, 'e2e/tests');
const filters = process.argv.slice(2);
// własne (nie domyślne) dane logowania instancji testowej - testy sprawdzają też, że admin/admin tu nie działa
const E2E_USER = 'e2e-admin';
const E2E_PASSWORD = 'e2e-haslo-testowe';

const serverEntry = path.join(root, 'server/dist/index.js');
if (!fs.existsSync(serverEntry) || !fs.existsSync(path.join(root, 'client/dist/index.html'))) {
  console.error('Brak zbudowanej aplikacji - uruchom najpierw `npm run build` (albo użyj `npm run test:e2e`).');
  process.exit(2);
}

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

const port = await freePort();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'todofrenzy-e2e-'));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [serverEntry], {
  cwd: root,
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATABASE_PATH: path.join(tmp, 'e2e.db'), AUTH_USER: E2E_USER, AUTH_PASSWORD: E2E_PASSWORD },
  stdio: ['ignore', 'ignore', 'inherit'],
});

// Sprzątanie: najpierw zatrzymujemy serwer (na Windows trzyma plik bazy), potem kasujemy katalog tymczasowy
const cleanup = async () => {
  if (server.exitCode === null) await new Promise((resolve) => (server.once('exit', resolve), server.kill()));
  try {
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    /* katalog w %TEMP% - zostanie posprzątany przez system */
  }
};
process.on('exit', () => server.kill());
process.on('SIGINT', async () => {
  await cleanup();
  process.exit(130);
});

// czekamy, aż serwer odpowie
for (let i = 0; ; i++) {
  try {
    if ((await fetch(`${origin}/api/health`)).ok) break;
  } catch {
    /* jeszcze się uruchamia */
  }
  if (i > 100) {
    console.error('Serwer testowy nie wystartował.');
    await cleanup();
    process.exit(2);
  }
  await new Promise((r) => setTimeout(r, 100));
}

const seeded = await seedDemo(`${origin}/api`, { user: E2E_USER, password: E2E_PASSWORD });
console.log(`Instancja testowa: ${origin} (dane demo: ${seeded.projects} projektów, ${seeded.tasks} zadań)\n`);

const files = fs
  .readdirSync(testsDir)
  .filter((f) => f.endsWith('.mjs') && !f.startsWith('_'))
  .filter((f) => !filters.length || filters.some((x) => f.includes(x)))
  .sort();

const results = [];
for (const file of files) {
  console.log(`━━ ${file}`);
  const started = Date.now();
  const r = spawnSync(process.execPath, [path.join(testsDir, file)], {
    cwd: root,
    env: { ...process.env, E2E_BASE: origin, E2E_API: `${origin}/api`, E2E_USER, E2E_PASSWORD },
    encoding: 'utf8',
    timeout: 240_000,
  });
  const out = (r.stdout ?? '') + (r.stderr ?? '');
  const failed = r.status !== 0 || /^FAIL/m.test(out);
  // przy sukcesie wystarczy podsumowanie, przy błędzie pełny wynik
  console.log(failed ? out : out.trim().split('\n').slice(-1)[0]);
  results.push({ file, failed, seconds: ((Date.now() - started) / 1000).toFixed(1) });
}

console.log('\nPodsumowanie:');
for (const r of results) console.log(`  ${r.failed ? 'BŁĄD' : 'OK  '}  ${r.file}  (${r.seconds}s)`);
const bad = results.filter((r) => r.failed).length;
console.log(bad ? `\n${bad} z ${results.length} testów nie przeszło.` : `\nWszystkie testy (${results.length}) przeszły.`);
// serwer testowy trzyma pętlę zdarzeń - po sprzątaniu kończymy jawnie
await cleanup();
process.exit(bad ? 1 : 0);
