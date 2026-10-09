# Bezpieczeństwo

Wersja angielska (kanoniczna): [../SECURITY.md](../SECURITY.md).

## Model zagrożeń (stan obecny)

TodoFrenzy to aplikacja **zaufanej sieci lokalnej z logowaniem**: dostęp mają osoby, które znają login i hasło **jednego wspólnego konta**
(domyślnie `admin` / `admin` — **zmień je w `.env`**, patrz niżej). Zalogowany użytkownik widzi i edytuje wszystko; wielu użytkowników może być zalogowanych naraz
(każdy ma własną sesję). Nie ma osobnych kont, ról ani logu audytowego — nie wiadomo, kto co zmienił.

Link projektu (`/project/<16 znaków>`) jest tylko adresem; ochroną jest sesja. Aplikacja (pliki HTML/JS) jest publiczna — to ekran logowania, nie dane.
**Nie wystawiaj aplikacji do internetu** bez HTTPS i zmiany domyślnego hasła.

## Logowanie

- **Konto** z `.env`: `AUTH_USER` (domyślnie `admin`) oraz `AUTH_PASSWORD_HASH` (zalecane) albo `AUTH_PASSWORD`. Bez żadnego hasła obowiązuje `admin`/`admin`,
  a serwer przy starcie ostrzega w logu. Hash: `npm run auth:hash -- "noweHasło"` → wklej wypisaną linijkę do `.env` (scrypt N=16384, sól, porównanie w stałym czasie).
  Dlaczego `.env`, a nie baza: dane logowania są oddzielone od danych aplikacji (kopia/wyciek pliku bazy nie ujawnia hasła), nie trafiają do repozytorium (`.env` w `.gitignore`).
- **Sesja:** po poprawnym logowaniu serwer ustawia ciasteczko `todofrenzy_session` (`HttpOnly` — niedostępne dla JavaScriptu, więc XSS go nie wykradnie; `SameSite=Lax`; `Path=/`;
  `Secure` automatycznie po HTTPS/`X-Forwarded-Proto: https`). Token to 32 losowe bajty; **w bazie jest tylko jego skrót sha256** (tabela `sessions`) — wyciek bazy nie pozwala
  przejąć sesji. Sesja trwa **7 dni od ostatniej aktywności** (przedłużana w trakcie pracy), przeżywa restart serwera i jest czyszczona co godzinę.
- **Zmiana loginu/hasła w `.env` unieważnia wszystkie sesje** (po restarcie) — sesja jest związana z odciskiem poświadczeń.
- **Blokada zgadywania:** 5 błędnych prób z jednego adresu IP → 15 minut blokady (HTTP 429 + `Retry-After`; w tym czasie nawet poprawne hasło jest odrzucane), dodatkowo opóźnienie 0,4 s po
  każdej błędnej próbie. Udane logowanie zeruje licznik. Jeden komunikat dla złego loginu i hasła (nie podpowiadamy, które było błędne).
  Licznik jest w pamięci serwera (restart go zeruje). Za reverse proxy adres IP to adres proxy — przy wdrożeniu ustaw `trustProxy` w Fastify.
- **Co jest chronione:** całe `/api/*` oprócz `/api/health` (np. dla Dockera) i `/api/auth/login|logout` → bez sesji 401; **WebSocket `/ws`** też wymaga sesji (inaczej zamykany kodem 1008).
- Zmienne konfiguracyjne: `AUTH_USER`, `AUTH_PASSWORD_HASH`, `AUTH_PASSWORD`, `AUTH_SESSION_SECONDS`, `AUTH_MAX_ATTEMPTS`, `AUTH_LOCK_SECONDS` (patrz `.env.example`). Puste wartości = brak ustawienia.

## Zabezpieczenia wdrożone

