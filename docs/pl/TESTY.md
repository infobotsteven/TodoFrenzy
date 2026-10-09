# Testy

Wersja angielska (kanoniczna): [../TESTING.md](../TESTING.md).

Automatyczne testy to **testy przeglądarkowe E2E** (Playwright sterujący zainstalowaną przeglądarką) w katalogu `e2e/` — **24 pliki, ok. 585 sprawdzeń**.
Sprawdzają całe ścieżki: UI → REST → SQLite → WebSocket → UI. Statycznie uzupełniają je: `npm run typecheck`, `npm run lint` (ESLint) i `npm run lint:unused` (knip: martwy kod, pliki, zależności).

## Uruchamianie

```bash
npm run test:e2e                 # build + wszystkie testy na jednorazowej instancji
node e2e/run.mjs calendar users  # tylko testy, których nazwa zawiera podane fragmenty (wymaga wcześniejszego npm run build)
```

Harness (`e2e/run.mjs`):
1. uruchamia **zbudowany serwer** (`server/dist`) na wolnym porcie z **tymczasową bazą** w katalogu systemowym (kasowaną po testach),
2. wczytuje dane demonstracyjne (`e2e/seed-demo.mjs` z `e2e/fixtures/demo.json`: 5 projektów, 187 zadań, 6 użytkowników, tagi),
3. odpala kolejno `e2e/tests/*.mjs` (pliki z `_` na początku to moduły pomocnicze), przekazując adresy w `E2E_BASE` / `E2E_API`,
4. wypisuje podsumowanie i kończy z kodem ≠ 0, gdy cokolwiek nie przeszło.

Instancja testowa ma **własne dane logowania** (`e2e-admin`; `admin/admin` tam nie działa). Wspólny moduł `e2e/lib.mjs` loguje się raz i dokłada sesję do wszystkich
żądań `fetch` do API oraz do stron otwieranych przez `browser.newPage()`; do sprawdzania zachowania bez logowania służy `plainFetch` i jawnie tworzony `browser.newContext()`.
Przy uruchamianiu pojedynczego testu na serwerze dev używane jest `admin/admin` (albo `E2E_USER`/`E2E_PASSWORD`).

Dane deweloperskie (`data/todo.db`) **nie są dotykane**. Testy tworzą własne dane z prefiksem `ZZ-`/`zz-` i sprzątają po sobie.

Zmienne: `E2E_CHANNEL` (kanał przeglądarki Playwrighta: `msedge` domyślnie, np. `chrome`), `E2E_SHOTS` (katalog na zrzuty ekranu,
domyślnie `%TEMP%/todofrenzy-e2e-shots`). Playwright używa zainstalowanej przeglądarki systemowej — nie pobiera własnej.

Można też odpalić pojedynczy test na działających serwerach dev (domyślne adresy `:5173` i `:3000`):
`node e2e/tests/overdue.mjs`. **Uwaga:** takie testy działają na prawdziwej bazie dev — tworzą i usuwają własne rekordy `zz-`,
ale nie ruszają cudzych; bezpieczniej używać harnessu.

## Co pokrywają testy

