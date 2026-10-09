# Roadmap and open topics

Polish version: [pl/ROADMAP.md](pl/ROADMAP.md). Nothing here is a promise — it is a list of ideas and known gaps.

## Deployment

- **Docker:** a multi-stage image (build the frontend and server → a runtime image `node:22-slim`/alpine with `better-sqlite3`),
  a non-root user, a volume for `DATABASE_PATH` (e.g. `/data/todo.db`), a `HEALTHCHECK` on `/api/health`, `docker-compose.yml`.
  Note: `better-sqlite3` is a native module — build it inside the image for the target architecture.
- **Automatic backups:** a schedule for `npm run db:backup` (cron / system task / sidecar), an off-machine copy,
  restore instructions (they are in [DATA-MODEL.md](DATA-MODEL.md)).

## Authentication and exposure beyond a LAN

There is **one shared account** (from `.env`). Next steps (see [SECURITY.md](SECURITY.md)): separate accounts in the database (hash + salt, possibly tied to the "users with avatars"),
roles and per-project permissions, invitations, changing the password from within the app, HTTPS behind a reverse proxy (+ `trustProxy`), persistent/global rate limiting, 2FA, an audit log of logins and changes.

## Feature ideas (not promised)

- More languages: add a value to `LANGS` (`i18n/define.ts`) and a column to every `defineMessages`; to consider: detecting the browser language as the default (today it is always Polish),
  translating Zod validation messages, translating server logs and CLI messages (they stay in Polish).
- Recurring tasks and reminders, times in due dates, a month view in the calendar.
- Task comments, change history, notifications.
- Attachments; export/import (CSV/JSON); project and list templates.
- Moving tasks between lists and projects by dragging (today only lists/projects can be copied).
- Global task search; **server-side** pagination (the "Overdue / No due date / Archive" tabs already paginate on the client, but the `/overdue`, `/undated`, `/archive` endpoints
  return all tasks — with thousands of records filters, sorting and limits must move to the server).
- Offline mode / PWA (deliberately rejected at the start).

## Technical improvements

- CI (GitHub Actions): `typecheck`, `lint`, `build`, `test:e2e`; unit tests for `shared` and for the `db/reorder`/`duplicate` logic.
- Lazy route loading (code-splitting); renaming `server/src/routes/calendar.ts` to `views.ts` (it already contains overdue, no due date and archive);
  unit tests of server logic (`reorder`, `duplicate`, `loadTaskList`).
- An accessibility audit (screen reader, contrast, keyboard navigation in the calendar).
- Dependency updates: watch `tsup`/`drizzle-kit` (esbuild) and `drizzle-orm`; run `npm audit` regularly.
- Translating code comments (they are in Polish today).
