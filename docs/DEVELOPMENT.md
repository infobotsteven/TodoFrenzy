# Development guide

Polish version: [pl/ROZWOJ.md](pl/ROZWOJ.md).

## Environment

- Node.js ≥ 22, npm (workspaces). Windows 11 is the author's main environment; everything also works on Linux/Docker
  (LF line endings are enforced by `.gitattributes`).
- `npm install` in the root directory installs all packages. `npm run dev` starts the server (`tsx watch`) and Vite.
- Environment variables (`.env`, template in `.env.example`): `HOST`, `PORT`, `DATABASE_PATH`, `BACKUP_DIR`, `BACKUP_KEEP`, and the `AUTH_*` variables (see [SECURITY.md](SECURITY.md)).
  Relative paths are resolved from the repository root.

## Branches

- **`develop`** — the working branch; all day-to-day changes land here.
- **`main`** — the release branch published to GitHub; it holds released states only (tagged `vX.Y.Z`). Merge `develop` into `main` when preparing a release.

## Working rules

1. **Strict TypeScript** across the repo; the API contract lives in `shared/` — change a Zod schema and the compiler shows every
   place to fix in the server and the client.
2. Before finishing a change: `npm run typecheck`, `npm run lint`, `npm run lint:unused` (knip: dead exports, files, dependencies), and for behavior changes
   `npm run test:e2e`. After larger refactors compare before/after screenshots (light and dark theme).
