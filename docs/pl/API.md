# API

Wersja angielska (kanoniczna): [../API.md](../API.md).

REST pod prefiksem `/api`, JSON, UTF-8. Wymaga logowania (patrz „Uwierzytelnianie”). Schematy wejścia to Zod w `shared/src/index.ts`
(typy odpowiedzi: `shared/src/types.ts`). Daty zadań: `YYYY-MM-DD`; znaczniki czasu w odpowiedziach: ISO 8601.
Opcjonalny nagłówek `X-Client-Id` identyfikuje kartę przeglądarki (patrz „WebSocket”). Opcjonalny `X-Lang: pl|en` wybiera język komunikatów błędów (`{ error }`; domyślnie polski;
komunikaty walidacji Zod są zawsze po angielsku) — klient wysyła go z każdym żądaniem zgodnie z wybranym językiem interfejsu.

## Uwierzytelnianie

Całe `/api/*` wymaga zalogowania (ciasteczko `todofrenzy_session`, `HttpOnly`), **oprócz** `GET /health`, `POST /auth/login` i `POST /auth/logout`. Bez ważnej sesji odpowiedź to **401**
`{ error: "Wymagane logowanie" }`. Ten sam warunek dotyczy WebSocketu `/ws` (bez sesji zamykany kodem 1008). Aktywna sesja jest przedłużana (nowe `Set-Cookie`).

| Metoda i ścieżka | Opis |
|---|---|
| `POST /auth/login` | `{ user, password }` → 200 `{ user }` + `Set-Cookie`; złe dane → 401 `{ error: "Nieprawidłowy login lub hasło" }` (jeden komunikat dla loginu i hasła); po 5 błędnych próbach z jednego IP → **429** z `Retry-After` (blokada 15 min, także dla poprawnego hasła) |
| `POST /auth/logout` | kasuje sesję i ciasteczko → 204 (też bez sesji) |
| `GET /auth/me` | 200 `{ user }` dla zalogowanego, 401 w przeciwnym razie (klient sprawdza tym stan logowania) |

## Ochrona przed CSRF

Żądania zmieniające dane (POST/PATCH/DELETE) z nagłówkiem `Origin` innym niż host aplikacji (`Host` lub `X-Forwarded-Host`) dostają **403** `{ error: "Niedozwolone źródło żądania" }`.
Przeglądarka dołącza `Origin` do żądań z obcych stron, a klienty bez `Origin` (skrypty, curl, testy) i żądania z tego samego źródła przechodzą. Ciało `text/plain` nie jest
traktowane jak JSON. Pierwsze zapytanie WebSocket z obcym `Origin` jest zamykane kodem 1008.

## Błędy

| Kod | Kiedy | Treść |
|---|---|---|
| 400 | niepoprawne dane (`{ error: "Nieprawidłowe dane", issues: [{ path, message }] }`), niespójne id, nieznany tag/użytkownik, próba przesunięcia „Inne” | `{ error }` |
| 403 | naruszenie reguł stałego projektu „Inne” (usuwanie/archiwizacja projektu, dodawanie/kopiowanie/usuwanie jego listy) albo zmiana danych z obcego `Origin` (patrz wyżej) | `{ error }` |
| 404 | brak zasobu („Projekt nie istnieje”, „Lista…”, „Zadanie…”) | `{ error }` |
| 409 | konflikt nazwy (nick użytkownika, nazwa tagu) | `{ error }` |
| 5xx | błąd serwera — szczegóły tylko w logu | `{ error: "Błąd serwera" }` |

Usuwanie i zmiana kolejności zwracają `204` bez treści.

## Projekty

| Metoda i ścieżka | Opis |
|---|---|
| `GET /projects` | lista `ProjectSummary[]` (z licznikami `taskCount`, `completedCount`, `isSystem`); „Inne” zawsze pierwsze |
| `POST /projects` | `{ name, description?, color? }` → 201 `ProjectSummary`. Kolor `brown` jest odrzucany |
| `GET /projects/:id` | `ProjectDetail` — projekt z listami (tagi) i zadaniami (użytkownicy) |
| `PATCH /projects/:id` | częściowa zmiana `{ name?, description?, color? }`. Dla „Inne” `name` i `color` są ignorowane |
| `DELETE /projects/:id` | 204; dla „Inne” 403 |
| `POST /projects/:id/duplicate` | kopia (z listami i zadaniami jako niewykonanymi) → 201 `ProjectSummary` |
| `POST /projects/:id/archive` | archiwizuje projekt (`archivedAt`), idempotentnie; „Inne” → 403. Zadania trafiają do `/archive`, znikają z `/overdue` i `/undated`; `/calendar` zwraca je z `projectArchivedAt` |
| `POST /projects/:id/restore` | przywraca projekt z archiwum (cały, razem z zadaniami), idempotentnie |
| `PATCH /projects/reorder` | `{ ids: string[] }` — nowa kolejność (zawiera tylko projekty zwykłe; z „Inne” → 400) |

## Listy

