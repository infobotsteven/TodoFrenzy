# Architecture

Polish version: [pl/ARCHITEKTURA.md](pl/ARCHITEKTURA.md).

## Overview

An npm-workspaces monorepo: **`shared`** (Zod schemas, types, constants — the source of truth for the API contract), **`server`**
(Fastify 5 + SQLite via better-sqlite3 and Drizzle ORM) and **`client`** (React 19 + Vite 7). The `shared` package is
consumed as TypeScript sources (no build step): Vite and tsx/tsup import it directly.

```text
 browser (React)                              server (Fastify)                  disk
 ┌──────────────────────┐   REST /api/*   ┌────────────────────────┐
 │ TanStack Query (data)│ ──────────────► │ routes (Zod validation)│ ──► SQLite (WAL) data/todo.db
 │ Zustand (UI state)   │                 │ db/queries, reorder…   │
 │ dnd-kit, react-router│ ◄────────────── │ emit() → WebSocket     │
 └──────────────────────┘   WS /ws        └────────────────────────┘
```

In production a single Node process serves both the API and the built frontend (`@fastify/static`, SPA fallback to `index.html`,
`/api/*` stays 404). In development the frontend runs on Vite (`:5173`) with a proxy of `/api` and `/ws` to the server (`:3000`); the proxy **keeps the `Host` header** (`changeOrigin: false`) because the server compares it with `Origin` (CSRF protection).

## Responsibilities

| Layer | Responsible for |
|---|---|
| React | UI, forms, navigation, interactions, drag and drop |
| TanStack Query | **server data**: cache, refetching, optimistic updates |
| Zustand (`client/src/store.ts`) | **UI state only**: theme, list layout, filters, search, messages (toasts), connection state, overdue sorting. API data is not duplicated here |
| Fastify | API, input validation (Zod from `shared`), logic, SQLite, WebSocket |
| SQLite | the only source of truth for data; the file lives on the server side only |

## Backend (`server/src`)

```text
index.ts          startup: migrations → ensureSystemProject → Fastify (errors, headers, WS, routes, static frontend)
config.ts         HOST, PORT, DATABASE_PATH, BACKUP_DIR; directory paths
security.ts       security headers (CSP with hashes of inline scripts, nosniff, no-referrer, X-Frame-Options) and the Origin guard
                  (CSRF: data changes from a foreign Origin → 403; `originMatchesHost` is shared with the WebSocket)
auth.ts           login: account from .env (scrypt), sessions in SQLite (token hash, sliding expiry, credentials fingerprint), attempt lockout, cookie `todofrenzy_session`
auth-hash-cli.ts  `npm run auth:hash` — password hash for .env
errors.ts         HttpError, notFound, global handler (ZodError → 400, Fastify 4xx errors, the rest → 500 without details)
realtime.ts       /ws (ping/pong heartbeat) and emit(req, event) – broadcasts an event to all clients
i18n.ts           translation of API error messages according to the X-Lang header (messages are written in Polish; map `EN`)
routes/           auth (login/logout/me; a hook in `routes/index.ts` requires a session for the whole /api except health and login), projects (+ archive/restore),
                  checklists, tasks, tags, users, calendar (calendar, overdue, no due date, archive, filter sources), stats, index
db/schema.ts      Drizzle tables (see DATA-MODEL.md)
db/client.ts      connection (WAL, foreign_keys=ON, busy_timeout), runMigrations
db/queries.ts     composite reads (projects with counters, lists with tasks/tags/users), helpers (next*Sort, touchProject)
db/reorder.ts     "slot-based" reordering (see below)
db/duplicate.ts   copying a project/list
db/system.ts      ensureSystemProject, isSystemProject (the permanent "Other" project)
db/backup-cli.ts  backup (npm run db:backup)
```

Route pattern: `parse(zod)` → existence/rule checks → write (in a transaction when it touches several tables) →
`touchProject()` (refreshes "Updated") → `emit(req, event)` → response with the current object.

**Ordering (`sort_order`)** is explicit. A new item gets `max+1`. Reordering works "in slots": the submitted ids
receive, in turn, the same `sort_order` values they occupied before (sorted ascending); items not in the list
keep their places — so a concurrent add/delete by someone else does not break the order.
The ids must belong to one parent (otherwise 400).

