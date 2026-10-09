# Testing

Polish version: [pl/TESTY.md](pl/TESTY.md).

The automated tests are **browser end-to-end tests** (Playwright driving an installed browser) in the `e2e/` directory — **24 files, about 585 checks**.
They cover whole paths: UI → REST → SQLite → WebSocket → UI. Static checks complement them: `npm run typecheck`, `npm run lint` (ESLint) and `npm run lint:unused` (knip: dead code, files, dependencies).

## Running

```bash
npm run test:e2e                 # build + all tests on a throwaway instance
node e2e/run.mjs calendar users  # only tests whose name contains the given fragments (needs a prior npm run build)
```

Requirements: Microsoft Edge (default) or another Chromium-based browser installed on the system — Playwright uses the system browser and does not download its own.
Select a different one with `E2E_CHANNEL=chrome`.

The harness (`e2e/run.mjs`):
1. starts the **built server** (`server/dist`) on a free port with a **temporary database** in the system temp directory (deleted after the tests),
2. loads demo data (`e2e/seed-demo.mjs` from `e2e/fixtures/demo.json`: 5 projects, 187 tasks, 6 users, tags),
3. runs `e2e/tests/*.mjs` one by one (files starting with `_` are helper modules), passing the addresses in `E2E_BASE` / `E2E_API`,
4. prints a summary and exits non-zero if anything failed.

The test instance has **its own login credentials** (`e2e-admin`; `admin/admin` does not work there). The shared module `e2e/lib.mjs` logs in once and adds the session to all
`fetch` calls to the API and to pages opened through `browser.newPage()`; `plainFetch` and an explicitly created `browser.newContext()` are used to check behavior without logging in.
When running a single test against a dev server, `admin/admin` is used (or `E2E_USER`/`E2E_PASSWORD`).

Development data (`data/todo.db`) is **not touched**. Tests create their own data with the prefix `ZZ-`/`zz-` and clean up after themselves.

Variables: `E2E_CHANNEL` (the Playwright browser channel: `msedge` by default, e.g. `chrome`), `E2E_SHOTS` (a directory for screenshots,
default `%TEMP%/todofrenzy-e2e-shots`).

A single test can also be run against running dev servers (default addresses `:5173` and `:3000`):
`node e2e/tests/overdue.mjs`. **Note:** such tests run against the real dev database — they create and delete their own `zz-` records
but do not touch anyone else's; using the harness is safer.

## What the tests cover

Test names and the demo data are in Polish; the table describes what each file checks.

