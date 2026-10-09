# TodoFrenzy

**English** · [Polski](README.pl.md)

A shared, self-hosted web app for managing **projects, lists and tasks**, with a calendar, an overdue view and statistics.
It runs on your local network (a computer plus phones), behind a login with **one shared account**. Changes show up for everyone
live (WebSocket). Data is stored in SQLite — a single file, no external database server. The interface is bilingual: **English and Polish**.

![Home page](docs/images/overview-light.png)

<p>
  <img src="docs/images/calendar-dark.png" alt="Calendar, dark theme" width="49%">
  <img src="docs/images/statistics-light.png" alt="Statistics" width="49%">
</p>

## Features

- **Projects → lists → tasks**, all reorderable by drag and drop, with colors, copying and progress counters.
- **A permanent "Other" project** with a single "Tasks" list for loose tasks; it cannot be deleted.
- **Weekly calendar**: tasks with due dates, filters, hiding completed tasks, rescheduling by dragging, adding tasks to a given day.
- **Overdue**, **No due date** and **Archive** — card grids with filters, sorting, quick rescheduling, restoring and pagination.
- **Project archive** — an archived project leaves the list and its tasks leave the calendar; restoring a task restores the whole project.
- **Statistics** — completed today and over recent days, a weekly chart, a GitHub-style activity map and a project summary.
- **Users with pixel-art avatars** assigned to tasks, **tags** on lists, **priorities**, **light and dark themes**.
- **Realtime** updates, a mobile-first layout, two list layouts (grid / slider), **EN / PL** interface.

Full description: [docs/FEATURES.md](docs/FEATURES.md).

## Requirements

- **Node.js ≥ 22** (with npm). Nothing else — SQLite is embedded (the native `better-sqlite3` module downloads a prebuilt binary or compiles during `npm install`).

## Quick start

```bash
git clone https://github.com/infobotsteven/TodoFrenzy.git
cd TodoFrenzy
npm install
npm run dev              # backend :3000 + frontend :5173 (with hot reload)
```

Open http://localhost:5173 and log in with **`admin` / `admin`** (the default credentials — **change them**, see below).
Database migrations are applied automatically on server start and the database file is created at `data/todo.db`. Configuration lives in a `.env` file
(copy the template: `cp .env.example .env`, in PowerShell `Copy-Item .env.example .env`) — without it, sensible defaults apply.

Demo data (in Polish): `npm run seed:demo` (against a running dev server).

### Login and changing the password

The app requires a login (one shared account; several people can be logged in at once, a session lasts 7 days from the last activity). The account is configured in `.env`, not in the database:

```bash
npm run auth:hash -- "yourNewPassword"      # prints an AUTH_PASSWORD_HASH='...' line
```

Paste that line into `.env` (optionally also `AUTH_USER=...`) and restart the server — changing it **logs everyone out**. With no settings, `admin`/`admin` applies (the server warns in its log).
After 5 failed attempts from one address, login is blocked for 15 minutes. Details: [docs/SECURITY.md](docs/SECURITY.md).

### Production build (one process, one port)

```bash
npm run build
npm start                # Fastify serves the API and the built frontend on :3000
```

Then open http://localhost:3000.

### Configuration (`.env`)

| Variable | Default | Meaning |
|---|---|---|
| `HOST` | `0.0.0.0` | listen address (`0.0.0.0` = the whole local network) |
| `PORT` | `3000` | server port |
| `DATABASE_PATH` | `./data/todo.db` | the SQLite file |
| `BACKUP_DIR`, `BACKUP_KEEP` | `./backups`, `14` | backup directory and number of backups kept |
| `AUTH_USER`, `AUTH_PASSWORD_HASH` / `AUTH_PASSWORD` | `admin` / `admin` | login account (a hash is recommended) |
| `AUTH_SESSION_SECONDS`, `AUTH_MAX_ATTEMPTS`, `AUTH_LOCK_SECONDS` | `604800`, `5`, `900` | session lifetime and lockout after failed attempts |

### Access from a phone (local network)

The server listens on `0.0.0.0` and prints its network addresses on start (e.g. `http://192.168.x.x:3000`; in dev mode the frontend is on port `5173`).
Windows blocks incoming connections — run this once in PowerShell as administrator:

```powershell
New-NetFirewallRule -DisplayName "TodoFrenzy" -Direction Inbound -Protocol TCP -LocalPort 3000,5173 -Profile Private -Action Allow
```

It helps to reserve a fixed IP address for the computer in your router so saved links keep working.
On a local network the password and session travel over plain HTTP — **do not expose the app to the internet** without HTTPS (a reverse proxy) and without changing the default password
(see [docs/SECURITY.md](docs/SECURITY.md)).

### Backups

```bash
npm run db:backup        # a consistent copy of the database into backups/ (the 14 newest are kept)
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | server (tsx watch) and Vite together |
| `npm run build` / `npm start` | build the frontend and server / run the production build |
| `npm run typecheck` | TypeScript in all packages |
| `npm run lint` | ESLint (TypeScript + React hooks rules) |
| `npm run lint:unused` | knip: dead exports, unused files and dependencies |
| `npm run test:e2e` | build + browser tests on a throwaway instance with a temporary database (needs Edge or Chrome installed, see [docs/TESTING.md](docs/TESTING.md)) |
| `npm run auth:hash -- "password"` | password hash for `.env` (`AUTH_PASSWORD_HASH`) |
| `npm run seed:demo` | loads demo data into a running server |
| `npm run db:generate` | generates a migration after changing `server/src/db/schema.ts` |
| `npm run db:migrate` | applies migrations manually (the server does it on start anyway) |
| `npm run db:backup` | a consistent database copy into `backups/` |

## Repository structure

```text
shared/   Zod schemas, types and constants shared by frontend and backend (the source of truth for the API)
server/   Fastify + SQLite (better-sqlite3) + Drizzle; migrations in server/drizzle
client/   React 19 + Vite + TypeScript (TanStack Query, Zustand, dnd-kit, react-router)
e2e/      browser tests (Playwright) + demo data
docs/     documentation (English in docs/, Polish in docs/pl/)
logo/     the "Odhacz" logo (SVG/PNG)
data/     the SQLite file (created on first run, not in git)
```

## Documentation

English documentation is canonical and lives in `docs/`; Polish translations are in `docs/pl/`.

| Document | Contents |
|---|---|
| [FEATURES.md](docs/FEATURES.md) | what the app does, behavior rules, views |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | layers, data flow, realtime, state, drag and drop, CSS |
| [DATA-MODEL.md](docs/DATA-MODEL.md) | tables, relations, migrations, conventions |
| [API.md](docs/API.md) | REST endpoints, errors, WebSocket events |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | how to work on the code, recipes for common changes, pitfalls |
| [TESTING.md](docs/TESTING.md) | E2E tests: running, data, writing new ones |
| [SECURITY.md](docs/SECURITY.md) | threat model, safeguards, limitations |
| [ROADMAP.md](docs/ROADMAP.md) | open topics and ideas (Docker, authentication…) |

## Notes

- Code comments and the demo data are in Polish (the language the project started in); interface texts have complete EN and PL versions.
- Development happens on the `develop` branch; `main` holds releases (tags `vX.Y.Z`).

## License

[MIT](LICENSE) © 2026 infobotsteven
