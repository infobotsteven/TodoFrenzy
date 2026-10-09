// Dane demonstracyjne (projekty, listy, zadania, użytkownicy, tagi) z fixtures/demo.json.
// Użycie: node e2e/seed-demo.mjs [adres API, domyślnie http://localhost:3000/api]
// Terminy zadań są liczone względem dzisiaj, więc kalendarz i „Zaległe” zawsze mają sensowną zawartość.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const demo = JSON.parse(fs.readFileSync(new URL('./fixtures/demo.json', import.meta.url), 'utf8'));

const pad = (n) => String(n).padStart(2, '0');
const isoOffset = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Loguje się i zwraca ciasteczko sesji (aplikacja wymaga logowania). */
async function login(api, user, password) {
  const res = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user, password }),
  });
  if (!res.ok) throw new Error(`Logowanie nie powiodło się (${res.status}) - ustaw AUTH_USER / AUTH_PASSWORD zgodnie z serwerem`);
  return res.headers.get('set-cookie').split(';')[0];
}

export async function seedDemo(api, { user = 'admin', password = 'admin' } = {}) {
  const cookie = await login(api, user, password);
  const call = async (method, path, body) => {
    const res = await fetch(api + path, {
      method,
      headers: { cookie, ...(body ? { 'content-type': 'application/json; charset=utf-8' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  };

  const userIds = new Map();
  for (const u of demo.users) userIds.set(u.nick, (await call('POST', '/users', u)).id);
  const tagIds = new Map();
  for (const name of demo.tags) tagIds.set(name, (await call('POST', '/tags', { name })).id);

  let tasks = 0;
  for (const p of demo.projects) {
    const project = await call('POST', '/projects', { name: p.name, description: p.description, color: p.color });
    for (const c of p.checklists) {
      const list = await call('POST', `/projects/${project.id}/checklists`, {
        name: c.name,
        description: c.description,
        color: c.color,
        tagIds: c.tags.map((t) => tagIds.get(t)),
      });
      for (const t of c.tasks) {
        await call('POST', `/checklists/${list.id}/tasks`, {
          name: t.name,
          description: t.description,
          completed: t.completed,
          priority: t.priority,
          dueDate: t.dueOffset === null ? null : isoOffset(t.dueOffset),
          userIds: t.users.map((n) => userIds.get(n)),
        });
        tasks++;
      }
    }
  }
  return { projects: demo.projects.length, tasks, users: demo.users.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const api = process.argv[2] ?? 'http://localhost:3000/api';
  seedDemo(api, { user: process.env.AUTH_USER ?? 'admin', password: process.env.AUTH_PASSWORD ?? 'admin' }).then((r) => console.log(`Dodano: ${r.projects} projektów, ${r.tasks} zadań, ${r.users} użytkowników (${api})`));
}
