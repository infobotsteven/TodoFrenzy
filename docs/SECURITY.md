# Security

Polish version: [pl/BEZPIECZENSTWO.md](pl/BEZPIECZENSTWO.md).

## Threat model (current state)

TodoFrenzy is an application for a **trusted local network with a login**: access is open to people who know the login and password of **one shared account**
(by default `admin` / `admin` — **change it in `.env`**, see below). A logged-in user sees and edits everything; many users can be logged in at once
(each has their own session). There are no separate accounts, roles or audit log — it is not known who changed what.

A project link (`/project/<16 characters>`) is only an address; the session is the protection. The application itself (HTML/JS files) is public — it is the login screen, not data.
**Do not expose the application to the internet** without HTTPS and without changing the default password.

## Login

- **Account** from `.env`: `AUTH_USER` (default `admin`) and `AUTH_PASSWORD_HASH` (recommended) or `AUTH_PASSWORD`. With no password at all `admin`/`admin` applies,
  and the server warns about it in the log at startup. Hash: `npm run auth:hash -- "newPassword"` → paste the printed line into `.env` (scrypt N=16384, salt, constant-time comparison).
  Why `.env` and not the database: the credentials are separate from application data (a copy/leak of the database file does not reveal the password) and never reach the repository (`.env` is in `.gitignore`).
- **Session:** after a successful login the server sets the `todofrenzy_session` cookie (`HttpOnly` — unavailable to JavaScript, so XSS cannot steal it; `SameSite=Lax`; `Path=/`;
  `Secure` automatically over HTTPS/`X-Forwarded-Proto: https`). The token is 32 random bytes; **only its sha256 hash is stored in the database** (table `sessions`) — a database leak does not allow
  taking over a session. A session lasts **7 days from the last activity** (extended while working), survives a server restart and is cleaned up every hour.
- **Changing the login/password in `.env` invalidates all sessions** (after a restart) — a session is bound to a fingerprint of the credentials.
- **Guessing lockout:** 5 failed attempts from one IP address → a 15-minute lockout (HTTP 429 + `Retry-After`; during that time even the correct password is rejected), plus a 0.4 s delay after
  every failed attempt. A successful login resets the counter. One message for a wrong login and a wrong password (we do not hint which was wrong).
  The counter lives in server memory (a restart resets it). Behind a reverse proxy the IP address is the proxy's — set `trustProxy` in Fastify when deploying.
- **What is protected:** all of `/api/*` except `/api/health` (e.g. for Docker) and `/api/auth/login|logout` → 401 without a session; the **`/ws` WebSocket** also requires a session (otherwise closed with code 1008).
- Configuration variables: `AUTH_USER`, `AUTH_PASSWORD_HASH`, `AUTH_PASSWORD`, `AUTH_SESSION_SECONDS`, `AUTH_MAX_ATTEMPTS`, `AUTH_LOCK_SECONDS` (see `.env.example`). Empty values = not set.

## Safeguards in place

