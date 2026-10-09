# TodoFrenzy

[English](README.md) · **Polski**

Współdzielona, samodzielnie hostowana aplikacja webowa do prowadzenia **projektów, list i zadań** z kalendarzem, widokiem zaległych i statystykami.
Działa w sieci lokalnej (komputer + telefony), **po zalogowaniu** jednym wspólnym kontem. Zmiany widać u wszystkich na żywo (WebSocket).
Dane trzyma SQLite — jeden plik, żadnego zewnętrznego serwera bazy. Interfejs jest dwujęzyczny: **polski i angielski**.

![Strona główna](docs/images/overview-light.png)

<p>
  <img src="docs/images/calendar-dark.png" alt="Kalendarz, ciemny motyw" width="49%">
  <img src="docs/images/statistics-light.png" alt="Statystyki" width="49%">
</p>

## Najważniejsze funkcje

- **Projekty → listy → zadania**, wszystko przestawiane przeciąganiem (drag & drop), z kolorami, kopiowaniem i licznikami.
- **Stały projekt „Inne”** z jedną listą „Zadania” — na zadania luzem; nie da się go usunąć.
- **Kalendarz tygodniowy**: zadania z terminem, filtry, ukrywanie ukończonych, zmiana terminu przeciągnięciem, dodawanie zadań na dany dzień.
- **Zaległe**, **Bez terminu** i **Archiwum** — siatki kart z filtrami, sortowaniem, szybką zmianą terminu, przywracaniem i paginacją.
- **Archiwum projektów** — zarchiwizowany projekt znika z listy, a jego zadania z kalendarza; przywrócenie zadania przywraca cały projekt.
- **Statystyki** — ukończone dziś i w ostatnich dniach, wykres tygodnia, mapa aktywności w stylu GitHuba, podsumowanie projektów.
- **Użytkownicy z pikselowymi awatarami** przypisywani do zadań, **tagi** na listach, **priorytety**, **jasny i ciemny motyw**.
- **Realtime**, układ mobile-first, dwa widoki list (siatka / slider), interfejs **PL / EN**.

Pełny opis: [docs/pl/FUNKCJE.md](docs/pl/FUNKCJE.md) (po angielsku: [docs/FEATURES.md](docs/FEATURES.md)).

## Wymagania

- **Node.js ≥ 22** (z npm). Nic więcej — SQLite jest wbudowane w aplikację (moduł natywny `better-sqlite3` pobiera gotowe pliki binarne lub kompiluje się przy `npm install`).

## Szybki start

```bash
git clone https://github.com/infobotsteven/TodoFrenzy.git
cd TodoFrenzy
npm install
npm run dev              # backend :3000 + frontend :5173 (z przeładowaniem)
```

Otwórz http://localhost:5173 i zaloguj się: **`admin` / `admin`** (domyślne dane — **zmień je**, patrz niżej).
Migracje bazy stosują się same przy starcie serwera, a plik bazy powstaje w `data/todo.db`. Konfigurację zmienia się w pliku `.env`
(skopiuj wzór: `cp .env.example .env`, w PowerShellu `Copy-Item .env.example .env`) — bez niego działają sensowne wartości domyślne.

Dane demonstracyjne (po polsku): `npm run seed:demo` (na uruchomionym serwerze dev).

### Logowanie i zmiana hasła

Aplikacja wymaga logowania (jedno wspólne konto; kilka osób może być zalogowanych naraz, sesja trwa 7 dni od ostatniej aktywności). Dane konta są w `.env`, nie w bazie:

```bash
npm run auth:hash -- "twojeNoweHaslo"      # wypisuje linijkę AUTH_PASSWORD_HASH='...'
```

Wklej ją do `.env` (opcjonalnie też `AUTH_USER=...`) i zrestartuj serwer — zmiana **wylogowuje wszystkich**. Bez ustawień obowiązuje `admin`/`admin` (serwer ostrzega w logu).
Po 5 błędnych próbach z jednego adresu logowanie jest blokowane na 15 minut. Szczegóły: [docs/pl/BEZPIECZENSTWO.md](docs/pl/BEZPIECZENSTWO.md).

### Wersja produkcyjna (jeden proces, jeden port)

```bash
npm run build
npm start                # Fastify serwuje API i zbudowany frontend na :3000
```

Otwórz http://localhost:3000.

### Docker (serwer domowy)

Najprostszy sposób, żeby TodoFrenzy działał na stałe na domowym serwerze (Windows z Docker Desktop, Linux lub NAS). Wymaga Dockera z Compose v2.24 lub nowszym (aktualny Docker Desktop wystarcza).