**The permanent "Other" project:** column `projects.is_system`; the rules are enforced by the routes (delete / rename and recolor / add,
copy or delete its list / move). The project list is always sorted `is_system desc, sort_order, created_at`.

**Identifiers:** 16 characters `[0-9a-z]` from nanoid (~82 bits) — a project id is a "secret" in the link.

**Task dates** are `YYYY-MM-DD` text (no time and no time zone). The server does not know the client's time zone, so "today"
comes from the browser (`/overdue?before=YYYY-MM-DD`).

## Frontend (`client/src`)

```text
main.tsx            QueryClient, global mutation onError (toast), synchronous notifyManager (see below)
App.tsx             login gate (useMe: loading / login screen / app), top bar with "Log out", router (/, /project/:id), toasts; `useRealtime()` runs only for logged-in users
                    (AuthedApp), and a 401 from any query returns to the login screen (`setSession` clears in-memory data but keeps the session query)
api.ts              fetch + ApiError + clientId (X-Client-Id header) + language (X-Lang header)
stats/              the "Statistics" tab: StatsSection (boxes), BarChart, ActivityHeatmap, ProjectTiles, counts (days in the browser's time zone); data from queries/stats.ts (`/stats/completions`)
i18n/               PL/EN interface languages: index.ts (t(), useLang, setLang), define.ts, messages/<area>.ts (PL and EN side by side); App mounts the tree with key={lang}
realtime.ts         WebSocket: reconnecting with growing delay, query invalidation by event
store.ts            Zustand (UI)
queries/            TanStack Query hooks by domain: projects (+archiving), checklists, tasks, reorder, calendar (view queries + task changes),
                    taskCaches (optimistic updates of all task views), users, tags, shared (keys, invalidation)
pages/              LoginPage, ProjectsPage (home: Projects/Archive tabs + PlannerSection), ProjectPage (with the archive banner)
calendar/           PlannerSection (tabs) → CalendarSection | TaskGridSection (overdue / no due date / archive) with TaskGridCard;
                    DayColumn, CalendarTaskCard, modals (due date, new task), CalendarFilters (+ "Archived projects" section), filtering, WeekPicker, dates
components/         ChecklistCard (+ TaskRow, AddTask), ProjectCard, forms, dnd, TaskFilters, UserParts, avatars, Pagination, ConfirmDialog, Modal, ColorPicker, …
confirm.ts          askConfirm(): application-styled confirmations (instead of window.confirm)
styles/             CSS split into modules; index.css imports them in cascade order
labels.ts (labels, names of the permanent project/list in the UI language), format.ts (dates per language), paste.ts, useColumnCount.ts, useMediaQuery.ts   small helper modules
```

