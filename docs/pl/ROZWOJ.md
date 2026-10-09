# Praca nad kodem

Wersja angielska (kanoniczna): [../DEVELOPMENT.md](../DEVELOPMENT.md). Gałęzie: `develop` (praca na co dzień) i `main` (wydania, tagi `vX.Y.Z`).
Dokumentacja jest dwujęzyczna: angielska w `docs/` jest kanoniczna, polska w `docs/pl/` — przy zmianie zachowania aktualizuj obie.

## Środowisko

- Node.js ≥ 22, npm (workspaces). Windows 11 jest głównym środowiskiem autora; wszystko działa też na Linuksie/Dockerze
  (końce linii LF wymuszone przez `.gitattributes`).
- `npm install` w katalogu głównym instaluje wszystkie paczki. `npm run dev` startuje serwer (`tsx watch`) i Vite.
- Zmienne środowiskowe (`.env`, wzór w `.env.example`): `HOST`, `PORT`, `DATABASE_PATH`, `BACKUP_DIR`, `BACKUP_KEEP`.
  Ścieżki względne liczą się od katalogu głównego repozytorium.

## Zasady pracy

1. **TypeScript ścisły** w całym repo; kontrakt API żyje w `shared/` — zmieniasz schemat Zod, kompilator pokaże wszystkie
   miejsca do poprawy w serwerze i kliencie.
2. Przed zakończeniem zmiany: `npm run typecheck`, `npm run lint`, `npm run lint:unused` (knip: martwe eksporty, pliki, zależności), a przy zmianach
   zachowania `npm run test:e2e`. Po większych refaktorach porównaj zrzuty ekranu przed/po (jasny i ciemny motyw), jak w audytach.
3. **Komentarze po polsku**, krótkie, o *dlaczego* (nie o tym, co widać w kodzie). Teksty interfejsu po polsku.
4. **Dane nie giną:** przed migracją zmieniającą dane zrób `npm run db:backup`; testuj migracje na kopii pliku bazy.
   Testy E2E mają własną, tymczasową bazę — nigdy nie piszą po `data/todo.db`.
5. **Style:** nowe wymiary w `rem`, rozmiary tekstu i kolory wyłącznie z tokenów (`--fs-*`, `--c-*`, `--surface`, …);
   nowe reguły dopisuj do właściwego pliku w `client/src/styles/` (kolejność importów w `index.css` to kolejność kaskady).
   Kolor akcentu interfejsu to **`--brand`** (z napisem `--on-brand`; tekst w kolorze marki: `--brand-text`) — nie wpisuj zieleni ani białego tekstu na przyciskach głównych.
   Język wyglądu: kolor projektu/listy to **kropka** (nie pasek), karty mają `--shadow-card`, archiwum = kreskowanie `--archive-hatch` + przerywana obwódka + pusta kropka + `.archive-icon`.
6. Zmiany w interfejsie sprawdzaj w trzech szerokościach (telefon 390, ~1440, ~1900) i w obu motywach.

## Przepisy

**Nowe pole zadania (np. „szacowany czas”)**
1. `server/src/db/schema.ts` (kolumna) → `npm run db:generate` → przejrzyj `server/drizzle/XXXX_*.sql` (addytywne!).
2. `shared/src/types.ts` (typ `Task`) i schematy w `shared/src/index.ts` (`taskFields`).
3. Serwer: `toTask` w `db/queries.ts` zwykle nic nie wymaga; dopisz pole w kopiowaniu (`db/duplicate.ts`) i ewentualnie w trasach.
4. Klient: `TaskForm` w `components/forms.tsx`, wyświetlanie w `ChecklistCard`, ewentualnie karty kalendarza/zaległych.
5. Test E2E + wpis w `docs/FEATURES.md` i `docs/pl/FUNKCJE.md`.

**Nowy endpoint** — trasa w `server/src/routes/*.ts` (parse Zod → reguły → zapis → `touchProject` → `emit`), typ zdarzenia w
`shared/src/events.ts` jeśli dotyczy realtime, hook w `client/src/queries/*`, invalidacja w `useInvalidate`/`realtime.ts`, opis w `docs/API.md`.

**Nowy tekst interfejsu** — klucz w `client/src/i18n/messages/<obszar>.ts` (PL i EN w jednym wywołaniu `defineMessages`; nowy obszar dopisz też do `messages/index.ts`), użycie `t('obszar.klucz', { param })`;
liczba mnoga: wartość `{ one, few, many, other }` i parametr `n`. Komunikat błędu API: po polsku w trasie + wpis w mapie `EN` w `server/src/i18n.ts`.

