# Architektura

Wersja angielska (kanoniczna): [../ARCHITECTURE.md](../ARCHITECTURE.md).

## Przegląd

Monorepo npm workspaces: **`shared`** (schematy Zod, typy, stałe — źródło prawdy dla kontraktu API), **`server`**
(Fastify 5 + SQLite przez better-sqlite3 i Drizzle ORM) oraz **`client`** (React 19 + Vite 7). Pakiet `shared` jest
konsumowany jako źródła TypeScript (bez budowania): importują go zarówno Vite, jak i tsx/tsup.

```text
 przeglądarka (React)                         serwer (Fastify)                 dysk
 ┌──────────────────────┐   REST /api/*   ┌────────────────────────┐
 │ TanStack Query (dane)│ ──────────────► │ trasy (walidacja Zod)  │ ──► SQLite (WAL) data/todo.db
 │ Zustand (stan UI)    │                 │ db/queries, reorder…   │
 │ dnd-kit, react-router│ ◄────────────── │ emit() → WebSocket     │
 └──────────────────────┘   WS /ws        └────────────────────────┘
```

W produkcji jeden proces Node serwuje i API, i zbudowany frontend (`@fastify/static`, fallback SPA na `index.html`,
`/api/*` zostaje 404). W dev frontend działa na Vite (`:5173`) z proxy `/api` i `/ws` do serwera (`:3000`); proxy **zachowuje nagłówek `Host`** (`changeOrigin: false`), bo serwer porównuje go z `Origin` (ochrona CSRF).

## Podział odpowiedzialności

| Warstwa | Odpowiada za |
|---|---|
| React | UI, formularze, nawigacja, interakcje, drag & drop |
| TanStack Query | **dane z serwera**: cache, odświeżanie, aktualizacje optymistyczne |
| Zustand (`client/src/store.ts`) | wyłącznie **stan UI**: motyw, układ list, filtry, wyszukiwarka, komunikaty (toasty), stan połączenia, sortowanie zaległych. Nie dublujemy w nim danych z API |
| Fastify | API, walidacja wejścia (Zod z `shared`), logika, SQLite, WebSocket |
| SQLite | jedyne źródło prawdy o danych; plik jest tylko po stronie serwera |

## Backend (`server/src`)

```text
index.ts          start: migracje → ensureSystemProject → Fastify (błędy, nagłówki, WS, trasy, statyczny frontend)
config.ts         HOST, PORT, DATABASE_PATH, BACKUP_DIR; ścieżki katalogów
security.ts       nagłówki bezpieczeństwa (CSP ze skrótami skryptów inline, nosniff, no-referrer, X-Frame-Options) i strażnik Origin
                  (CSRF: zmiany danych z obcego Origin → 403; `originMatchesHost` współdzielone z WebSocketem)
auth.ts           logowanie: konto z .env (scrypt), sesje w SQLite (skrót tokenu, sliding, odcisk poświadczeń), blokada prób, ciasteczko `todofrenzy_session`
auth-hash-cli.ts  `npm run auth:hash` — hash hasła do .env
errors.ts         HttpError, notFound, globalny handler (ZodError → 400, błędy 4xx Fastify, reszta → 500 bez szczegółów)
realtime.ts       /ws (heartbeat ping/pong) i emit(req, event) – rozsyła zdarzenie do wszystkich klientów
routes/           auth (login/logout/me; hook w `routes/index.ts` wymaga sesji dla całego /api poza health i logowaniem), projects (+ archive/restore), checklists, tasks, tags, users, calendar (kalendarz, zaległe, bez terminu, archiwum, źródła filtrów), index
db/schema.ts      tabele Drizzle (patrz MODEL-DANYCH.md)
db/client.ts      połączenie (WAL, foreign_keys=ON, busy_timeout), runMigrations
db/queries.ts     odczyty złożone (projekty z licznikami, listy z zadaniami/tagami/użytkownikami), pomocnicze (next*Sort, touchProject)
db/reorder.ts     zmiana kolejności „w slotach” (patrz niżej)
db/duplicate.ts   kopiowanie projektu/listy
db/system.ts      ensureSystemProject, isSystemProject (stały projekt „Inne”)
db/backup-cli.ts  kopia zapasowa (npm run db:backup)
```

Wzorzec trasy: `parse(zod)` → sprawdzenie istnienia/reguł → zapis (w transakcji, gdy dotyka wielu tabel) →
`touchProject()` (odświeża „Zaktualizowano”) → `emit(req, zdarzenie)` → odpowiedź z aktualnym obiektem.

**Kolejność (`sort_order`)** jest jawna. Nowy element dostaje `max+1`. Zmiana kolejności działa „w slotach”: przesłane id
dostają kolejno te same wartości `sort_order`, które zajmowały wcześniej (posortowane rosnąco); elementy spoza listy
zostają na swoich miejscach — dzięki temu równoległe dodanie/usunięcie przez kogoś innego nie psuje kolejności.
Id muszą należeć do jednego rodzica (inaczej 400).