| Area | What was done |
|---|---|
| Authentication | login with one account, sessions in SQLite (token hash), `HttpOnly` cookie, expiry and extension, lockout after failed attempts — see above |
| Input validation | every request goes through a Zod schema from `shared` (lengths, enums, ISO dates, id arrays); errors as 400 without internal details |
| SQL injection | Drizzle ORM + parameterized `sql\`…\`` fragments (values are always parameters, never concatenated into text) |
| XSS | React escapes content; the code has no `dangerouslySetInnerHTML`/`innerHTML`/`eval`; avatars are SVGs generated from our own data; CSP |
| Headers | `Content-Security-Policy` (`default-src 'self'`, scripts only our own + the sha256 hash of the theme script from `index.html`, `frame-ancestors 'none'`, `object-src 'none'`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` (the project address does not leak in `Referer`) |
| WebSocket | requires a session; the `Origin` header is checked against `Host` (behind a reverse proxy `X-Forwarded-Host`) — a foreign page open in the user's browser cannot eavesdrop on events; a heartbeat drops dead connections; clients only listen |
| CSRF | (1) `SameSite=Lax` on the session cookie; (2) no CORS — the browser will not let a foreign page read responses; (3) the **Origin guard** (`server/src/security.ts`): every data-changing request (POST/PATCH/DELETE) with an `Origin` different from the application host gets 403 — also body-less POSTs (archive, copy); (4) `text/plain` content is not parsed as JSON. Clients without `Origin` (scripts, curl) and same-origin requests pass |
| Errors | server errors are returned as a generic "Server error", details only in the log |
| Data | the database lives outside the repository (`data/`), backups in `backups/` (also outside git), `.env` outside git; the database file is never served |
| Dependencies | `npm audit`: vulnerabilities in `@fastify/static`, `drizzle-orm`, `shell-quote` fixed |
| Permanent project | the "Other" rules are enforced on the server (not only in the UI) |

## Reverse proxy and the development proxy

The Origin guard and the WebSocket check compare `Origin` with `Host`. Therefore a proxy **must preserve the `Host` header** (or set `X-Forwarded-Host`):
in development Vite has `changeOrigin: false` in `client/vite.config.ts` (the default shorthand `'/api': url` would set `changeOrigin: true` and break all writes
with a 403), while nginx/Caddy/Traefik usually pass `Host` or `X-Forwarded-Host` — when deploying, verify it with the `security.mjs` test. The cookie gets `Secure`
when the proxy sets `X-Forwarded-Proto: https`.

## Security tests

`npm run test:e2e` covers:
- `e2e/tests/auth.mjs` — API and WebSocket without a session (401/1008), login (wrong data, identical message, cookie attributes, `Secure` behind an HTTPS proxy), token hash in the database, several users logged in
  at once, logout, lockout after 5 failed attempts and its expiry, session expiry and extension, surviving a restart, session invalidation after a password change, password as a hash (`auth:hash`),
  default admin/admin, the login screen in a browser (form error, the same address after login, an expired session during work, logout, phone);
- `e2e/tests/security.mjs` — headers and CSP, validation (length, color, date, priority, range, bulk, broken JSON), CSRF from a foreign Origin (including a body-less POST and DELETE), `text/plain`, no CORS,
  the 1 MB body limit, Origin on the WebSocket, SQL injections and XSS (text instead of HTML).

The other tests log in automatically (`e2e/lib.mjs`); the harness starts an instance with its own credentials (`e2e-admin`), so `admin`/`admin` does not work there.

## Known limitations and risks

1. **One shared account** — all logged-in users have the same permissions and changes have no author. A leaked password means full access, so change the default `admin`/`admin` (easy to guess,
   the lockout only slows guessing down). Separate accounts, roles and an audit log — see [ROADMAP.md](ROADMAP.md).
2. **No HTTPS** — on a LAN the password and session travel in clear text. For use outside a LAN a reverse proxy with HTTPS is required (the cookie then gets `Secure`).
   The lack of a secure browser context is also the reason for the custom `clientId` generator instead of `crypto.randomUUID`.
3. **Login rate limiting** is in memory and per IP: a server restart resets the counters, and behind a proxy without `trustProxy` everyone has the same address. Other routes have no rate limiting (a 1 MB bodyLimit exists).
4. **No audit log** of logins and changes (only server logs).
5. **Development dependencies:** `npm audit` still reports 4 "moderate" vulnerabilities in `esbuild` within build tools (`tsup`, `drizzle-kit`
   via `@esbuild-kit`). They concern only the esbuild development server (`esbuild --serve`), which we do not use; they do not reach the production
   build. They will disappear only with later `tsup`/`drizzle-kit` releases — check when updating.
6. **Data at rest is not encrypted** — the SQLite file and backups are ordinary files; protect them with system permissions/disk encryption. In Docker run the server as non-root.

## What to add before opening up beyond a LAN (suggested order)

1. **Change the password** to a strong one and use HTTPS (reverse proxy: Caddy/nginx/Traefik), `Strict-Transport-Security`, `trustProxy`.
2. Separate accounts in the database (a users table with hashes, invitations), roles, ownership and per-project permissions, filtering `GET /projects` to accessible projects.
3. Rate limiting of the whole API (`@fastify/rate-limit`), a persistent login-attempt counter, possibly 2FA.
4. An audit log of changes and logins, monitoring, automatic off-machine backups.