**Nowy kolor/priorytet/awatar** — stała w `shared/src/types.ts` (+ token CSS `--c-*` i `[data-color]`; awatar: sprite w `components/avatars.ts`
i etykieta). Kolor zarezerwowany dla stałego projektu (`SYSTEM_COLOR`) nie wchodzi do `COLORS`.

**Nowy widok na stronie głównej** — wzoruj się na `calendar/TaskGridSection.tsx` (wspólny dla „Zaległych”, „Bez terminu” i „Archiwum”; nowy wariant = nowy wpis w `TEXTS`, hook w `queries/calendar.ts`, endpoint w `routes/calendar.ts`) + zakładka w `PlannerSection`,
filtry przez `CalendarFilters` z nowym `FilterScope` w `store.ts`, dane przez hook w `queries/` (pamiętaj o invalidacji w `useInvalidate` i `realtime.ts`).

## Pułapki (wiedza zdobyta w praniu)

- **Vite i „stary” cache modułów:** po przeniesieniu/podzieleniu plików albo zmianie importów dev-serwer bywa głuchy na zmianę
  (pusta strona, „missing export”, nowy komponent nie reaguje). Pomaga `touch` na zmienionych plikach albo restart `npm run dev`.
- **Windows PowerShell 5.1:** brak `&&`; rury i tablice z `Invoke-RestMethod` bywają „rozpakowywane”; polskie znaki w konsoli wymagają
  `[Console]::OutputEncoding = UTF8`. Skrypty testowe pisz w Node, nie w PowerShellu.
- **Logowanie w dev:** po `npm run dev` aplikacja pokazuje ekran logowania — `admin`/`admin` (bez ustawień w `.env`). Skrypty wywołujące API (np. `seed:demo`, własne) muszą się
  zalogować (`POST /api/auth/login`, ciasteczko `todofrenzy_session`); testy robi to `e2e/lib.mjs`. Skrypt w PowerShellu/curl: `-c`/`-b` albo ręczny nagłówek `Cookie`.
- **Stan sesji w TanStack Query:** nie używaj `queryClient.clear()` przy zmianie logowania — odłącza aktywne zapytanie o sesję i ekran się nie przełącza; użyj `setSession(qc, me)` (`queries/auth.ts`).
- **Puste zmienne w `.env`** (`AUTH_PASSWORD=`) traktujemy jak brak wartości — uważaj na `??` zamiast `||` przy czytaniu konfiguracji (błąd znaleziony przez `auth.mjs`).
- **Proxy a CSRF:** serwer odrzuca (403) zapisy, których `Origin` nie zgadza się z `Host`. Proxy Vite musi mieć `changeOrigin: false` (domyślne skrócone `'/api': url`
  podmienia `Host` i psuje wszystkie zapisy w dev); reverse proxy na produkcji musi przekazywać `Host` albo `X-Forwarded-Host`.
- **`crypto.randomUUID`** nie działa po HTTP (LAN) — używamy własnego `clientId`.
- **Zapytania TanStack i drag & drop:** nie zmieniaj synchronicznego schedulera w `main.tsx` ani synchronicznej aktualizacji cache w
  `useOptimisticReorder` — to one eliminują „przeskakiwanie” po upuszczeniu.
- **Playwright:** pole wyboru, którego karta znika po kliknięciu (zaległe), obsługuj `click()` zamiast `check()`; selektory po tekście są
  niewrażliwe na wielkość liter i szukają podciągów (używaj `exact: true` lub konkretnych klas).
- **Długie opcje w listach wyboru (`<select>`) w formularzach:** element flexa ma domyślnie `min-width: auto`, więc `.field` rozpychało okno do szerokości najdłuższej opcji (okno „Nowe zadanie” z długą nazwą listy).
  `.field` ma `min-width: 0`, a `select`/`input`/`textarea` w polu `width: 100%` + wielokropek; nowe pola formularza używaj w `.field`, a nie jako luźnych flex-itemów. Test: `add-task-modal-overflow.mjs`.
- **`overflow-wrap: anywhere`** w kartach powoduje łamanie słów w wąskich kolumnach — dlatego kalendarz ma minimalną szerokość kolumny.
- **Wymiary list w JS** (`LIST_WIDTH`, `LIST_GAP`) są podawane przy skali 100%; `useColumnCount` przelicza je na bieżącą skalę roota.

## Struktura testów i narzędzi

Testy E2E: [TESTY.md](TESTY.md). Audyt zależności: `npm audit`. Kopie zapasowe: `npm run db:backup`.