```bash
git clone https://github.com/infobotsteven/TodoFrenzy.git
cd TodoFrenzy
cp .env.example .env     # PowerShell: Copy-Item .env.example .env
```

1. **Zedytuj `.env`:**
   - ustaw port na serwerze: `TODOFRENZY_PORT=3100` (odkomentuj linię; domyślnie **3100**, żeby nie kolidować z czymś, co już używa portu 3000),
   - ustaw własne hasło zamiast `admin`/`admin`: wygeneruj hash poleceniem
     `docker compose run --rm app node server/dist/auth-hash-cli.js "twojeHaslo"`
     i wklej wypisaną linijkę `AUTH_PASSWORD_HASH='...'` do `.env` (zostaw apostrofy).
2. **Uruchom:**
   ```bash
   docker compose up -d --build
   ```
   Pierwsze budowanie trwa kilka minut. Sprawdź `docker compose ps` (stan powinien zmienić się na `healthy`) oraz `docker compose logs`.
3. **Otwórz:** `http://<IP-serwera>:3100` z dowolnego urządzenia w sieci i zaloguj się.
4. **Tylko Windows:** jednorazowo zezwól na port w zaporze (PowerShell jako administrator):
   ```powershell
   New-NetFirewallRule -DisplayName "TodoFrenzy" -Direction Inbound -Protocol TCP -LocalPort 3100 -Profile Private -Action Allow
   ```
   Zarezerwuj też stały adres IP serwera w routerze i włącz *Start Docker Desktop when you sign in*, żeby kontener wracał po restarcie (resztę załatwia `restart: unless-stopped`).

Jak przechowywane są dane:
- Baza leży w wolumenie Dockera `todofrenzy_data` i przetrwa przebudowy oraz aktualizacje. (Wolumen zarządzany przez Dockera jest celowy: SQLite w trybie WAL bywa zawodny na katalogach z dysku Windows.)
- Kopie zapasowe trafiają do katalogu `backups/` obok `docker-compose.yml`:
  ```bash
  docker compose exec app node server/dist/backup-cli.js
  ```
  Od czasu do czasu skopiuj ten katalog poza serwer (albo zaplanuj polecenie w Harmonogramie zadań / cron). Przywracanie kopii:
  ```bash
  docker compose stop app
  docker compose run --rm --no-deps app sh -c "rm -f /app/data/todo.db-wal /app/data/todo.db-shm && cp /app/backups/todo-RRRRMMDD-GGMMSS.db /app/data/todo.db"
  docker compose start app
  ```
  Na Linuksie katalog `backups/` musi być zapisywalny dla uid 1000 (`mkdir backups && chown 1000:1000 backups`).

Polecenia na co dzień:

| Polecenie | Co robi |
|---|---|
| `docker compose up -d --build` | uruchomienie albo aktualizacja po `git pull` (dane zostają) |
| `docker compose logs -f` | podgląd logu na żywo |
| `docker compose restart app` | restart |
| `docker compose down` | zatrzymanie i usunięcie kontenera (dane zostają; **nie** dodawaj `-v`, bo to kasuje wolumen) |

Obowiązuje to samo ostrzeżenie co wyżej (zwykłe HTTP): używaj w sieci domowej, a przed wystawieniem na zewnątrz postaw reverse proxy z HTTPS (albo VPN).

### Konfiguracja (`.env`)

| Zmienna | Domyślnie | Znaczenie |
|---|---|---|
| `HOST` | `0.0.0.0` | adres nasłuchiwania (`0.0.0.0` = cała sieć lokalna) |
| `PORT` | `3000` | port serwera |
| `DATABASE_PATH` | `./data/todo.db` | plik SQLite |
| `BACKUP_DIR`, `BACKUP_KEEP` | `./backups`, `14` | katalog i liczba kopii zapasowych |
| `AUTH_USER`, `AUTH_PASSWORD_HASH` / `AUTH_PASSWORD` | `admin` / `admin` | konto logowania (zalecany hash) |
| `AUTH_SESSION_SECONDS`, `AUTH_MAX_ATTEMPTS`, `AUTH_LOCK_SECONDS` | `604800`, `5`, `900` | czas sesji i blokada po błędnych próbach |
| `TODOFRENZY_PORT` | `3100` | tylko Docker: port wystawiony na serwerze |

### Dostęp z telefonu (sieć lokalna)

Serwer nasłuchuje na `0.0.0.0` i przy starcie wypisuje adresy w sieci (np. `http://192.168.x.x:3000`; w trybie dev frontend jest pod portem `5173`).
Windows blokuje połączenia przychodzące — jednorazowo, w PowerShellu jako administrator:

