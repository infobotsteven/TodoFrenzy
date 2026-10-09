# Plan i otwarte tematy

Wersja angielska (kanoniczna): [../ROADMAP.md](../ROADMAP.md). Nic tu nie jest obietnicą — to lista pomysłów i znanych braków.

## Wdrożenie

- **Docker:** obraz wielostopniowy (build frontendu i serwera → obraz uruchomieniowy `node:22-slim`/alpine z `better-sqlite3`),
  użytkownik nie-root, wolumen na `DATABASE_PATH` (np. `/data/todo.db`), `HEALTHCHECK` na `/api/health`, `docker-compose.yml`.
  Uwaga: `better-sqlite3` to moduł natywny — build w obrazie docelowej architektury.
- **Kopie zapasowe automatyczne:** harmonogram dla `npm run db:backup` (cron/zadanie systemowe/sidecar), kopia poza maszyną,
  opis odtwarzania (jest w [MODEL-DANYCH.md](MODEL-DANYCH.md)).

## Uwierzytelnianie i udostępnienie poza LAN

Jest **jedno wspólne konto** (z `.env`). Następne kroki (patrz [BEZPIECZENSTWO.md](BEZPIECZENSTWO.md)): osobne konta w bazie (hash + sól, ewentualnie powiązanie z „użytkownikami z awatarami”),
role i uprawnienia per projekt, zaproszenia, zmiana hasła z poziomu aplikacji, HTTPS za reverse proxy (+ `trustProxy`), trwałe/ogólne ograniczanie żądań, 2FA, log audytowy logowań i zmian.

## Pomysły funkcjonalne (nie obiecane)

- Kolejne języki: wystarczy dopisać wartość w `LANGS` (`i18n/define.ts`) i kolumnę w każdym `defineMessages`; do przemyślenia: wykrywanie języka przeglądarki jako domyślnego (dziś zawsze polski),
  tłumaczenie komunikatów walidacji Zod, tłumaczenie logów serwera i komunikatów CLI (zostają po polsku).
- Powtarzalne zadania i przypomnienia, godziny w terminach, widok miesiąca w kalendarzu.
- Komentarze do zadań, historia zmian, powiadomienia.
- Załączniki; eksport/import (CSV/JSON); szablony projektów i list.
- Przenoszenie zadań między listami i projektami przeciąganiem (dziś tylko kopiowanie list/projektów).
- Wyszukiwanie zadań globalnie; paginacja **serwerowa** (zakładki „Zaległe/Bez terminu/Archiwum” mają już paginację po stronie klienta, ale endpointy `/overdue`, `/undated`, `/archive`
  zwracają wszystkie zadania — przy tysiącach rekordów trzeba przenieść filtry, sortowanie i limity na serwer).
- Tryb offline / PWA (świadomie odrzucony na początku).

## Techniczne usprawnienia

- CI (GitHub Actions): `typecheck`, `lint`, `build`, `test:e2e`; testy jednostkowe `shared` i logiki `db/reorder`/`duplicate`.
- Leniwe ładowanie tras (code-splitting); zmiana nazwy `server/src/routes/calendar.ts` na `views.ts` (zawiera już zaległe, bez terminu i archiwum);
  testy jednostkowe logiki serwera (`reorder`, `duplicate`, `loadTaskList`).
- Audyt dostępności (czytnik ekranu, kontrast, nawigacja klawiaturą w kalendarzu).
- Aktualizacje zależności: śledzić `tsup`/`drizzle-kit` (esbuild) i `drizzle-orm`; regularnie `npm audit`.
- Tłumaczenie komentarzy w kodzie (dziś są po polsku).
