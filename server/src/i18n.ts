import type { IncomingHttpHeaders } from 'node:http';

/**
 * Komunikaty błędów API w języku interfejsu. Klient wysyła nagłówek `x-lang` (pl | en); kod serwera pisze komunikaty po polsku
 * (to klucz), a tutaj dostają angielskie odpowiedniki. Brak tłumaczenia = komunikat zostaje taki, jaki jest (po polsku).
 */
export type Lang = 'pl' | 'en';

const langOf = (headers: IncomingHttpHeaders): Lang => (headers['x-lang'] === 'en' ? 'en' : 'pl');

const EN: Record<string, string> = {
  'Wymagane logowanie': 'Login required',
  'Nieprawidłowy login lub hasło': 'Invalid username or password',
  'Niedozwolone źródło żądania': 'Request origin not allowed',
  'Nieprawidłowe dane': 'Invalid data',
  'Błąd serwera': 'Server error',
  'Nieznany użytkownik': 'Unknown user',
  'Nieznany tag': 'Unknown tag',
  'Użytkownik o takim nicku już istnieje': 'A user with this nickname already exists',
  'Tag o takiej nazwie już istnieje': 'A tag with this name already exists',
  'Powtórzone identyfikatory': 'Duplicate identifiers',
  'Nie znaleziono jednego z elementów': 'One of the items was not found',
  'Elementy należą do różnych rodziców': 'The items belong to different parents',
  'Projekt „Inne” ma tylko jedną listę - nie można jej dodać, skopiować ani usunąć':
    'The “Other” project has a single list - it cannot be added, copied or deleted',
  'Projektu „Inne” nie można przesuwać - zawsze jest pierwszy': 'The “Other” project cannot be moved - it is always first',
  'Projektu „Inne” nie można zarchiwizować': 'The “Other” project cannot be archived',
  'Projektu „Inne” nie można usunąć': 'The “Other” project cannot be deleted',
};

/** Nazwy zasobów w komunikacie „X nie istnieje”. */
const WHAT: Record<string, string> = { Projekt: 'Project', Lista: 'List', Zadanie: 'Task', Użytkownik: 'User', Tag: 'Tag' };

function localize(message: string, lang: Lang): string {
  if (lang === 'pl') return message;
  const exact = EN[message];
  if (exact) return exact;
  const missing = /^(.+) nie istnieje$/.exec(message);
  if (missing) return `${WHAT[missing[1]!] ?? missing[1]} not found`;
  const locked = /^Zbyt wiele nieudanych prób logowania\. Spróbuj ponownie za (\d+) min\.$/.exec(message);
  if (locked) return `Too many failed login attempts. Try again in ${locked[1]} min.`;
  return message;
}

/** Komunikat w języku żądania. */
export const tr = (headers: IncomingHttpHeaders, message: string): string => localize(message, langOf(headers));