| Metoda i ścieżka | Opis |
|---|---|
| `POST /projects/:projectId/checklists` | `{ name, description?, color?, tagIds? }` → 201 `Checklist`; w „Inne” 403 |
| `PATCH /checklists/:id` | `{ name?, description?, color?, tagIds? }` |
| `DELETE /checklists/:id` | 204; lista „Inne” → 403 |
| `POST /checklists/:id/duplicate` | kopia z zadaniami → 201; lista „Inne” → 403 |
| `PATCH /checklists/reorder` | `{ ids }` — wszystkie z jednego projektu |

## Zadania

| Metoda i ścieżka | Opis |
|---|---|
| `POST /checklists/:checklistId/tasks` | `{ name, description?, priority?, dueDate?, userIds?, completed?, position? }` → 201 `Task`. `position` (indeks od 0) wstawia w środek listy (używane przez „Cofnij” po usunięciu) |
| `POST /checklists/:checklistId/tasks/bulk` | `{ items: [{ name, completed? }] }` (1–200) → 201 `Task[]` (np. po wklejeniu listy) |
| `PATCH /tasks/:id` | `{ name?, description?, priority?, dueDate?, userIds? }` (`dueDate: null` usuwa termin) |
| `PATCH /tasks/:id/completed` | `{ completed: boolean }` |
| `DELETE /tasks/:id` | 204 |
| `PATCH /tasks/reorder` | `{ ids }` — wszystkie z jednej listy |

## Tagi i użytkownicy

| Metoda i ścieżka | Opis |
|---|---|
| `GET /tags`, `POST /tags` `{ name }` | lista; POST zwraca istniejący tag o tej nazwie (bez względu na wielkość liter) albo tworzy nowy |
| `PATCH /tags/:id` `{ name }`, `DELETE /tags/:id` | zmiana nazwy (409 przy konflikcie) / usunięcie |
| `GET /users`, `POST /users` `{ nick, avatar }` | nick 1–24 znaków, unikalny bez względu na wielkość liter (409) |
| `PATCH /users/:id` `{ nick?, avatar? }`, `DELETE /users/:id` | edycja / usunięcie (zdejmuje z zadań) |

## Kalendarz, zaległe, bez terminu i archiwum

| Metoda i ścieżka | Opis |
|---|---|
| `GET /calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` | zadania z terminem w zakresie (włącznie, maks. 93 dni) jako `CalendarTask[]` (zadanie + `projectId/Name/Color`, `checklistName/Color`), sort: termin, projekt, lista, pozycja |
| `GET /calendar/sources` | projekty i listy mające zadania z terminem — opcje filtrów kalendarza: `projects` (aktywne) i `archivedProjects` (zarchiwizowane, osobna sekcja filtrów) |
| `GET /overdue?before=YYYY-MM-DD` | niewykonane zadania z terminem **wcześniejszym niż** `before` (klient podaje dzisiejszą datę) + `sources` (projekty/listy, w których coś jest zaległe), od najstarszych |
| `GET /undated` | niewykonane zadania **bez terminu** (`{ tasks, sources }`), w kolejności: „Inne” pierwsze, projekt, lista, pozycja |
| `GET /archive` | **wykonane** zadania **i wszystkie zadania zarchiwizowanych projektów** (`{ tasks, sources }`), od najnowszych wpisów (`coalesce(archived_at projektu, updated_at zadania)` malejąco); bez paginacji. `sources.projects` to projekty aktywne, a `sources.archivedProjects` zarchiwizowane (osobna sekcja filtrów) |

## Statystyki

| Metoda i ścieżka | Opis |
|---|---|
| `GET /stats/completions?from=…&to=…` | zadania wykonane w zakresie czasu `[from, to)` (ISO 8601 w UTC, np. `2026-10-08T00:00:00.000Z`; maks. 400 dni, `from < to`, inaczej 400): `{ tasks: { id, name, completedAt, projectColor }[] }` od najwcześniej wykonanego (nazwy służą kafelkom mapy aktywności). Dni i strefę czasową rozstrzyga klient (granice dni liczy przeglądarka), więc serwer niczego nie grupuje. Liczą się także zadania zarchiwizowanych projektów; usunięte zadania znikają |

## Zdrowie

`GET /health` → `{ status: "ok", db: "wal" }`.

## WebSocket `/ws`

Klient tylko **słucha** — wszystkie zmiany idą przez REST. Po każdej zmianie serwer wysyła do wszystkich klientów wiadomość JSON
typu `RealtimeEvent` (`shared/src/events.ts`) z polem `origin` = wartość nagłówka `X-Client-Id` żądania, które wywołało zmianę
(klient o tym id pomija zdarzenie). Typy: `project.created|updated|deleted|reordered`, `checklist.created|updated|deleted|reordered`,
`task.created|updated|completed|deleted|reordered`, `tag.updated|deleted`, `user.updated|deleted`. Zdarzenia zadań i list niosą `projectId`.
Serwer pinguje klientów co 30 s i zrywa nieodpowiadających.
