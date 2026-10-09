import { useLayoutEffect, useState } from 'react';

/** Stała szerokość listy na szerokich ekranach - ta sama w siatce i w sliderze (różni je tylko ułożenie). */
export const LIST_WIDTH = 340;
/** Minimalny odstęp między listami (w siatce wolne miejsce w rzędzie rozkłada się równo między kolumny). */
export const LIST_GAP = 16;

/**
 * Ile kolumn o minimalnej szerokości `minWidth` (z odstępem `gap`) mieści się w elemencie.
 * Przelicza się przy każdej zmianie jego szerokości. Zawsze zwraca co najmniej 1.
 */
export function useColumnCount(element: HTMLElement | null, minWidth: number, gap: number): number {
  const [count, setCount] = useState(1);

  useLayoutEffect(() => {
    if (!element) return;
    // wymiary podajemy przy 100% - przeliczamy je na skalę roota (na desktopie 120%)
    const measure = () => {
      const scale = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
      setCount(Math.max(1, Math.floor((element.clientWidth + gap * scale) / ((minWidth + gap) * scale))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [element, minWidth, gap]);

  return count;
}

/** Rozdziela elementy na kolumny po kolei (1., 2., 3., potem znów 1.…) - przydział do kolumny jest stały i przewidywalny. */
export function splitIntoColumns<T>(items: T[], columns: number): T[][] {
  const result: T[][] = Array.from({ length: columns }, () => []);
  items.forEach((item, index) => result[index % columns]!.push(item));
  return result;
}