3. **Code comments are in Polish** (the project's original language): short, about *why* (not what the code shows). Interface texts go through `t()` (PL + EN, see below).
4. **Never lose data:** before a data-changing migration run `npm run db:backup`; test migrations on a copy of the database file.
   E2E tests use their own temporary database — they never write to `data/todo.db`.
5. **Styles:** new dimensions in `rem`, text sizes and colors only from tokens (`--fs-*`, `--c-*`, `--surface`, …);
   add new rules to the right file in `client/src/styles/` (the import order in `index.css` is the cascade order).
   The interface accent color is **`--brand`** (with `--on-brand` text; brand-colored text: `--brand-text`) — do not hard-code green or white text on primary buttons.
   Visual language: a project/list color is a **dot** (not a stripe), cards have `--shadow-card`, the archive = `--archive-hatch` hatching + a dashed border + an empty dot + `.archive-icon`.
6. Check interface changes at three widths (phone 390, ~1440, ~1900) and in both themes.
7. **Never use `window.confirm/alert/prompt`** — use `askConfirm()` from `client/src/confirm.ts`.
8. **Documentation is bilingual:** English is canonical (`docs/*.md`, `README.md`); Polish copies live in `docs/pl/` and `README.pl.md`. Update both when behavior changes.

## Recipes

**A new task field (e.g. "estimated time")**
1. `server/src/db/schema.ts` (column) → `npm run db:generate` → review `server/drizzle/XXXX_*.sql` (additive!).
2. `shared/src/types.ts` (type `Task`) and the schemas in `shared/src/index.ts` (`taskFields`).
3. Server: `toTask` in `db/queries.ts` usually needs nothing; add the field to copying (`db/duplicate.ts`) and possibly to routes.
4. Client: `TaskForm` in `components/forms.tsx`, display in `ChecklistCard`, possibly the calendar/overdue cards.
5. An E2E test + an entry in `docs/FEATURES.md` (and its Polish copy).

**A new endpoint** — a route in `server/src/routes/*.ts` (Zod parse → rules → write → `touchProject` → `emit`), an event type in
`shared/src/events.ts` if it concerns realtime, a hook in `client/src/queries/*`, invalidation in `useInvalidate`/`realtime.ts`, a description in `docs/API.md`.

**A new interface text** — a key in `client/src/i18n/messages/<area>.ts` (PL and EN in one `defineMessages` call; add a new area to `messages/index.ts` too), used as `t('area.key', { param })`;
plurals: a value `{ one, few, many, other }` and the parameter `n`. An API error message: written in Polish in the route + an entry in the `EN` map in `server/src/i18n.ts`.

**A new color/priority/avatar** — a constant in `shared/src/types.ts` (+ the CSS token `--c-*` and `[data-color]`; for an avatar: a sprite in `components/avatars.ts`
and a label). The color reserved for the permanent project (`SYSTEM_COLOR`) does not go into `COLORS`.

**A new view on the home page** — model it on `calendar/TaskGridSection.tsx` (shared by "Overdue", "No due date" and "Archive"; a new variant = a new entry in `TEXTS`, a hook in `queries/calendar.ts`, an endpoint in `routes/calendar.ts`) + a tab in `PlannerSection`,
filters through `CalendarFilters` with a new `FilterScope` in `store.ts`, data through a hook in `queries/` (remember invalidation in `useInvalidate` and `realtime.ts`).

## Pitfalls (hard-won knowledge)

- **Vite and a "stale" module cache:** after moving/splitting files or changing imports the dev server sometimes goes deaf to changes
  (a blank page, "missing export", a new component not reacting). `touch`ing the changed files or restarting `npm run dev` helps.
- **The lockfile must work with npm 10 and 11:** the Docker image (Node 22) uses npm 10, and a `package-lock.json` generated by npm 11 can lack optional packages that npm 10 demands
  (`npm ci` then fails with "Missing: @emnapi/core … from lock file"). After changing dependencies regenerate it with `npx npm@10 install --package-lock-only`, and verify with `npx npm@10 ci` and `npx npm@11 ci`.
- **Windows PowerShell 5.1:** no `&&`; pipes and arrays from `Invoke-RestMethod` get "unrolled"; Polish characters in the console need
  `[Console]::OutputEncoding = UTF8`. Write test scripts in Node, not PowerShell.
- **Login in dev:** after `npm run dev` the app shows the login screen — `admin`/`admin` (with no `.env` settings). Scripts calling the API (e.g. `seed:demo`, your own) must
  log in (`POST /api/auth/login`, cookie `todofrenzy_session`); the tests do it through `e2e/lib.mjs`. In a PowerShell/curl script: `-c`/`-b` or a manual `Cookie` header.
- **Session state in TanStack Query:** do not use `queryClient.clear()` when the login changes — it detaches the active session query and the screen does not switch; use `setSession(qc, me)` (`queries/auth.ts`).
- **Empty variables in `.env`** (`AUTH_PASSWORD=`) are treated as unset — watch out for `??` instead of `||` when reading configuration (a bug found by `auth.mjs`).
- **Proxy vs CSRF:** the server rejects (403) writes whose `Origin` does not match `Host`. The Vite proxy must have `changeOrigin: false` (the default shorthand `'/api': url`
  rewrites `Host` and breaks all writes in dev); a production reverse proxy must pass `Host` or `X-Forwarded-Host`.
- **`crypto.randomUUID`** does not work over HTTP (LAN) — we use a custom `clientId`.
- **TanStack Query and drag and drop:** do not change the synchronous scheduler in `main.tsx` or the synchronous cache update in
  `useOptimisticReorder` — they eliminate "jumping" after a drop.
- **Playwright:** for a checkbox whose card disappears after clicking (overdue) use `click()` instead of `check()`; text selectors are
  case-insensitive and match substrings (use `exact: true` or concrete classes).
- **Long options in `<select>` lists in forms:** a flex item has `min-width: auto` by default, so `.field` stretched the window to the width of the longest option (the "New task" window with a long list name).
  `.field` has `min-width: 0`, and `select`/`input`/`textarea` in a field are `width: 100%` + ellipsis; use new form fields inside `.field`, not as loose flex items. Test: `add-task-modal-overflow.mjs`.
- **`overflow-wrap: anywhere`** in cards breaks words in narrow columns — that is why the calendar has a minimum column width.
- **List dimensions in JS** (`LIST_WIDTH`, `LIST_GAP`) are given at 100% scale; `useColumnCount` converts them to the current root scale.

## Tests and tools

E2E tests: [TESTING.md](TESTING.md). Dependency audit: `npm audit`. Backups: `npm run db:backup`.