```powershell
New-NetFirewallRule -DisplayName "TodoFrenzy" -Direction Inbound -Protocol TCP -LocalPort 3000,5173 -Profile Private -Action Allow
```

Dobrze jest zarezerwować komputerowi stały adres IP w routerze, żeby zapisane linki nie przestały działać.
W sieci lokalnej hasło i sesja przechodzą po zwykłym HTTP — **nie wystawiaj aplikacji do internetu** bez HTTPS (reverse proxy) i zmiany domyślnego hasła
(patrz [docs/pl/BEZPIECZENSTWO.md](docs/pl/BEZPIECZENSTWO.md)).

### Kopie zapasowe

```bash
npm run db:backup        # spójna kopia bazy do backups/ (zostaje 14 najnowszych)
```

## Polecenia

| Polecenie | Co robi |
|---|---|
| `npm run dev` | serwer (tsx watch) + Vite jednocześnie |
| `npm run build` / `npm start` | build frontendu i serwera / uruchomienie wersji produkcyjnej |
| `npm run typecheck` | TypeScript we wszystkich paczkach |
| `npm run lint` | ESLint (TypeScript + reguły hooków Reacta) |
| `npm run lint:unused` | knip: martwe eksporty, nieużywane pliki i zależności |
| `npm run test:e2e` | build + testy przeglądarkowe na jednorazowej instancji z tymczasową bazą (potrzebna przeglądarka Edge lub Chrome, patrz [docs/pl/TESTY.md](docs/pl/TESTY.md)) |
| `npm run auth:hash -- "hasło"` | hash hasła do `.env` (`AUTH_PASSWORD_HASH`) |
| `npm run seed:demo` | wczytuje dane demonstracyjne do działającego serwera |
| `npm run db:generate` | generuje migrację po zmianie `server/src/db/schema.ts` |
| `npm run db:migrate` | ręcznie stosuje migracje (serwer robi to sam przy starcie) |
| `npm run db:backup` | spójna kopia bazy do `backups/` |

## Struktura repozytorium

```text
shared/   schematy Zod, typy i stałe współdzielone przez frontend i backend (źródło prawdy dla API)
server/   Fastify + SQLite (better-sqlite3) + Drizzle; migracje w server/drizzle
client/   React 19 + Vite + TypeScript (TanStack Query, Zustand, dnd-kit, react-router)
e2e/      testy przeglądarkowe (Playwright) + dane demonstracyjne
docs/     dokumentacja (angielska w docs/, polska w docs/pl/)
logo/     logo „Odhacz” (SVG/PNG)
data/     plik SQLite (tworzony przy pierwszym uruchomieniu, poza gitem)
Dockerfile, docker-compose.yml   obraz kontenera i jego konfiguracja uruchomieniowa (patrz „Docker”)
```

## Dokumentacja

Dokumentacja angielska (kanoniczna) jest w `docs/`, polska w `docs/pl/`.

| Dokument | Zawartość |
|---|---|
| [FUNKCJE.md](docs/pl/FUNKCJE.md) | co aplikacja robi, reguły zachowania, widoki |
| [ARCHITEKTURA.md](docs/pl/ARCHITEKTURA.md) | warstwy, przepływ danych, realtime, stan, drag & drop, CSS |
| [MODEL-DANYCH.md](docs/pl/MODEL-DANYCH.md) | tabele, relacje, migracje, konwencje |
| [API.md](docs/pl/API.md) | endpointy REST, błędy, zdarzenia WebSocket |
| [ROZWOJ.md](docs/pl/ROZWOJ.md) | jak pracować nad kodem, przepisy na typowe zmiany, pułapki |
| [TESTY.md](docs/pl/TESTY.md) | testy E2E: uruchamianie, dane, pisanie nowych |
| [BEZPIECZENSTWO.md](docs/pl/BEZPIECZENSTWO.md) | model zagrożeń, zabezpieczenia, ograniczenia |
| [ROADMAP.md](docs/pl/ROADMAP.md) | otwarte tematy i pomysły (Docker, uwierzytelnianie…) |

## Uwagi

- Komentarze w kodzie i dane demonstracyjne są po polsku (język, w którym projekt powstał); teksty interfejsu mają pełne wersje PL i EN.
- Projekt rozwija się na gałęzi `develop`; gałąź `main` zawiera wydania (tagi `vX.Y.Z`).

## Licencja

[MIT](LICENSE) © 2026 infobotsteven
