# API

REST under the `/api` prefix, JSON, UTF-8. Login is required (see "Authentication"). Input schemas are Zod schemas in `shared/src/index.ts`
(response types: `shared/src/types.ts`). Task dates: `YYYY-MM-DD`; timestamps in responses: ISO 8601.
The optional `X-Client-Id` header identifies a browser tab (see "WebSocket"). The optional `X-Lang: pl|en` header selects the language of error messages (`{ error }`; Polish by default;
Zod validation messages are always English) — the client sends it with every request according to the selected interface language.

Polish version: [pl/API.md](pl/API.md). Note: server error texts are written in Polish in the source; the `en` map in `server/src/i18n.ts` translates them.
The Polish texts quoted below are what you get without `X-Lang: en`.

## Authentication

All of `/api/*` requires login (the `todofrenzy_session` cookie, `HttpOnly`), **except** `GET /health`, `POST /auth/login` and `POST /auth/logout`. Without a valid session the response is **401**
`{ error: "Wymagane logowanie" }` ("Login required"). The same condition applies to the `/ws` WebSocket (closed with code 1008 without a session). An active session is extended (a new `Set-Cookie`).

| Method and path | Description |
|---|---|
| `POST /auth/login` | `{ user, password }` → 200 `{ user }` + `Set-Cookie`; wrong credentials → 401 `{ error: "Nieprawidłowy login lub hasło" }` (one message for login and password); after 5 failed attempts from one IP → **429** with `Retry-After` (15-minute lockout, also for the correct password) |
| `POST /auth/logout` | deletes the session and the cookie → 204 (also without a session) |
| `GET /auth/me` | 200 `{ user }` for a logged-in user, 401 otherwise (the client uses it to check the login state) |

## CSRF protection

Data-changing requests (POST/PATCH/DELETE) with an `Origin` header different from the application host (`Host` or `X-Forwarded-Host`) get **403** `{ error: "Niedozwolone źródło żądania" }` ("Request origin not allowed").
Browsers attach `Origin` to requests from foreign pages, while clients without `Origin` (scripts, curl, tests) and same-origin requests pass. A `text/plain` body is not
treated as JSON. The first WebSocket request with a foreign `Origin` is closed with code 1008.

## Errors

| Code | When | Body |
|---|---|---|
| 400 | invalid data (`{ error: "Nieprawidłowe dane", issues: [{ path, message }] }`), inconsistent ids, unknown tag/user, trying to move "Other" | `{ error }` |
| 403 | violating the rules of the permanent "Other" project (deleting/archiving the project, adding/copying/deleting its list) or changing data from a foreign `Origin` (see above) | `{ error }` |
| 404 | resource not found ("Project does not exist", "List…", "Task…") | `{ error }` |
| 409 | name conflict (user nickname, tag name) | `{ error }` |
| 5xx | server error — details only in the log | `{ error: "Błąd serwera" }` ("Server error") |

Deleting and reordering return `204` with no body.

## Projects

| Method and path | Description |
|---|---|
| `GET /projects` | list `ProjectSummary[]` (with counters `taskCount`, `completedCount`, `isSystem`); "Other" is always first |
| `POST /projects` | `{ name, description?, color? }` → 201 `ProjectSummary`. The `brown` color is rejected |
| `GET /projects/:id` | `ProjectDetail` — a project with lists (tags) and tasks (users) |
| `PATCH /projects/:id` | partial change `{ name?, description?, color? }`. For "Other", `name` and `color` are ignored |
| `DELETE /projects/:id` | 204; 403 for "Other" |
| `POST /projects/:id/duplicate` | a copy (with lists and tasks as not completed) → 201 `ProjectSummary` |
| `POST /projects/:id/archive` | archives the project (`archivedAt`), idempotent; "Other" → 403. Its tasks go to `/archive` and disappear from `/overdue` and `/undated`; `/calendar` returns them with `projectArchivedAt` |
| `POST /projects/:id/restore` | restores the project from the archive (the whole project with its tasks), idempotent |
| `PATCH /projects/reorder` | `{ ids: string[] }` — the new order (regular projects only; including "Other" → 400) |

## Lists