**Stały projekt „Inne”:** kolumna `projects.is_system`; reguły egzekwują trasy (usuń/zmień nazwę i kolor/dodaj,
skopiuj lub usuń listę/przesuń). Lista projektów jest zawsze sortowana `is_system desc, sort_order, created_at`.

**Identyfikatory:** 16 znaków `[0-9a-z]` z nanoid (~82 bity) — id projektu jest „sekretem” w linku.

**Daty zadań** to tekst `YYYY-MM-DD` (bez godziny i strefy). Serwer nie zna strefy czasowej klienta, więc „dzisiaj”
przychodzi z przeglądarki (`/overdue?before=YYYY-MM-DD`).

## Frontend (`client/src`)

```text
main.tsx            QueryClient, globalny onError mutacji (toast), notifyManager synchroniczny (patrz niżej)
App.tsx             bramka logowania (useMe: ładowanie / ekran logowania / aplikacja), pasek z „Wyloguj”, router (/, /project/:id), toasty; `useRealtime()` działa tylko dla zalogowanych
                    (AuthedApp), a 401 z dowolnego zapytania wraca do ekranu logowania (`setSession` czyści dane z pamięci, ale zostawia zapytanie o sesję)
api.ts              fetch + ApiError + clientId (nagłówek X-Client-Id) + język (nagłówek X-Lang)
stats/              zakładka „Statystyki”: StatsSection (pudełka), BarChart, ActivityHeatmap, ProjectTiles (kafle projektów), counts (dni wg strefy przeglądarki); dane z queries/stats.ts (`/stats/completions`)
i18n/               języki interfejsu PL/EN: index.ts (t(), useLang, setLang), define.ts, messages/<obszar>.ts (PL i EN obok siebie); App montuje drzewo z key={lang}
realtime.ts         WebSocket: ponawianie z narastającym opóźnieniem, invalidacja zapytań wg zdarzeń
store.ts            Zustand (UI)
queries/            hooki TanStack Query wg dziedzin: projects (+archiwizacja), checklists, tasks, reorder, calendar (zapytania widoków + zmiany zadań),
                    taskCaches (aktualizacje optymistyczne wszystkich widoków zadań), users, tags, shared (klucze, invalidacja)
pages/              LoginPage, ProjectsPage (strona główna: zakładki Projekty/Archiwum + PlannerSection), ProjectPage (z banerem archiwum)
calendar/           PlannerSection (zakładki) → CalendarSection | TaskGridSection (zaległe / bez terminu / archiwum) z TaskGridCard;
                    DayColumn, CalendarTaskCard, modale (termin, nowe zadanie), CalendarFilters (+ sekcja „Projekty archiwalne”), filtering, WeekPicker, dates
components/         ChecklistCard (+ TaskRow, AddTask), ProjectCard, forms, dnd, TaskFilters, UserParts, avatars, Pagination, ConfirmDialog, Modal, ColorPicker, …
confirm.ts          askConfirm(): potwierdzenia w stylu aplikacji (zamiast window.confirm)
styles/             CSS podzielony na moduły; index.css importuje je w kolejności kaskady
labels.ts (etykiety, nazwy stałego projektu/listy w języku UI), format.ts (daty wg języka), paste.ts, useColumnCount.ts, useMediaQuery.ts   małe moduły pomocnicze
```

### Dane i cache (TanStack Query)

Klucze: `['projects']`, `['project', id]`, `['calendar', from, to]`, `['calendar','sources']`, `['overdue', dzisiaj]`, `['undated']`, `['archive']`,
`['users']`, `['tags']`. Po każdej mutacji `useInvalidate()` odświeża projekty, otwarte projekty, kalendarz, zaległe, „Bez terminu” i archiwum.

**Aktualizacje optymistyczne** (żeby telefon reagował od razu, a drag & drop się nie „szarpał”):
- zaznaczenie zadania w projekcie (`useToggleTask`),
- zmiana kolejności projektów/list/zadań (`useOptimisticReorder`) — cache zmienia się **synchronicznie w obsłudze upuszczenia**,
- zmiana terminu/wykonanie z kalendarza i zakładek-siatek (`useOptimisticTaskChange` + `patchTaskCaches` w `queries/taskCaches.ts`: jedna zmiana trafia
  do kalendarza, zaległych, bez terminu i archiwum naraz, z migawką do wycofania przy błędzie).
  Zasada: zadanie, którego termin się nie zmienia (samo „wykonane”), **zostaje na swoim miejscu**; zmiana terminu wstawia je
  na koniec nowego dnia do czasu odpowiedzi serwera.

**Ważne:** w `main.tsx` `notifyManager.setScheduler(cb => cb())` — domyślnie TanStack powiadamia komponenty w kolejnym zadaniu
(`setTimeout 0`), przez co React renderował koniec przeciągania ze starą kolejnością, a nową chwilę później (skok elementu).

### Realtime

