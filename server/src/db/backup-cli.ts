import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { sqlite } from './client.js';

/**
 * Spójna kopia zapasowa bazy (API `backup` SQLite - bezpieczna także przy działającym serwerze i trybie WAL).
 * Pliki lądują w `backups/` (poza gitem); zostaje `BACKUP_KEEP` najnowszych (domyślnie 14).
 */
const pad = (n: number) => String(n).padStart(2, '0');
const now = new Date();
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

fs.mkdirSync(config.backupsDir, { recursive: true });
const target = path.join(config.backupsDir, `todo-${stamp}.db`);
await sqlite.backup(target);
sqlite.close();
console.log(`Kopia zapasowa: ${target}`);

const keep = Number(process.env.BACKUP_KEEP ?? 14);
const old = fs
  .readdirSync(config.backupsDir)
  .filter((f) => /^todo-\d{8}-\d{6}\.db$/.test(f))
  .sort()
  .reverse()
  .slice(keep);
for (const file of old) fs.rmSync(path.join(config.backupsDir, file));
if (old.length) console.log(`Usunięto starsze kopie (${old.length}), zostaje ${keep}.`);
