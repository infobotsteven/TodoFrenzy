# Features

What the application does and the rules behind it. The rules matter when changing the code. Technical details: [ARCHITECTURE.md](ARCHITECTURE.md).
Polish version: [pl/FUNKCJE.md](pl/FUNKCJE.md).

> UI names below are the English ones (the interface can be switched between English and Polish). Polish names are given in parentheses where it helps.

## Usage model

- **Login with one shared account** (default `admin` / `admin`, changed in `.env` — see [SECURITY.md](SECURITY.md)). Without logging in only the login screen is visible
  (at any address; after logging in you return to the same address). A logged-in user sees and edits everything; **many people can be logged in at the same time**
  (separate sessions, a session lasts 7 days from the last activity). The **Log out** button is in the top bar. After 5 wrong attempts from one address, logging in is blocked for 15 minutes.
  An expired session during work returns you to the login screen. There are no separate accounts or change authors.
- The app is meant for a local network (a computer plus phones); it is not a PWA (it does not install and does not work offline).
- **Interface language:** English and Polish, switched with the list in the top bar (see "Look and behavior"). Dates follow the selected language; the week starts on Monday.

## Home page

From the top: the "Projects" header with the **+ New project** and **Users** buttons, a search box, the project grid, and below it a section with the tabs
**Calendar**, **Overdue**, **No due date** and **Archive**. The header has three tabs: **Projects**, **Archive** (archived projects) and **Statistics**.

### Projects

- Project card: name, description (2 lines), progress bar and a `completed / total` counter (across all lists of the project), "Updated … ago",
  the project color as a dot before the title (the same on list cards) and a **subtle background and border in the project color** (as the permanent "Other" project had from the start);
  a project without a color has a neutral card, and the border gets stronger on hover.
- Create, edit (name, description, color), delete (with its lists and tasks, after confirmation), **copy**
  (the copy lands right after the original, the name gets " (copy)", all tasks come back as not completed; lists, list tags, due dates and assigned users are copied).
- Reordering by drag and drop (stored in the database). Dragging is disabled while searching.
- Search by name and description (the search state lives in application memory, not in the URL).

### Project archive

- The home page header has two tabs: **Projects** and **Archive** (with the number of archived projects). The archive shows cards of archived
  projects (a shared "archive style": diagonal hatching, dashed border, muted title and progress, an empty color dot, a box icon next to "Archived … ago";
  most recently archived first) with a **Restore** button; search works in both. Tasks of archived projects (calendar, the "Archive" task tab)
  and the "Archived projects" chips in filters use the same style.
- **Archiving:** the **Archive** button in the *Edit project* window (after saving you return to the home page and get a toast with **Undo**). The permanent
  "Other" project cannot be archived. Archiving copies or deletes nothing — it sets the project's `archived_at` marker.
- **Tasks of an archived project** (all of them, also not completed ones): go to the **Archive** task tab (card: "Project archived" + date,
  a **Restore project** button, a disabled checkbox), **disappear** from "Overdue" and "No due date", and are **hidden by default** in the calendar.
- **Restoring a task restores the whole project:** "Restore project" on a task card in the archive (or "Restore" on the project card / in its edit window /
  in the banner on the project page) undoes the archiving — the project returns to the list and its tasks to the calendar, "Overdue" and "No due date". Tasks that were
  already completed stay in the archive as ordinary completed tasks.