Serwer po każdej zmianie wywołuje `emit()` — zdarzenie typowane w `shared/src/events.ts` (np. `task.updated`, `project.reordered`).
Klient dołącza do żądań nagłówek `X-Client-Id` (losowy na kartę), serwer dopisuje go do zdarzenia jako `origin`, a klient
**pomija własne zdarzenia** (jego cache już jest zaktualizowany po zapisie). Cudze zdarzenia → `invalidateQueries`
(zawsze `projects`, `calendar`, `overdue`; szczegóły projektu tylko dla projektu ze zdarzenia). Przy utracie połączenia:
baner, ponawianie `min(1s·2ⁿ, 10s)`, natychmiastowa próba po `online`/powrocie karty, po ponownym połączeniu pełna invalidacja.
Serwer co 30 s pinguje klientów i zrywa nieodpowiadających.

### Drag & drop (`components/dnd.tsx`, dnd-kit)

- `SortableList` + `SortableItem` dla projektów, list i zadań; kalendarz ma własny `DndContext` (zadania → dni).
- Wykrywanie kolizji: `pointerWithin` z awaryjnym `closestCenter` (upuszczenie liczy się tam, gdzie jest kursor).
- `DragOverlay` pokazuje kopię „w ręku”, oryginał jest przygaszony; `animateLayoutChanges: () => false`, a
  `flushSync` w `onDragEnd` + synchroniczny cache wyklucza „wskakiwanie na miejsce”.
- `flipSiblings` — animacja FLIP sąsiednich kart po zmianie kolejności (w masonry karta może zmienić kolumnę).
- Uchwyt przeciągania (⋮⋮) jest osobnym przyciskiem; klik w treść karty nie rozpoczyna przeciągania.

### Układ list (masonry)

`useColumnCount` liczy kolumny z szerokości kontenera (`ResizeObserver`; uwzględnia skalę roota, bo wymiary podajemy przy
100%), `splitIntoColumns` rozdziela listy po kolei (lista N → kolumna N mod K), `.board-col` ma `flex: 1 1 var(--list-width)`
z limitem 1,5× — kolumny wypełniają rząd. Stała `LIST_WIDTH = 340` (px przy 100%) = szerokość listy w sliderze.

### Style (`client/src/styles/`)

Jeden współdzielony arkusz podzielony na moduły; **kolejność w `index.css` = kolejność kaskady** (nie zmieniać bez sprawdzenia
widoku; podział został zweryfikowany porównaniem zrzutów piksel w piksel). Pliki: `base` (tokeny motywów, reset, nagłówki),
`layout`, `controls`, `cards`, `lists-tasks`, `users`, `priorities-tags` (także filtry), `calendar`, `list-view`, `dnd`,
`color-picker`, `modal-forms`, `toasts`, `responsive`, `planner` (zakładki, liczniki, sortowanie, paginacja), `task-grid` (siatka kart zadań),
`project-archive` (zarchiwizowane projekty). Przed i po każdym porządkowaniu CSS porównuj zrzuty widoków (jasny/ciemny) — patrz audyt II.

- **Tokeny:** kolory przez zmienne CSS (jasny motyw w `:root`, ciemny przez `[data-theme='dark']`), skala typografii
  (`--fs-xs … --fs-xl`, `--fw-*`, `--lh-tight`), promienie, `--tap` (44 px). Jedyne dozwolone rozmiary tekstu to tokeny.
- **Skala w `rem`:** praktycznie wszystkie wymiary są w `rem`; od 1100 px `html { font-size: 120% }` powiększa cały interfejs.
  W pikselach zostają tylko cienkie ramki, obrysy, media queries i okręgi (`999px`).
- **Kolor elementu** (`data-color="blue"`) ustawia `--accent`; kafelki, kropki i paski czytają `var(--accent)`.
- Role nagłówków: `h1/.page-title` (strona), `.section-title` (sekcje), `.card-title` (karty i okna). Wspólne bloki:
  `.section-head`, `.filter-panel` / `.filter-row` / `.filter-label`, `.chips` / `.chip`, `.btn` / `.btn-sm`.

### Zdarzenia przeglądarki i pułapki

- `crypto.randomUUID` wymaga HTTPS, a działamy po HTTP w LAN — stąd własny `clientId` z `getRandomValues`.
- Motyw ustawiany jest skryptem inline w `index.html` przed renderem; serwer produkcyjny dopuszcza go w CSP przez skrót sha256.
- `localStorage` zawsze w `try/catch` (tryb prywatny).

## Budowanie i uruchamianie

- `npm run build`: Vite buduje `client/dist`, tsup bundluje serwer do `server/dist/index.js` (cel node22; zależności zewnętrzne).
- `npm start`: `node --env-file-if-exists=../.env dist/index.js`.
- Migracje Drizzle (`server/drizzle/*.sql`) stosują się przy starcie (`runMigrations`). Tylko migracje **addytywne** w praktyce
  (ALTER ADD COLUMN, CREATE INDEX) — patrz [MODEL-DANYCH.md](MODEL-DANYCH.md).
- Docker nie jest jeszcze przygotowany (Etap 6 w [ROADMAP.md](ROADMAP.md)).