| Obszar | Co zrobiono |
|---|---|
| Uwierzytelnianie | logowanie jednym kontem, sesje w SQLite (skrót tokenu), `HttpOnly` ciasteczko, wygasanie i przedłużanie, blokada po błędnych próbach — patrz wyżej |
| Walidacja wejścia | każde żądanie przechodzi przez schemat Zod z `shared` (długości, enumy, daty ISO, tablice id); błędy jako 400 bez szczegółów wewnętrznych |
| SQL injection | Drizzle ORM + parametryzowane fragmenty `sql\`…\`` (wartości zawsze jako parametry, nigdy sklejane w tekst) |
| XSS | React escapuje treść; w kodzie nie ma `dangerouslySetInnerHTML`/`innerHTML`/`eval`; awatary to SVG generowane z własnych danych; CSP |
| Nagłówki | `Content-Security-Policy` (`default-src 'self'`, skrypty tylko własne + skrót sha256 skryptu motywu z `index.html`, `frame-ancestors 'none'`, `object-src 'none'`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` (adres projektu nie wycieka w `Referer`) |
| WebSocket | wymaga sesji; sprawdzenie nagłówka `Origin` względem `Host` (a za reverse proxy `X-Forwarded-Host`) — obca strona otwarta w przeglądarce użytkownika nie podsłucha zdarzeń; heartbeat zrywa martwe połączenia; klienci tylko słuchają |
| CSRF | (1) `SameSite=Lax` ciasteczka sesji; (2) brak CORS — przeglądarka nie pozwoli obcej stronie czytać odpowiedzi; (3) **strażnik Origin** (`server/src/security.ts`): każde żądanie zmieniające dane (POST/PATCH/DELETE) z nagłówkiem `Origin` innym niż host aplikacji dostaje 403 — także POST-y bez ciała (archiwizacja, kopiowanie); (4) treść `text/plain` nie jest parsowana jako JSON. Klienty bez `Origin` (skrypty, curl) i żądania z tego samego źródła przechodzą |
| Błędy | błędy serwera zwracane jako ogólne „Błąd serwera”, szczegóły tylko w logu |
| Dane | baza poza repozytorium (`data/`), kopie zapasowe w `backups/` (też poza gitem), `.env` poza gitem; plik bazy nigdzie nie jest serwowany |
| Zależności | `npm audit`: naprawione luki w `@fastify/static`, `drizzle-orm`, `shell-quote` |
| Stały projekt | reguły „Inne” egzekwowane po stronie serwera (nie tylko w UI) |

## Reverse proxy i proxy deweloperskie

Strażnik Origin i sprawdzanie WebSocketu porównują `Origin` z `Host`. Dlatego proxy **musi zachować nagłówek `Host`** (albo ustawić `X-Forwarded-Host`):
Vite w trybie dev ma w `client/vite.config.ts` `changeOrigin: false` (domyślne skrócone `'/api': url` ustawiałoby `changeOrigin: true` i psuło wszystkie zapisy
z kodem 403), a nginx/Caddy/Traefik zwykle przekazują `Host` lub `X-Forwarded-Host` — przy wdrożeniu sprawdź to testem `security.mjs`. Ciasteczko dostaje `Secure`,
gdy proxy ustawi `X-Forwarded-Proto: https`.

## Testy zabezpieczeń

`npm run test:e2e` obejmuje:
- `e2e/tests/auth.mjs` — API i WebSocket bez sesji (401/1008), logowanie (złe dane, jednakowy komunikat, atrybuty ciasteczka, `Secure` za proxy HTTPS), skrót tokenu w bazie, wielu zalogowanych
  naraz, wylogowanie, blokada po 5 błędnych próbach i jej wygaśnięcie, wygasanie i przedłużanie sesji, przeżycie restartu, unieważnienie sesji po zmianie hasła, hasło jako hash (`auth:hash`),
  domyślne admin/admin, ekran logowania w przeglądarce (błąd w formularzu, ten sam adres po zalogowaniu, wygasła sesja w trakcie pracy, wylogowanie, telefon);
- `e2e/tests/security.mjs` — nagłówki i CSP, walidacja (długość, kolor, data, priorytet, zakres, bulk, zepsuty JSON), CSRF z obcego Origin (w tym POST bez ciała i DELETE), `text/plain`, brak CORS,
  limit ciała 1 MB, Origin w WebSocket, wstrzyknięcia SQL i XSS (tekst zamiast HTML).

Pozostałe testy logują się automatycznie (`e2e/lib.mjs`); harness uruchamia instancję z własnymi danymi (`e2e-admin`), więc `admin`/`admin` tam nie działa.

## Znane ograniczenia i ryzyka

1. **Jedno wspólne konto** — wszyscy zalogowani mają te same uprawnienia, a zmiany nie mają autora. Wyciek hasła = pełny dostęp, dlatego zmień domyślne `admin`/`admin` (łatwe do odgadnięcia,
   blokada tylko spowalnia zgadywanie). Osobne konta, role i log audytowy — patrz [ROADMAP.md](ROADMAP.md).
2. **Brak HTTPS** — w LAN hasło i sesja przechodzą jawnym tekstem. Dla użycia poza LAN konieczny reverse proxy z HTTPS (wtedy ciasteczko dostaje `Secure`).
   Brak bezpiecznego kontekstu przeglądarki to także powód własnego generatora `clientId` zamiast `crypto.randomUUID`.
3. **Ograniczanie prób logowania** jest w pamięci i po IP: restart serwera zeruje liczniki, a za proxy bez `trustProxy` wszyscy mają ten sam adres. Pozostałe trasy nie mają rate limitingu (bodyLimit 1 MB jest).
4. **Brak logu audytowego** logowań i zmian (są tylko logi serwera).
5. **Zależności deweloperskie:** `npm audit` zgłasza jeszcze 4 podatności „moderate” w `esbuild` w narzędziach buildu (`tsup`, `drizzle-kit`
   przez `@esbuild-kit`). Dotyczą wyłącznie serwera deweloperskiego esbuild (`esbuild --serve`), którego nie używamy; nie trafiają do wersji
   produkcyjnej. Znikną dopiero po kolejnych wydaniach `tsup`/`drizzle-kit` — sprawdzaj przy aktualizacjach.
6. **Dane w spoczynku nie są szyfrowane** — plik SQLite i kopie zapasowe są zwykłymi plikami; chroń je uprawnieniami systemu/szyfrowaniem dysku. W Dockerze uruchamiaj serwer jako nie-root.

## Co dodać przy otwarciu poza LAN (kolejność sugerowana)

1. **Zmiana hasła** na mocne i HTTPS (reverse proxy: Caddy/nginx/Traefik), `Strict-Transport-Security`, `trustProxy`.
2. Osobne konta w bazie (tabela użytkowników z hashami, zaproszenia), role, własność i uprawnienia do projektów, filtrowanie `GET /projects` do dostępnych projektów.
3. Rate limiting całego API (`@fastify/rate-limit`), trwały licznik prób logowania, ewentualnie 2FA.
4. Log audytowy zmian i logowań, monitoring, automatyczne kopie zapasowe poza maszyną.