| Method and path | Description |
|---|---|
| `POST /projects/:projectId/checklists` | `{ name, description?, color?, tagIds? }` → 201 `Checklist`; 403 in "Other" |
| `PATCH /checklists/:id` | `{ name?, description?, color?, tagIds? }` |
| `DELETE /checklists/:id` | 204; the "Other" list → 403 |
| `POST /checklists/:id/duplicate` | a copy with tasks → 201; the "Other" list → 403 |
| `PATCH /checklists/reorder` | `{ ids }` — all from one project |

## Tasks

| Method and path | Description |
|---|---|
| `POST /checklists/:checklistId/tasks` | `{ name, description?, priority?, dueDate?, userIds?, completed?, position? }` → 201 `Task`. `position` (0-based index) inserts into the middle of the list (used by "Undo" after deleting) |
| `POST /checklists/:checklistId/tasks/bulk` | `{ items: [{ name, completed? }] }` (1–200) → 201 `Task[]` (e.g. after pasting a list) |
| `PATCH /tasks/:id` | `{ name?, description?, priority?, dueDate?, userIds? }` (`dueDate: null` removes the due date) |
| `PATCH /tasks/:id/completed` | `{ completed: boolean }` |
| `DELETE /tasks/:id` | 204 |
| `PATCH /tasks/reorder` | `{ ids }` — all from one list |

## Tags and users

| Method and path | Description |
|---|---|
| `GET /tags`, `POST /tags` `{ name }` | list; POST returns the existing tag with that name (case-insensitive) or creates a new one |
| `PATCH /tags/:id` `{ name }`, `DELETE /tags/:id` | rename (409 on conflict) / delete |
| `GET /users`, `POST /users` `{ nick, avatar }` | nickname 1–24 characters, unique case-insensitively (409) |
| `PATCH /users/:id` `{ nick?, avatar? }`, `DELETE /users/:id` | edit / delete (removes the user from tasks) |

## Calendar, overdue, no due date and archive

| Method and path | Description |
|---|---|
| `GET /calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` | tasks with a due date in the range (inclusive, max 93 days) as `CalendarTask[]` (a task + `projectId/Name/Color`, `checklistName/Color`), sorted by: due date, project, list, position |
| `GET /calendar/sources` | projects and lists that have tasks with a due date — the calendar filter options: `projects` (active) and `archivedProjects` (archived, a separate filter section) |
| `GET /overdue?before=YYYY-MM-DD` | not completed tasks with a due date **earlier than** `before` (the client passes today's date) + `sources` (projects/lists with something overdue), oldest first |
| `GET /undated` | not completed tasks **without a due date** (`{ tasks, sources }`), ordered: "Other" first, project, list, position |
| `GET /archive` | **completed** tasks **and all tasks of archived projects** (`{ tasks, sources }`), newest entries first (`coalesce(project's archived_at, task's updated_at)` descending); no pagination. `sources.projects` are active projects and `sources.archivedProjects` archived ones (a separate filter section) |

## Statistics

| Method and path | Description |
|---|---|
| `GET /stats/completions?from=…&to=…` | tasks completed in the time range `[from, to)` (ISO 8601 in UTC, e.g. `2026-10-08T00:00:00.000Z`; max 400 days, `from < to`, otherwise 400): `{ tasks: { id, name, completedAt, projectColor }[] }` from the earliest completed (the names feed the activity map tiles). Days and the time zone are decided by the client (the browser computes day boundaries), so the server groups nothing. Tasks of archived projects count too; deleted tasks disappear |

## Health

`GET /health` → `{ status: "ok", db: "wal" }`.

## WebSocket `/ws`

The client only **listens** — all changes go through REST. After every change the server sends all clients a JSON message
of type `RealtimeEvent` (`shared/src/events.ts`) with an `origin` field = the value of the `X-Client-Id` header of the request that caused the change
(the client with that id ignores the event). Types: `project.created|updated|deleted|reordered`, `checklist.created|updated|deleted|reordered`,
`task.created|updated|completed|deleted|reordered`, `tag.updated|deleted`, `user.updated|deleted`. Task and list events carry `projectId`.
The server pings clients every 30 s and drops unresponsive ones.
