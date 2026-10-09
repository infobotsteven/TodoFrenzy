import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BASE, API } from '../lib.mjs';
const call = async (m, p, b) => { const r = await fetch(API + p, { method: m, headers: b ? { 'content-type': 'application/json; charset=utf-8' } : {}, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); return t ? JSON.parse(t) : null; };
const proj = await call('POST', '/projects', { name: 'ZZ-reg' });
try {
  for (const l of ['ZZ-L1', 'ZZ-L2', 'ZZ-L3', 'ZZ-L4']) {
    const list = await call('POST', `/projects/${proj.id}/checklists`, { name: l });
    for (let i = 1; i <= 5; i++) await call('POST', `/checklists/${list.id}/tasks`, { name: `${l} zadanie ${i}` });
  }
  const r = spawnSync('node', [fileURLToPath(new URL('./_drag-and-drop-checks.mjs', import.meta.url)), `${BASE}/project/${proj.id}`, proj.id], { encoding: 'utf8', timeout: 150000 });
  console.log(r.stdout, r.stderr.slice(-800));
  if (r.status !== 0 || /^FAIL/m.test(r.stdout)) process.exitCode = 1;
} finally { await call('DELETE', `/projects/${proj.id}`); }
