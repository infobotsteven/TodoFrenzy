import crypto from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { eq, lt, ne, or } from 'drizzle-orm';
import { db } from './db/client.js';
import { sessions } from './db/schema.js';

/**
 * Logowanie jednym wspólnym kontem (na ten moment): dane z `.env`, sesje w SQLite, ciasteczko `HttpOnly`.
 * Konto: AUTH_USER (domyślnie „admin”) + AUTH_PASSWORD_HASH (zalecane; `npm run auth:hash`) albo AUTH_PASSWORD (jawne hasło).
 * Gdy nie ma żadnego hasła, obowiązuje „admin” — serwer ostrzega w logu.
 */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

/** Format: `scrypt$N$sól(hex)$hash(hex)`. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyHash(password: string, stored: string): boolean {
  const [scheme, n, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'hex'), expected.length, { N: Number(n), r: SCRYPT.r, p: SCRYPT.p });
  return crypto.timingSafeEqual(actual, expected);
}

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
/** Porównanie w stałym czasie (przez skróty o równej długości). */
const safeEqual = (a: string, b: string) => crypto.timingSafeEqual(Buffer.from(sha256(a)), Buffer.from(sha256(b)));

const number = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// Puste wartości w .env (np. `AUTH_PASSWORD=`) traktujemy jak brak ustawienia
const envValue = (name: string) => process.env[name]?.trim() || undefined;
const hashEnv = envValue('AUTH_PASSWORD_HASH');
const plainPassword = hashEnv ? undefined : (envValue('AUTH_PASSWORD') ?? 'admin');
const passwordHash = hashEnv ?? hashPassword(plainPassword!);
const user = envValue('AUTH_USER') ?? 'admin';
const env = process.env;

export const authConfig = {
  user,
  /** Używane ustawienia domyślne (admin/admin) — serwer ostrzega przy starcie. */
  usingDefaultCredentials: user === 'admin' && !hashEnv && plainPassword === 'admin',
  /** Odcisk poświadczeń: zmiana loginu lub hasła w `.env` unieważnia wszystkie istniejące sesje. Stabilny między restartami. */
  fingerprint: sha256(`${user}\n${hashEnv ?? plainPassword}`).slice(0, 32),
  sessionMs: number(env.AUTH_SESSION_SECONDS, 7 * 24 * 3600) * 1000,
  maxAttempts: Math.floor(number(env.AUTH_MAX_ATTEMPTS, 5)),
  lockMs: number(env.AUTH_LOCK_SECONDS, 15 * 60) * 1000,
};

const SESSION_COOKIE = 'todofrenzy_session';

/** Sprawdza login i hasło; zawsze wykonuje oba porównania (bez wskazywania, które było błędne). */
export function verifyCredentials(inputUser: string, inputPassword: string): boolean {
  const userOk = safeEqual(inputUser, authConfig.user);
  const passwordOk = verifyHash(inputPassword, passwordHash);
  return userOk && passwordOk;
}

// --- Ograniczanie prób logowania (w pamięci, po adresie IP) ---

type Attempts = { failures: number[]; lockedUntil: number };
const attempts = new Map<string, Attempts>();

/** Ile ms jeszcze trwa blokada tego adresu (0 = brak blokady). */
export function lockRemainingMs(ip: string, now = Date.now()): number {
  const entry = attempts.get(ip);
  return entry && entry.lockedUntil > now ? entry.lockedUntil - now : 0;
}

export function recordFailure(ip: string, now = Date.now()) {
  const entry = attempts.get(ip) ?? { failures: [], lockedUntil: 0 };
  entry.failures = [...entry.failures.filter((t) => now - t < authConfig.lockMs), now];
  if (entry.failures.length >= authConfig.maxAttempts) {
    entry.lockedUntil = now + authConfig.lockMs;
    entry.failures = [];
  }
  attempts.set(ip, entry);
}

export const clearFailures = (ip: string) => attempts.delete(ip);

// --- Sesje ---

const tokenHash = (token: string) => sha256(token);

export function createSession(now = Date.now()): { token: string; expiresAt: number } {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = now + authConfig.sessionMs;
  db.insert(sessions)
    .values({ tokenHash: tokenHash(token), expiresAt: new Date(expiresAt), lastSeenAt: new Date(now), credentialFingerprint: authConfig.fingerprint })
    .run();
  return { token, expiresAt };
}

/**
 * Czy token to ważna sesja. Sesja przesuwa się wraz z aktywnością (sliding): przedłużamy ją, gdy od ostatniego przedłużenia minęło co najmniej
 * 1/20 jej długości — nie zapisujemy w bazie przy każdym żądaniu. `refreshedExpiresAt` zwracamy, żeby odświeżyć też ciasteczko.
 */
export function validateSession(token: string | undefined, now = Date.now()): { valid: boolean; refreshedExpiresAt?: number } {
  if (!token) return { valid: false };
  const row = db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash(token))).get();
  if (!row || row.expiresAt.getTime() <= now || row.credentialFingerprint !== authConfig.fingerprint) return { valid: false };
  if (now - row.lastSeenAt.getTime() >= authConfig.sessionMs / 20) {
    const expiresAt = now + authConfig.sessionMs;
    db.update(sessions).set({ expiresAt: new Date(expiresAt), lastSeenAt: new Date(now) }).where(eq(sessions.tokenHash, row.tokenHash)).run();
    return { valid: true, refreshedExpiresAt: expiresAt };
  }
  return { valid: true };
}

export const destroySession = (token: string) => db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token))).run();

/** Usuwa wygasłe sesje oraz sesje założone przy innych poświadczeniach. */
export function purgeSessions(now = Date.now()) {
  db.delete(sessions)
    .where(or(lt(sessions.expiresAt, new Date(now)), ne(sessions.credentialFingerprint, authConfig.fingerprint)))
    .run();
}

// --- Ciasteczko ---

export function readSessionToken(headers: IncomingHttpHeaders): string | undefined {
  const header = headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === SESSION_COOKIE) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return undefined; // zepsute kodowanie procentowe = brak sesji (nie błąd serwera)
      }
    }
  }
  return undefined;
}

/** `Secure` tylko po HTTPS (także za reverse proxy z `X-Forwarded-Proto`) — na zwykłym HTTP w LAN przeglądarka odrzuciłaby takie ciasteczko. */
export function isHttps(headers: IncomingHttpHeaders): boolean {
  const forwarded = headers['x-forwarded-proto'];
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() === 'https';
}

export function sessionCookie(token: string, expiresAt: number, secure: boolean, now = Date.now()): string {
  const maxAge = Math.max(0, Math.round((expiresAt - now) / 1000));
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export const clearedCookie = (secure: boolean) => `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