> Code comments and the demo data are in Polish (the project's original language); user-facing texts are translated through `i18n`.

### Data and cache (TanStack Query)

Keys: `['projects']`, `['project', id]`, `['calendar', from, to]`, `['calendar','sources']`, `['overdue', today]`, `['undated']`, `['archive']`,
`['users']`, `['tags']`. After every mutation `useInvalidate()` refreshes projects, open projects, the calendar, overdue, "No due date" and the archive.

**Optimistic updates** (so a phone reacts instantly and drag and drop does not "judder"):
- ticking a task in a project (`useToggleTask`),
- reordering projects/lists/tasks (`useOptimisticReorder`) — the cache changes **synchronously in the drop handler**,
- a due-date change/completion from the calendar and grid tabs (`useOptimisticTaskChange` + `patchTaskCaches` in `queries/taskCaches.ts`: one change goes
  to the calendar, overdue, no-due-date and archive at once, with a snapshot for rollback on error).
  Rule: a task whose due date does not change (just "completed") **stays in place**; a due-date change inserts it
  at the end of the new day until the server responds.

**Important:** in `main.tsx` `notifyManager.setScheduler(cb => cb())` — by default TanStack notifies components in the next task
(`setTimeout 0`), which made React render the end of a drag with the old order and the new one a moment later (the item jumped).

### Realtime

After every change the server calls `emit()` — an event typed in `shared/src/events.ts` (e.g. `task.updated`, `project.reordered`).
The client attaches an `X-Client-Id` header to requests (random per tab), the server adds it to the event as `origin`, and the client
**ignores its own events** (its cache is already updated after the write). Other people's events → `invalidateQueries`
(always `projects`, `calendar`, `overdue`; project details only for the project in the event). On connection loss:
a banner, retry with `min(1s·2ⁿ, 10s)`, an immediate attempt on `online`/tab return, a full invalidation after reconnecting.
Every 30 s the server pings clients and drops unresponsive ones.

### Drag and drop (`components/dnd.tsx`, dnd-kit)

- `SortableList` + `SortableItem` for projects, lists and tasks; the calendar has its own `DndContext` (tasks → days).
- Collision detection: `pointerWithin` with a `closestCenter` fallback (a drop counts where the cursor is).
- `DragOverlay` shows a copy "in hand", the original is dimmed; `animateLayoutChanges: () => false`, and
  `flushSync` in `onDragEnd` + the synchronous cache rule out "snapping into place".
- `flipSiblings` — a FLIP animation of neighboring cards after reordering (in the masonry layout a card can change column).
- The drag handle (⋮⋮) is a separate button; clicking the card content does not start a drag.

### List layout (masonry)

`useColumnCount` computes columns from the container width (`ResizeObserver`; it accounts for the root scale because dimensions are given at
100%), `splitIntoColumns` distributes lists in turn (list N → column N mod K), `.board-col` has `flex: 1 1 var(--list-width)`
with a 1.5× limit — columns fill the row. The constant `LIST_WIDTH = 340` (px at 100%) = the list width in the slider.

### Styles (`client/src/styles/`)

One shared stylesheet split into modules; **the order in `index.css` = the cascade order** (do not change without checking
the views; the split was verified by pixel-by-pixel screenshot comparison). Files: `base` (theme tokens, reset, headings),
`layout`, `controls`, `cards`, `lists-tasks`, `users`, `priorities-tags` (also filters), `calendar`, `list-view`, `dnd`,
`color-picker`, `modal-forms`, `toasts`, `responsive`, `planner` (tabs, counters, sorting, pagination), `task-grid` (task card grid),
`project-archive` (archived projects). Before and after any CSS tidying compare screenshots of the views (light/dark).

- **Tokens:** colors through CSS variables (light theme in `:root`, dark through `[data-theme='dark']`), a typography scale
  (`--fs-xs … --fs-xl`, `--fw-*`, `--lh-tight`), radii, `--tap` (44 px). The only allowed text sizes are tokens.
- **Scale in `rem`:** practically all dimensions are in `rem`; from 1100 px `html { font-size: 120% }` enlarges the whole interface.
  Only thin borders, outlines, media queries and circles (`999px`) stay in pixels.
- **Element color** (`data-color="blue"`) sets `--accent`; tiles, dots and bars read `var(--accent)`.
- Heading roles: `h1/.page-title` (page), `.section-title` (sections), `.card-title` (cards and windows). Shared blocks:
  `.section-head`, `.filter-panel` / `.filter-row` / `.filter-label`, `.chips` / `.chip`, `.btn` / `.btn-sm`.

### Browser pitfalls

- `crypto.randomUUID` requires HTTPS, and the app runs over HTTP on a LAN — hence a custom `clientId` built with `getRandomValues`.
- The theme is applied by an inline script in `index.html` before rendering; the production server allows it in the CSP through a sha256 hash.
- `localStorage` is always wrapped in `try/catch` (private mode).

## Building and running

- `npm run build`: Vite builds `client/dist`, tsup bundles the server into `server/dist/index.js` (target node22; external dependencies).
- `npm start`: `node --env-file-if-exists=../.env dist/index.js`.
- Drizzle migrations (`server/drizzle/*.sql`) are applied at startup (`runMigrations`). In practice only **additive** migrations
  (ALTER ADD COLUMN, CREATE INDEX) — see [DATA-MODEL.md](DATA-MODEL.md).
- Docker is not prepared yet (see [ROADMAP.md](ROADMAP.md)).