- **Back button:** on the page of an archived project it reads "← Archive" and returns to the "Archive" tab (the home page tab is in the URL: `/?widok=archiwum`,
  so the browser's Back button works too); on the page of an ordinary project it reads "← Projects".
- The page of an archived project works (you can open and edit it) but has a banner "This project is archived" with a **Restore project** button.
  The "New task" window in the calendar does not offer archived projects. A copy of an archived project is an ordinary, active project.

### The permanent "Other" project

- Exactly one, created automatically at server start if missing. Always **first** in the list, excluded from
  dragging. It has the reserved **brown** color (`brown`, which is not in the color palette), so no other project can get it.
- It **cannot be deleted**, renamed, recolored (only the description can be edited) or moved. It has **one list, "Tasks"**,
  which cannot be deleted or copied, and no further lists can be added. The server enforces the rules (HTTP 403/400).
- A copy of the "Other" project is an ordinary project "Other (copy)" without the brown color.
- In the UI its name and list are shown in the interface language ("Other" / "Tasks" in English, "Inne" / "Zadania" in Polish); in the database they are stored in Polish.
- It is the default target when adding tasks from the calendar.

## Project view (`/project/:id`)

- Header (name, description, progress, **Edit project**), a "Projects" button above the title.
- Action bar above the lists: **Grid / Slider** switch (wide screens only), **Tags**, **+ New list**.
- **Task filters:** priority (one), "Hide completed", tag (shows only lists with that tag), users
  (multi-select + "Unassigned"). Filters only hide things — they change nothing in the data.

### Lists

- Name, description, color, **tags** (tags belong to lists, not to tasks), order (drag and drop), copying (with tasks),
  deleting. A list **has no dates** (dates belong to tasks).
- **Two layouts from 640 px width** (remembered in the browser, key `listView`):
  - *Grid* — masonry-like columns: lists stack one under another without gaps; the number of columns follows the width,
    list number N goes to column N mod the number of columns. Columns stretch to fill the row edge to edge
    (horizontal gap = vertical gap), up to 1.5 × the minimum list width.
  - *Slider* — a single row scrolled horizontally; lists have a fixed width (the same as the minimum in the grid).
  - On a phone, lists are stacked.
- Long texts wrap (`overflow-wrap: anywhere`); cards have no inner scrolling.

### Tasks

- Fields: name, description, **priority** (none / low / medium / high), **one due date** (a date without time),
  **assigned users**, completion state.
- **Quick add:** a field below the list; Enter adds and keeps the focus. **Pasting multi-line text** is recognized as a list of tasks
  (at least two non-empty lines, at most 200) — each line becomes a task; bullets and numbering (`-`, `*`, `•`, `1.`, `2)`) and `[ ]` / `[x]` boxes are stripped, and `[x]` marks the task as completed.
  A single line pastes as ordinary text.
- **Completing:** ticking does not move the task — it stays in place, grayed out and struck through. Optimistic UI.
- **One-click delete** (icon next to the task) with an **Undo** toast — the task returns to the same place
  with its completion state and the other fields. The delete button disappears after dragging (it does not stay in a hover state).
- Reordering by dragging within a list (the ⋮⋮ handle). Dragging uses a "held" overlay with no jumping.
- Due date: a badge with the date; overdue and not completed = a red "overdue".

## Users

- A nickname (unique, case-insensitive) + **a round avatar: a pixel animal** (12 to choose from: cat, dog, fox,
  bear, rabbit, panda, frog, piglet, owl, penguin, lion, koala). The 16×16 drawings live in code (`client/src/components/avatars.ts`).
- Managed from the **Users** button on the home page (add / edit nickname and avatar / delete). A new user
  can also be added in the task window — and is assigned to the task right away.
- Assigned to tasks like tags (many per task), visible on tasks in lists, in the calendar and in "Overdue",
  filterable in the project, the calendar and "Overdue" (including "Unassigned").
- Deleting a user removes them from tasks but does not delete the tasks. A nickname/avatar change refreshes live for everyone.

## Tags

A global pool of names (unique, case-insensitive) assigned to **lists**. The **Tags** window in the project view:
rename and delete. Typing the name of an existing tag in the list form adds it instead of creating a duplicate.

## Calendar (home page → "Calendar" tab)

- A week (Mon–Sun): 7 columns from 1600 px screen width, below that the columns wrap (min. about 12 rem), on a phone the days
  are stacked. Today is highlighted ("today"), past days are muted.
- Navigation: previous/next week, **Today**, **week picker from a monthly calendar** (a window with a day grid).
  Neighboring weeks are prefetched.
- A task in the calendar: a checkbox (completed), name, **project › list** (with colored dots; the project is a link),
  priority, users. Overdue not completed tasks are tinted red.
- **Changing the due date:** drag to another day (the ⋮⋮ handle) or click the name → a window with a date field and quick
  **Today / Tomorrow / In a week**; "Remove due date" takes the task off the calendar (it stays in its list).
- **Adding tasks:** the **+** button in each day header and **+ Task** in the section header. The window: title, description,
  project, list, date (the clicked day by default), priority, people. **Without choosing a project the task goes to "Other" → "Tasks".**
  A project without lists shows "No lists" and an error on save.
- **Hide completed:** a checkbox under the calendar header (above the filters) removes completed tasks from the days; the choice is **remembered in the browser** (`calendarHideCompleted`) and independent of filters
  ("Clear filters" does not turn it off). The per-day count shows only visible tasks, while the week summary ("X to do out of Y tasks") still counts all tasks after filters; when all are hidden
  a message is shown. Completing a task while the option is on hides it immediately. The option applies to the calendar only (the Overdue / No due date / Archive tabs are unchanged).
- **Filters** (separate state from "Overdue"): projects (after choosing a project its lists appear), **archived projects**, priority (multiple),
  users (+ "Unassigned").
- **The bar above the filters and the "Clear filters" button:** above the filter rows there is a bar with view options (in the calendar "Hide completed") and a **permanent "Clear filters" button** — visible from the start, disabled
  when there is nothing to clear ("Hide completed" alone does not enable it). The same button (without the option next to it) is in the **Overdue, No due date and Archive** tabs, and each tab has its own filter state.
- **Archived projects:** tasks of archived projects are hidden by default. The "Archived projects" filter section (dashed chips, only
  when an archived project has tasks with a due date) lets you **additionally** show them — muted, with a dashed border; they obey the people and
  priority filters. "Clear filters" hides them again.

## Overdue (home page → "Overdue" tab)

- **Overdue = not completed tasks with a due date earlier than today** (today is computed in the browser).
  Tasks without a due date, with a due date of today or later, and completed ones are not overdue.
- A red **counter** on the tab (always visible, also while the calendar tab is shown).
- A **card grid** (not a calendar): each card has a checkbox, name, description (2 lines), project › list, priority, people and
  a footer: the "Due" label, **the date the task was supposed to be done** (with the weekday), "N days overdue"
  and a **Change due date** button (the same window as in the calendar, with Today / Tomorrow / In a week shortcuts).
- Cards in a row have equal height; the footer is always at the bottom.
- **Filters** as in the calendar (projects → lists, priority, users), with their own state (kept when switching tabs).
  The filter options cover only projects/lists that have something overdue.
- **Sorting:** oldest due dates first (default) / newest first.
- Changing the due date to today or later, completing a task, or a change made by someone else **removes the card from the view**;
  a still-past due date changes the card in place and recomputes the order.

## No due date (home page → "No due date" tab)

- **Not completed tasks that have no date** (completed ones and ones with a date are not shown). The tab is built like "Overdue"
  (the shared `TaskGridSection` component): a card grid, the same filters (projects → lists, priority, users; separate state), a (gray)
  counter on the tab.
- Card: checkbox, name, description, project › list, priority, people and a footer: "Due — **No due date**", "Added {date}" and a
  **Set due date** button (a window with a date field and Today / Tomorrow / In a week shortcuts; "Save" is disabled until a date is chosen).
  Tasks from "Other" have the brown style.
- **Sorting:** by projects and lists (default, "Other" first, then the order used in projects), newest first / oldest first
  (by the task's creation date; stored with 1 s resolution).
- Setting a due date or completing removes the card from the view (a task with a date appears in the calendar); removing a task's due date
  (e.g. in the calendar via "Remove due date", or by someone else) makes the task appear here — live as well.

## Archive (home page → "Archive" tab)

- **Completed tasks** (with and without a due date) **and all tasks of archived projects** (see "Project archive") in the same card grid as "Overdue" and "No due date" (the shared `TaskGridSection`),
  with the same filters (separate state) and a gray counter on the tab. The card has a ticked checkbox and a **not struck-through** name.
- **Filters in the archive:** projects are in two separate sections — "Projects" (active) and "Archived projects" (dashed chips with an empty dot), as in the calendar. Unlike the calendar,
  nothing is hidden by default here: with no selection all tasks are shown, and choosing chips from one or both sections shows only tasks of the chosen projects (alternative). After choosing an active project
  a "Lists" row appears (under "Projects"), and after choosing an archived project a separate **"Archived lists"** row (under "Archived projects", dashed chips) — the two kinds of lists
  do not mix. People and priority filters apply to everything.
- Card footer: the "Completed" label, the **completion date** (green), below it "Was due: …" or "No due date", and a **Restore** button.
  The completion date is the time of the task's last change at the moment of completion (`updated_at`) — a later edit of the task moves it.
- **Restoring:** the "Restore" button or unticking the checkbox marks the task as not completed and removes it from the archive; it returns to its
  list and, depending on the due date, appears in "Overdue", "No due date" or in the calendar.
- **Sorting:** most recently completed (default) / least recently completed. Tasks completed in other views (list, calendar, overdue,
  no due date) land here immediately, and changes by other people appear live.
- The archive is not a separate flag — it is simply tasks with `completed = true`; in projects they stay in place.

## Statistics (home page → "Statistics" tab)

The third tab next to "Projects" and "Archive" (URL `/?widok=statystyki`); when it is selected there is no search box, project grid or calendar. All numbers concern **completed tasks** and are counted by the completion
time (`completed_at`) in the browser's time zone; unticking a task removes it from the statistics, and changes by other people refresh the numbers live.

- **Completed today** — a number and today's date.
- **Completed tasks (sum)** — the sum over the last days (today included) and the daily average; the range from a list: 7 (default) / 14 / 30 / 90 days.
- **Projects** — two tiles: **Active projects** (a dot in the brand color) and **Archived projects** (archive look: hatching, dashed border, box icon). Each shows the number of projects
  (without the permanent "Other", as noted under the tiles), a **progress bar of those projects' tasks** and a caption "Completed X of Y tasks" with a percentage (or "No tasks"). The tiles link to the "Projects" and "Archive" tabs;
  archiving, restoring, adding and deleting projects and completing tasks (also by other people) change them live.
- **Completed in the week** — a bar chart of one week (Monday–Sunday, 7 bars): the current week by default, the arrows **move between weeks** (the date range sits between the arrows), "This week" returns to the
  current one. Today's bar is highlighted, days after today are empty and muted, numbers are above the bars, and every bar has a tooltip with the date and count. The chart grows with the height of its box.
- **Activity in the month** — a GitHub-style map: columns are weeks, rows are weekdays (from Monday), the tile color (5 levels, in the brand color) depends on the number completed relative to the best day
  of the month. Tiles **fill the whole card** and show the day number, the **number completed** and the names of the first tasks (with 3+ tasks one name and "+N more"; no names on a phone); the tooltip lists
  up to 12 tasks as bullets. The current month by default, arrows pick others, "This month" returns to the current one; today has an outline. A "Less … More" legend.
- Layout: on a wide screen two numbers, the chart and the "Projects" box are on the left and a tall activity map on the right (extra height goes to the chart); on a phone the boxes are stacked.
- **Historical data:** tasks completed before statistics were added (migration 0010) have a completion date equal to the task's last change, so their distribution over time is approximate. Deleted tasks and tasks
  re-created by "Undo" of a deletion are counted from the moment of re-creation.

## Pagination (Overdue, No due date, Archive)

- Each of the three grid tabs splits cards into **pages**. Below the grid is a bar: the range ("Items 25–48 of 95"), **‹ ›** buttons, page numbers
  (the first, the last and the neighborhood of the current one, the rest as "…") and a **"Per page": 12 / 24 (default) / 48 / 96 / All** selector.
- The page size is shared by the three tabs and **remembered in the browser** (`pageSize`); "All" turns pagination off.
- The bar does not appear when there are no more than 12 items. Changing the page scrolls back to the section header.
- The page number **returns to 1** after changing filters, sorting or the page size, and when switching tabs. When the list shrinks (e.g. after completing tasks
  or a change by someone else), the current page is clamped to the last existing one.
- Pagination is **client-side** (the server returns all tasks of a view; filters and sorting are client-side too) — for very large
  data sets consider server-side pagination (see [ROADMAP.md](ROADMAP.md)).

### Project pagination (home page → "Projects" and "Archive")

- The same rules and the same bar (range, ‹ ›, page numbers, "Per page") below the project list — separately for the "Projects" and "Archive" tabs (one page number per tab, which returns to 1 after changing
  the tab, the search or the page size; after the list shrinks the page is clamped).
- **The project page size is separate from the task page size** (`projectPageSize`, default **12**; 12 / 24 / 48 / 96 / All), because project cards are bigger. The bar appears only when there are more than 12 projects.
- The permanent "Other" project is always first, so it lies on page 1. **Dragging reorders within the current page** (the server gives the dragged projects the slots they already occupied, the rest stay);
  to move a project to another page use "All" or drag step by step. Dragging is still disabled while searching.

## Look and behavior

- **Interface language (PL / EN):** a list "PL · Polski / EN · English" in the top bar, next to the theme switch (also on the login screen). Polish is the default; the choice is saved in the browser (`lang`)
  and sets `<html lang>`. All application texts are translated (buttons, labels, messages, confirmation windows, tooltips and accessibility labels), as are **dates and day/month names** (per language),
  **plurals** ("1 task / 5 tasks", "1 zadanie / 3 zadania / 5 zadań") and **server error messages** (the client sends an `X-Lang` header). User data (names of projects, lists, tasks, tags, nicknames)
  stays unchanged; the permanent "Other" project and its "Tasks" list show as "Inne" / "Zadania" in Polish (they are stored in Polish in the database). Changing the language rebuilds the screen immediately (open windows close).
- **Light/dark theme:** a switch in the header; the choice is saved in the browser (`theme`), the system theme by default;
  a script in `index.html` applies it before the first render (no flash).
- **The "Odhacz" logo** (sources in the `logo/` directory: `svg/`, `png/`): the top bar shows an **icon tile** (light theme: a dark teal tile `odhacz-icon`, dark: a lime
  `odhacz-icon-inverse`), the login screen shows **just the mark** above the title (light: ink `mark-ink`, dark: paper `mark-paper`). The `components/Logo.tsx` component renders both versions
  and CSS (`.on-light` / `.on-dark` by `[data-theme]`) hides the inactive one. Browser tab: `favicon.svg` + 16/32 PNG and `apple-touch-icon` in `client/public/`; the browser bar color
  follows the system theme (`theme-color`). The application name in the UI and in the tab title is "TodoFrenzy"; on a narrow phone (≤ 480 px) the name next to the logo is hidden.
- **Brand colors in the UI** (from the logo): tokens `--brand`, `--brand-hover`, `--on-brand`, `--brand-text`. Light theme: primary buttons, the calendar "+", checkboxes, the "today" badge, tab underlines and selections
  in **dark teal** (`#0E3B3C`) with lime text, the page background in "paper" color (`#F3F5EE`). Dark theme: the same elements in **lime** (`#D6F25C`) with teal text, backgrounds slightly darkened towards teal.
  The theme switch: a lime track in light, a teal one in dark. Project and list colors (the palette) and priorities are unchanged.
- **Project color as identity:** besides the dot, the project color gives a subtle **background and border** (7% / 35% of the color) to project blocks in the list and to **tasks** in the calendar and in the Overdue / No due date /
  Archive tabs (a task takes the color of its project; a project without a color = neutral). An overdue task in the calendar keeps the project color and only gets a reddish border (without a project color it still has a reddish background).
  Archived projects and their tasks keep only a faint trace of the color (4% background, 28% border) under the hatching and the dashed archive border. Implementation: `[data-color]` on `.project-card` and `.cal-task`.
- **Colors** of projects and lists: a 10-color palette (red, orange, yellow, green, teal, blue, indigo,
  purple, pink, gray) or none. Shades depend on the theme.
- **UI scale:** from 1100 px screen width the whole interface is **20% larger** (`html { font-size: 120% }`,
  all dimensions in `rem`). 100% on a phone.
- **Unified typography:** page title 28 px, section title 22 px, card title 18 px (at 100%); one size scale
  in CSS tokens (see [ARCHITECTURE.md](ARCHITECTURE.md)).
- **Mobile-first:** no horizontal scrolling, touch targets ≥ 44 px, modal windows fit the screen.
- **Messages (toasts)** about save errors and actions (e.g. "Undo").
- **Delete confirmations** (project, list, task from the edit window, tag, user) are application-styled windows, not native browser
  dialogs: a title, a description with the name of the deleted item (and the number of tasks), a **Cancel** button (it has the focus, Esc also cancels)
  and a red confirm button. One-click task deletion from the list does not ask — it has "Undo".
- **Realtime:** changes by other people appear without refreshing; a banner when the connection is lost and automatic
  reconnecting. With simultaneous edits the last successfully saved write wins (there is no conflict resolution).