| Plik | Zakres |
|---|---|
| `calendar.mjs` | tydzień, nawigacja, wybór tygodnia, filtry projektów/list, przeciąganie zadań na dni, zmiana terminu, realtime, telefon, ciemny motyw |
| `calendar-add-task.mjs` | dodawanie zadań z kalendarza: domyślnie do „Inne”, wybór projektu i listy, data, priorytet, osoby, projekt bez list, walidacja, telefon |
| `calendar-priority-filter.mjs` | filtr priorytetu w kalendarzu (wielokrotny, w połączeniu z użytkownikiem i projektem, czyszczenie) |
| `calendar-completion-jump.mjs` | regresja: zaznaczenie wykonania w kalendarzu nie zmienia kolejności zadań w dniu |
| `overdue.mjs` | zakładka „Zaległe”: licznik, siatka, treść karty, sortowanie, filtry (niezależne od kalendarza), zmiana terminu, szybkie „Dziś”, wykonanie, realtime, telefon |
| `undated.mjs` | zakładka „Bez terminu”: licznik, siatka, treść karty, sortowanie wg daty dodania, filtry (niezależne), ustawianie terminu (przejście do kalendarza), wykonanie, realtime, telefon |
| `pagination.mjs` | paginacja zakładek „Zaległe/Bez terminu/Archiwum”: rozmiar strony, zakres, nawigacja, reset przy zmianie filtra/sortowania, przycinanie strony przy kurczeniu listy (realtime), „Wszystkie”, zapamiętanie rozmiaru, telefon. Pozostałe testy siatek ustawiają `pageSize=0` (Wszystkie) przez `addInitScript` |
| `project-archive.mjs` | archiwizacja projektów: zakładka „Archiwum” projektów, zadania w archiwum zadań, brak w kalendarzu/zaległych/bez terminu, filtr „Projekty archiwalne”, przywracanie całego projektu (z karty zadania i projektu), „Inne” (403), realtime, telefon |
| `archive.mjs` | zakładka „Archiwum”: licznik, karty wykonanych, sortowanie wg wykonania, filtry, „Przywróć” i odznaczenie pola (powrót do Zaległych/Bez terminu), realtime, telefon |
| `inne-project.mjs` | stały projekt „Inne”: reguły API (403/400), kolejność, brak przycisków, wygląd, kalendarz |
| `users.mjs` | użytkownicy: tworzenie z awatarem, edycja, przypisywanie, filtry, kalendarz, realtime, usuwanie, telefon |
| `users-button.mjs` | przycisk „Użytkownicy” na stronie głównej (położenie i działanie) |
| `add-task-modal-overflow.mjs` | okno „Nowe zadanie” (kalendarz: „+ Zadanie” i „+” w dniu): bardzo długie nazwy projektu i listy (ze spacjami i bez) nie wychodzą poza okno ani nie dają poziomego przewijania — desktop i telefon (listy jedna pod drugą), dodanie zadania nadal działa |
| `project-colors.mjs` | kolor projektu na blokach projektów i zadaniach (kalendarz, Zaległe), w jasnym i ciemnym motywie: odcień tła i obwódki wg koloru (obliczone style), neutralność bez koloru, „Inne”, zaległe z kolorem projektu i czerwonawą obwódką, archiwalny ślad koloru |
| `filters-clear-button.mjs` | stały przycisk „Wyczyść filtry” w kalendarzu, Zaległych, Bez terminu i Archiwum: widoczny i nieaktywny od początku, aktywuje się po wybraniu filtra, czyści i nie znika, osobny stan zakładek, w kalendarzu obok „Ukryj ukończone” (które go nie aktywuje i nie jest czyszczone), EN, telefon |
| `calendar-hide-completed.mjs` | kalendarz: „Ukryj ukończone” (ukrywanie, licznik dnia, niezmienione podsumowanie, zapamiętanie, niezależność od „Wyczyść filtry”, komunikat „wszystkie ukryte”, wykonanie zadania przy włączonej opcji, EN, telefon) |
| `projects-pagination.mjs` | paginacja „Projektów” i „Archiwum”: strony (12 domyślnie), „Inne” na stronie 1, przeciąganie w obrębie strony, zmiana strony i przewijanie, przycinanie strony przy skracaniu listy (na żywo), wyszukiwanie, rozmiar strony (osobny `projectPageSize`, zapamiętany), reset strony przy zmianie zakładki, przywracanie, EN, telefon |
| `stats.mjs` | statystyki: `completed_at` (wykonanie/odznaczenie/powtórzenie/utworzenie jako wykonane, wklejanie, kopia), `/stats/completions` (zakres, walidacja, 401), zakładka (ukończone dziś, suma i jej zakresy, pudełko „Projekty” z odświeżaniem na żywo, wykres tygodnia z przesuwaniem, mapa miesiąca: nawigacja, zawartość i wypełnienie kafelków), realtime, EN, telefon |
| `i18n.mjs` | języki PL/EN: lista wyboru obok motywu, tłumaczenie tekstów, dat, liczby mnogiej i stałego projektu, komunikaty błędów serwera (X-Lang), zapamiętanie wyboru, ekran logowania, telefon |
| `confirm-dialogs.mjs` | okna potwierdzenia usuwania (zadanie, tag, lista, użytkownik, projekt): treść, Anuluj/Esc, potwierdzenie, fokus, telefon, brak natywnych okien |
| `auth.mjs` | logowanie: API i WebSocket bez sesji, logowanie i ciasteczko, wielu zalogowanych, wylogowanie, blokada po błędnych próbach, wygasanie/przedłużanie sesji, restart i zmiana hasła, hash hasła, ekran logowania w przeglądarce. Uruchamia **własne instancje serwera** (inne porty i bazy) |
| `core-features.mjs` | podstawowe funkcje: tworzenie/edycja/kolor/wyszukiwanie/kopiowanie projektu, lista z tagiem, szybkie dodawanie i wklejanie listy zadań, edycja zadania, wykonanie, usuwanie z „Cofnij”, filtry w projekcie, kopiowanie listy, układ list i motyw (zapamiętywanie), strony błędów |
| `security.mjs` | nagłówki i CSP, walidacja wejścia, CSRF (obcy Origin, `text/plain`), brak CORS, limit ciała, Origin w WebSocket, SQL i XSS |
| `drag-and-drop.mjs` (+ `_drag-and-drop-checks.mjs`) | przeciąganie zadań i list: miejsce upuszczenia = miejsce kursora, upuszczenie w pustym miejscu, slider |

## Pisanie nowych testów

- Plik `e2e/tests/<nazwa>.mjs`, `import { BASE, API, CHANNEL, SHOTS } from '../lib.mjs'`. Wzoruj się na `overdue.mjs`:
  dane testowe tworzysz przez API (prefiks `ZZ-`), w `finally` usuwasz **po id**, na końcu `process.exitCode = fails ? 1 : 0`.
- Zasady: nigdy nie usuwaj danych po nazwie ani wzorcu bez sprawdzenia id; nie zakładaj, że w bazie jest coś poza danymi demo
  (daty demo są względem dnia uruchomienia); preferuj `getByRole` i stabilne klasy (`.cal-task`, `.overdue-card`, `.chip`…).
- Animacje (FLIP, przeciąganie) sprawdzaj w trybie headless Playwrighta — panel przeglądarki w aplikacji potrafi wstrzymywać `requestAnimationFrame`.
- Sprawdzaj zawsze trzy rzeczy poza „happy path”: telefon (brak poziomego przewijania), błędy konsoli (`pageerror`), sprzątanie danych.

## Ograniczenia

Brak testów jednostkowych/API na poziomie samego serwera (logikę pokrywają testy przeglądarkowe) oraz brak CI — kandydaci na
następny krok (patrz [ROADMAP.md](ROADMAP.md)).
