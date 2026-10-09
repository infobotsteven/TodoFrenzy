import { useSyncExternalStore } from 'react';
import { LANGS, type Lang, type Msg, type Plural } from './define';
import { MESSAGES, type MessageKey } from './messages';

export { LANGS, type Lang } from './define';
export type { MessageKey } from './messages';

/** Domyślnie polski (aplikacja jest polska); wybór użytkownika zapisuje się w przeglądarce. */
const DEFAULT_LANG: Lang = 'pl';
const LANG_KEY = 'lang';

function storedLang(): Lang {
  try {
    const value = localStorage.getItem(LANG_KEY);
    return LANGS.find((l) => l === value) ?? DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG; // np. tryb prywatny - język działa, tylko nie jest zapamiętywany
  }
}

let lang: Lang = storedLang();
const listeners = new Set<() => void>();
document.documentElement.lang = lang;

export const getLang = (): Lang => lang;

export function setLang(next: Lang) {
  if (next === lang) return;
  lang = next;
  document.documentElement.lang = next;
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    /* brak zapisu nie przeszkadza */
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Aktualny język; komponent renderuje się ponownie po jego zmianie. */
export const useLang = (): Lang => useSyncExternalStore(subscribe, getLang);

/** Kod ustawień regionalnych dla `Intl` (daty, nazwy dni i miesięcy). */
export const locale = (l: Lang = lang): string => (l === 'pl' ? 'pl-PL' : 'en-GB');

type Params = Record<string, string | number>;

const pluralRules: Record<Lang, Intl.PluralRules> = { pl: new Intl.PluralRules('pl'), en: new Intl.PluralRules('en') };

function pick(msg: Msg, params?: Params): string {
  if (typeof msg === 'string') return msg;
  const n = Number(params?.n ?? 0);
  const plural: Plural = msg;
  return plural[pluralRules[lang].select(n)] ?? plural.other;
}

/**
 * Tekst interfejsu w bieżącym języku: `t('projects.title')`, z parametrami `t('x', { name })`,
 * a dla liczby mnogiej `t('tasks.count', { n: 5 })` (parametr `n` wybiera formę).
 * To zwykła funkcja (nie hook) - działa też poza komponentami (komunikaty, okna potwierdzeń); komponenty
 * renderują się ponownie po zmianie języka, bo `App` montuje drzewo od nowa (`key={lang}`).
 */
export function t(key: MessageKey, params?: Params): string {
  const text = pick(MESSAGES[lang][key] ?? MESSAGES.pl[key], params);
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match)) : text;
}
