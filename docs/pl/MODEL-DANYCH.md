# Model danych

Wersja angielska (kanoniczna): [../DATA-MODEL.md](../DATA-MODEL.md).

SQLite (plik `data/todo.db`, tryb WAL, `foreign_keys = ON`, `busy_timeout = 5000`). Schemat w `server/src/db/schema.ts`
(Drizzle), migracje w `server/drizzle/`. Typy zwracane przez API są w `shared/src/types.ts`.

```text
projects ──< checklists ──< tasks ──< task_users >── users
                 │
                 └──< checklist_tags >── tags
```

Usunięcie projektu kasuje jego listy i zadania, usunięcie listy — jej zadania, usunięcie użytkownika/tagu — tylko powiązania
(`ON DELETE CASCADE`).

## Tabele

### `projects`
| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | text PK | nanoid 16 znaków `[0-9a-z]` — jest też „sekretem” w linku |
| `name`, `description` | text | nazwa 1–200 znaków, opis do 5000 |
| `color` | text null | klucz z palety (`red`…`gray`) albo `brown` (zarezerwowany dla „Inne”) |
| `is_system` | integer(bool) | `true` tylko dla stałego projektu „Inne” (dokładnie jeden) |
| `archived_at` | integer (ms) null | moment zarchiwizowania; `NULL` = aktywny. Archiwizacja projektu = archiwizacja jego zadań (nic się nie kopiuje, zadania są wyprowadzane z `archived_at` projektu) |
| `sort_order` | integer | jawna kolejność |
| `created_at`, `updated_at` | integer (ms) | `updated_at` odświeżane także przy zmianach w listach/zadaniach (`touchProject`) |

### `checklists` (listy)
`id`, `project_id` → projects (cascade), `name`, `description`, `color` (null), `sort_order`, znaczniki czasu.
Indeks `(project_id, sort_order)`. Listy **nie mają dat** (kolumny `start_date`/`end_date` usunięto w migracji 0004).

### `tasks`
| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | text PK | |
| `checklist_id` | text → checklists (cascade) | |
| `name`, `description` | text | |
| `completed` | integer(bool) | |
| `completed_at` | integer (ms) null | moment oznaczenia jako wykonane (źródło **statystyk**); ustawiany raz (powtórne „wykonane” go nie przesuwa), czyszczony przy odznaczeniu; zadanie utworzone jako wykonane dostaje „teraz”. Kopie zadań są niewykonane |
| `priority` | text | `none` / `low` / `medium` / `high` (zwykły tekst — łatwo rozszerzyć bez migracji; zbiór w `shared`) |
| `due_date` | text null | `YYYY-MM-DD` (jedna data, bez godziny) |
| `sort_order` | integer | |
| `created_at`, `updated_at` | integer (ms) | |

Indeksy: `(checklist_id, sort_order)`, `(due_date)` (kalendarz i zaległe), `(completed_at)` (statystyki).

### `tags`
`id`, `name` (unikalne; porównywane też bez względu na wielkość liter w trasach). Tagi należą do **list** przez `checklist_tags`.

### `users`
`id`, `nick` (unikalny bez względu na wielkość liter — wymusza trasa), `avatar` (klucz z `AVATARS`), `created_at`.
Bez logowania — to tylko „etykiety” do przypisywania do zadań.

### `sessions`
Sesje logowania: `token_hash` (PK; **sha256 tokenu z ciasteczka**, sam token nie jest przechowywany), `created_at`, `last_seen_at`, `expires_at` (indeks), `credential_fingerprint`
(odcisk loginu i hasła z `.env`; sesje z innym odciskiem są nieważne i usuwane przy starcie — zmiana hasła wylogowuje wszystkich). Sprzątane przy starcie i co godzinę.
To jedyne dane o logowaniu w bazie — login i hasło konta są w `.env`, nie w bazie.

### `task_users` i `checklist_tags`
Tabele łączące (klucz złożony, indeks po drugiej kolumnie).

## Konwencje

- **Czas** w bazie to unix ms (`integer timestamp_ms`), w API ISO 8601. **Daty zadań** to tekst `YYYY-MM-DD` (nie ma stref czasowych).
- **Kolejność**: `sort_order` jawnie; nowy element = `max + 1`; zmiana kolejności „w slotach” (patrz ARCHITEKTURA). Pierwszy w liście
  projektów jest zawsze `is_system` (sortowanie `is_system desc, sort_order, created_at`).
- **Enumy** (`COLORS`, `PRIORITIES`, `AVATARS`) żyją w `shared/src/types.ts`; kolumny są zwykłym tekstem z typem `enum` po stronie Drizzle.
- **Walidacja** wejścia to schematy Zod w `shared/src/index.ts` (te same używa frontend w formularzach).

## Migracje

Generowane przez `npm run db:generate` po zmianie `schema.ts`; stosowane automatycznie przy starcie serwera (i ręcznie `npm run db:migrate`).
**Zasady bezpieczeństwa danych:** preferuj migracje addytywne; przed migracją zmieniającą/kasującą dane zrób
`npm run db:backup` i przetestuj ją na kopii pliku bazy (z innym `DATABASE_PATH`).

| # | Plik | Co robi |
|---|---|---|
| 0000 | `wooden_shiver_man` | schemat początkowy: projekty, listy (z datami), zadania, tagi zadań (`task_tags`) |
| 0001 | `lame_moonstone` | kolory projektów i list |
| 0002 | `mushy_star_brand` | tagi przeniesione na listy (`checklist_tags`), dane z `task_tags` scalone do list |
| 0003 | `pretty_masque` | usunięcie `task_tags` |
| 0004 | `youthful_hellcat` | `tasks.due_date`, usunięcie dat z list |
| 0005 | `lying_goliath` | użytkownicy (`users`, `task_users`) |
| 0006 | `cynical_hellion` | `projects.is_system` (stały projekt „Inne”; sam wiersz tworzy `ensureSystemProject` przy starcie) |
| 0007 | `fast_lethal_legion` | indeks `tasks(due_date)` |
| 0008 | `fresh_charles_xavier` | `projects.archived_at` (archiwizacja projektów) |
| 0009 | `foamy_karen_page` | tabela `sessions` (logowanie) |
| 0010 | `nasty_the_hunter` | `tasks.completed_at` + indeks; istniejące wykonane zadania dostały `completed_at = updated_at` (najlepsze dostępne przybliżenie) |

## Kopie zapasowe

`npm run db:backup` używa API `backup` SQLite (spójna kopia także przy działającym serwerze w trybie WAL) i zapisuje
`backups/todo-RRRRMMDD-GGMMSS.db` (zostaje `BACKUP_KEEP`, domyślnie 14). Przywrócenie: zatrzymaj serwer i podmień plik
`data/todo.db` (usuń też `todo.db-wal` i `todo.db-shm`).