| File | Scope |
|---|---|
| `calendar.mjs` | the week, navigation, week picker, project/list filters, dragging tasks onto days, changing the due date, realtime, phone, dark theme |
| `calendar-add-task.mjs` | adding tasks from the calendar: "Other" by default, choosing project and list, date, priority, people, a project without lists, validation, phone |
| `calendar-priority-filter.mjs` | the calendar priority filter (multiple, combined with user and project, clearing) |
| `calendar-completion-jump.mjs` | regression: ticking completion in the calendar does not change the order of tasks in a day |
| `overdue.mjs` | the "Overdue" tab: counter, grid, card content, sorting, filters (independent of the calendar), changing the due date, quick "Today", completing, realtime, phone |
| `undated.mjs` | the "No due date" tab: counter, grid, card content, sorting by added date, filters (independent), setting a due date (moving to the calendar), completing, realtime, phone |
| `pagination.mjs` | pagination of the "Overdue/No due date/Archive" tabs: page size, range, navigation, reset on filter/sort change, page clamping when the list shrinks (realtime), "All", remembering the size, phone. The other grid tests set `pageSize=0` (All) via `addInitScript` |
| `project-archive.mjs` | project archiving: the project "Archive" tab, tasks in the task archive, absence from calendar/overdue/no-due-date, the "Archived projects" filter, restoring the whole project (from a task card and from the project), "Other" (403), realtime, phone |
| `archive.mjs` | the "Archive" tab: counter, completed-task cards, sorting by completion, filters, "Restore" and unticking the checkbox (return to Overdue/No due date), realtime, phone |
| `inne-project.mjs` | the permanent "Other" project: API rules (403/400), order, absence of buttons, look, calendar |
| `users.mjs` | users: creating with an avatar, editing, assigning, filters, calendar, realtime, deleting, phone |
| `users-button.mjs` | the "Users" button on the home page (position and behavior) |
| `add-task-modal-overflow.mjs` | the "New task" window (calendar: "+ Task" and "+" in a day): very long project and list names (with and without spaces) do not overflow the window or cause horizontal scrolling — desktop and phone (lists stacked), adding a task still works |
| `project-colors.mjs` | project color on project blocks and tasks (calendar, Overdue), in light and dark themes: background and border tint by color (computed styles), neutrality without a color, "Other", overdue with the project color and a reddish border, the archive trace of color |
| `filters-clear-button.mjs` | the permanent "Clear filters" button in the calendar, Overdue, No due date and Archive: visible and inactive from the start, activates after choosing a filter, clears and does not disappear, separate tab state, in the calendar next to "Hide completed" (which does not activate it and is not cleared), EN, phone |
| `calendar-hide-completed.mjs` | the calendar "Hide completed" (hiding, day counter, unchanged summary, remembering, independence from "Clear filters", the "all hidden" message, completing a task while the option is on, EN, phone) |
| `projects-pagination.mjs` | pagination of "Projects" and "Archive": pages (12 by default), "Other" on page 1, dragging within a page, changing page and scrolling, page clamping when the list shrinks (live), search, page size (separate `projectPageSize`, remembered), page reset on tab change, restoring, EN, phone |
| `stats.mjs` | statistics: `completed_at` (completing/unticking/repeating/created as completed, pasting, copy), `/stats/completions` (range, validation, 401), the tab (completed today, the sum and its ranges, the "Projects" box with live refresh, the week chart with paging, the month map: navigation, tile content and filling), realtime, EN, phone |
| `i18n.mjs` | PL/EN languages: the select next to the theme, translating texts, dates, plurals and the permanent project, server error messages (X-Lang), remembering the choice, the login screen, phone |
| `confirm-dialogs.mjs` | delete confirmation windows (task, tag, list, user, project): content, Cancel/Esc, confirming, focus, phone, no native dialogs |
| `auth.mjs` | login: API and WebSocket without a session, login and the cookie, several users logged in, logout, lockout after failed attempts, session expiry/extension, restart and password change, password hash, the login screen in a browser. Starts **its own server instances** (other ports and databases) |
| `core-features.mjs` | basic features: creating/editing/color/search/copying a project, a list with a tag, quick adding and pasting a task list, editing a task, completing, deleting with "Undo", filters in a project, copying a list, list layout and theme (remembering), error pages |
| `security.mjs` | headers and CSP, input validation, CSRF (foreign Origin, `text/plain`), no CORS, body limit, Origin on WebSocket, SQL and XSS |
| `drag-and-drop.mjs` (+ `_drag-and-drop-checks.mjs`) | dragging tasks and lists: the drop position = the cursor position, dropping into an empty spot, the slider |

## Writing new tests

- A file `e2e/tests/<name>.mjs`, `import { BASE, API, CHANNEL, SHOTS } from '../lib.mjs'`. Model it on `overdue.mjs`:
  create test data through the API (prefix `ZZ-`), delete it **by id** in `finally`, and end with `process.exitCode = fails ? 1 : 0`.
- Rules: never delete data by name or pattern without checking the id; do not assume the database holds anything besides the demo data
  (demo dates are relative to the day of the run); prefer `getByRole` and stable classes (`.cal-task`, `.overdue-card`, `.chip`…).
- Check animations (FLIP, dragging) in Playwright's headless mode — an embedded browser panel may pause `requestAnimationFrame`.
- Always check three things besides the happy path: a phone (no horizontal scrolling), console errors (`pageerror`), and data cleanup.

## Limitations

There are no unit/API tests at the level of the server alone (the browser tests cover the logic) and no CI yet — candidates for the
next step (see [ROADMAP.md](ROADMAP.md)).
