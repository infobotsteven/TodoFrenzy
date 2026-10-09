import { getLang, t } from './i18n';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * Losowy identyfikator tej karty przeglądarki. Serwer dopisuje go do zdarzeń WebSocket,
 * dzięki czemu klient pomija zdarzenia o własnych zmianach. (Bez crypto.randomUUID - ono wymaga HTTPS,
 * a w sieci lokalnej działamy po zwykłym HTTP.)
 */
export const clientId = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
  b.toString(16).padStart(2, '0'),
).join('');

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
/** Rejestruje reakcję na 401 (wygasła sesja) - aplikacja wraca wtedy do ekranu logowania. */
export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  onUnauthorized = handler;
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        'x-client-id': clientId,
        'x-lang': getLang(), // serwer odpowiada komunikatami błędów w tym języku
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(t('app.noConnection'), 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (res.status === 401 && path !== '/auth/login' && path !== '/auth/me') onUnauthorized?.();
  if (!res.ok) throw new ApiError(data?.error ?? t('app.serverErrorStatus', { status: res.status }), res.status);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: (path: string) => request<void>('DELETE', path),
};
