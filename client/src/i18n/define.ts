export const LANGS = ['pl', 'en'] as const;
export type Lang = (typeof LANGS)[number];

/** Liczba mnoga wg reguł języka (Intl.PluralRules): `other` jest wymagane, reszta kategorii opcjonalna. */
export type Plural = { other: string; zero?: string; one?: string; two?: string; few?: string; many?: string };
export type Msg = string | Plural;

/**
 * Teksty jednego obszaru aplikacji w obu językach obok siebie. Zbiór kluczy angielskiego musi być identyczny z polskim
 * (kompilator wskaże brakujący albo nadmiarowy klucz). Wartości mogą zawierać `{parametr}`; liczba mnoga to obiekt `Plural`
 * wybierany po parametrze `n`.
 */
export function defineMessages<const P extends Record<string, Msg>>(pl: P, en: Record<keyof P, Msg>) {
  return { pl, en };
}
