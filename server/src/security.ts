import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingHttpHeaders } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { config } from './config.js';
import { tr } from './i18n.js';

/** Skróty (sha256) skryptów inline z zbudowanego index.html - pozwalają zachować CSP bez `unsafe-inline` dla skryptów. */
function inlineScriptHashes(distDir: string): string[] {
  const file = path.join(distDir, 'index.html');
  if (!fs.existsSync(file)) return [];
  const html = fs.readFileSync(file, 'utf8');
  const hashes: string[] = [];
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    hashes.push(`'sha256-${crypto.createHash('sha256').update(match[1]!).digest('base64')}'`);
  }
  return hashes;
}

/**
 * Nagłówki bezpieczeństwa dla każdej odpowiedzi. W trybie dev frontend serwuje Vite, więc w praktyce dotyczy to API
 * i wersji produkcyjnej. Brak logowania oznacza, że link projektu jest sekretem - dlatego `Referrer-Policy: no-referrer`
 * (adres projektu nie wycieknie w nagłówku Referer) i zakaz osadzania w ramkach.
 */
export function registerSecurityHeaders(app: FastifyInstance) {
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${inlineScriptHashes(config.clientDistDir).join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'", // React ustawia style inline (kolory, szerokości)
    "img-src 'self' data:",
    "connect-src 'self' ws: wss:", // WebSocket (realtime)
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');

  app.addHook('onSend', async (_req, reply) => {
    reply.header('Content-Security-Policy', csp);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'DENY');
  });

  // Ochrona przed CSRF: żądanie zmieniające dane z innej strony (przeglądarka dołącza wtedy `Origin` obcej domeny) jest odrzucane.
  // Dotyczy też POST-ów bez ciała (archiwizacja, kopiowanie…), które przeglądarka wysyła bez zapytania wstępnego (preflight).
  // Klienty bez nagłówka Origin (skrypty, curl) i żądania z tego samego źródła przechodzą.
  app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return;
    const origin = req.headers.origin;
    if (!origin) return;
    if (!originMatchesHost(origin, req.headers)) {
      return reply.code(403).send({ error: tr(req.headers, 'Niedozwolone źródło żądania') });
    }
  });
}

/**
 * Czy `Origin` żądania wskazuje na ten sam host, pod którym pracuje aplikacja (`Host`, a za reverse proxy `X-Forwarded-Host`).
 * Obca strona nie ustawi tych nagłówków w prostym żądaniu przeglądarki, więc uwzględnienie `X-Forwarded-Host` nie osłabia ochrony.
 */
export function originMatchesHost(origin: string, headers: IncomingHttpHeaders): boolean {
  if (!URL.canParse(origin)) return false;
  const originHost = new URL(origin).host;
  const forwarded = headers['x-forwarded-host'];
  return originHost === headers.host || originHost === (Array.isArray(forwarded) ? forwarded[0] : forwarded);
}
