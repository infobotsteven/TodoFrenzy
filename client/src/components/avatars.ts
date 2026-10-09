import type { Avatar } from '@todo/shared';
import { t } from '../i18n';

/**
 * Pikselowe awatary zwierzaków (16×16). Każdy rysunek to 16 wierszy po 8 znaków - LEWA połowa pyska,
 * prawa jest jej lustrzanym odbiciem (dzięki temu zwierzak jest zawsze symetryczny).
 *
 * Znaki: '.' przezroczysty, 'o' kontur, '1' '2' '3' kolory zwierzaka (wg palety), 'e' oko, 'w' błysk w oku/biel,
 * 'n' nos. Rysunki są w kodzie, bez zewnętrznych plików, więc działają w sieci lokalnej bez internetu.
 */

type Rows = readonly string[];

/** Wspólna baza pyska; poszczególne zwierzaki podmieniają tylko wybrane wiersze (uszy, nos, pyszczek…). */
const BASE: Rows = [
  '........', // 0
  '........', // 1
  '........', // 2
  '........', // 3
  '..oooooo', // 4
  '.o111111', // 5
  'o1111111', // 6
  'o1111111', // 7
  'o11we111', // 8
  'o11ee111', // 9
  'o1111111', // 10
  'o1122222', // 11
  'o112222n', // 12
  '.o122222', // 13
  '..oooooo', // 14
  '........', // 15
];

const make = (patch: Record<number, string>): Rows => BASE.map((row, i) => patch[i] ?? row);

type Palette = { bg: string; '1': string; '2': string; '3': string; n: string };

export const AVATAR_SPRITES: Record<Avatar, { rows: Rows; palette: Palette }> = {
  cat: {
    rows: make({
      1: '.o......',
      2: '.oo.....',
      3: '.o31o...',
      4: '.o311ooo',
    }),
    palette: { bg: '#cfe8ff', '1': '#f4a259', '2': '#fff1d6', '3': '#f28b82', n: '#d6617a' },
  },
  dog: {
    rows: make({
      5: '.o331111',
      6: 'o3311111',
      7: 'o3311111',
      8: 'o33we111',
      9: 'o33ee111',
      10: 'o3311111',
      11: 'o11222nn',
      12: 'o112222n',
    }),
    palette: { bg: '#fde2e4', '1': '#d9a066', '2': '#f6e3c4', '3': '#8b5a2b', n: '#2b2b2b' },
  },
  fox: {
    rows: make({
      1: '.o......',
      2: '.o1o....',
      3: '.o31o...',
      4: '.o311ooo',
      10: 'o2211111',
      11: 'o2222222',
      12: 'o222222n',
      13: '.o222222',
    }),
    palette: { bg: '#d8f3dc', '1': '#e8742c', '2': '#fff4e6', '3': '#6b3a1e', n: '#2b2b2b' },
  },
  bear: {
    rows: make({
      2: '.oo.....',
      3: 'o11o....',
      4: 'o13ooooo',
      11: 'o1122222',
      12: 'o112222n',
    }),
    palette: { bg: '#fff3bf', '1': '#a0693a', '2': '#e2bd8a', '3': '#d9a066', n: '#2b2b2b' },
  },
  rabbit: {
    rows: make({
      0: '..oo....',
      1: '.o31o...',
      2: '.o31o...',
      3: '.o31o...',
      4: '.o31oooo',
    }),
    palette: { bg: '#e0e7ff', '1': '#f1ece6', '2': '#ffffff', '3': '#f4a6b8', n: '#e58aa0' },
  },
  panda: {
    rows: make({
      2: '.oo.....',
      3: 'o33o....',
      4: 'o33ooooo',
      7: 'o1333111',
      8: 'o33w3111',
      9: 'o3333111',
      10: 'o1333111',
    }),
    palette: { bg: '#d3f9d8', '1': '#fafafa', '2': '#ffffff', '3': '#2f2f2f', n: '#2f2f2f' },
  },
  frog: {
    rows: make({
      3: '.ooo....',
      4: 'o1woooo.',
      5: 'o1wo1111',
      8: 'o11we111',
      11: 'o1122222',
      12: 'o11oooo2',
    }),
    palette: { bg: '#fff0c9', '1': '#7bc96f', '2': '#d9f5c6', '3': '#4f9d4a', n: '#3b7d3a' },
  },
  pig: {
    rows: make({
      3: '.oo.....',
      4: '.o3ooooo',
      11: 'o1133333',
      12: 'o113n3n3',
      13: '.o133333',
    }),
    palette: { bg: '#e7f5ff', '1': '#f7a8b8', '2': '#f7a8b8', '3': '#f48fb1', n: '#b04a6b' },
  },
  owl: {
    rows: make({
      3: '.o.o....',
      4: '.o1ooooo',
      7: 'o1wwww11',
      8: 'o1wee1w1',
      9: 'o1wee1w1',
      10: 'o1wwww11',
      11: 'o1112222',
      12: 'o1113333',
    }),
    palette: { bg: '#ffe8cc', '1': '#a47148', '2': '#e8d4b0', '3': '#f4a259', n: '#f4a259' },
  },
  penguin: {
    rows: make({
      4: '..oooooo',
      5: '.o111111',
      6: 'o1111111',
      7: 'o1221111',
      8: 'o22we111',
      9: 'o22ee111',
      10: 'o2222222',
      11: 'o2222233',
      12: 'o222233n',
      13: '.o223333',
    }),
    palette: { bg: '#d0ebff', '1': '#2f3b52', '2': '#ffffff', '3': '#f9a03f', n: '#f9a03f' },
  },
  lion: {
    rows: make({
      3: '..oooooo',
      4: '.o333333',
      5: 'o3333333',
      6: 'o3111111',
      7: 'o3111111',
      8: 'o31we111',
      9: 'o31ee111',
      10: 'o3111111',
      11: 'o3122222',
      12: 'o312222n',
      13: 'o3322222',
      14: '.o333333',
    }),
    palette: { bg: '#fff9db', '1': '#f0b44c', '2': '#fbe6b8', '3': '#9c5b1e', n: '#2b2b2b' },
  },
  koala: {
    rows: make({
      1: '.ooo....',
      2: 'o222o...',
      3: 'o232o...',
      4: 'o222oooo',
      5: 'o2211111',
      10: 'o111111n',
      11: 'o11111nn',
      12: 'o11111nn',
      13: '.o11111n',
    }),
    palette: { bg: '#e9ecef', '1': '#adb5bd', '2': '#dee2e6', '3': '#868e96', n: '#343a40' },
  },
};

const OUTLINE = '#2b2233';
const EYE = '#1b1b1b';
const WHITE = '#ffffff';

/** Zamienia rysunek na listę prostokątów SVG (kolejne piksele tego samego koloru w wierszu łączone w jeden pasek). */
export function spriteRects(avatar: Avatar): { x: number; y: number; w: number; fill: string }[] {
  const { rows, palette } = AVATAR_SPRITES[avatar];
  const color = (ch: string): string | null => {
    if (ch === '.') return null;
    if (ch === 'o') return OUTLINE;
    if (ch === 'e') return EYE;
    if (ch === 'w') return WHITE;
    if (ch === 'n') return palette.n;
    if (ch === '1' || ch === '2' || ch === '3') return palette[ch];
    return null;
  };
  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  rows.forEach((half, y) => {
    const full = half + [...half].reverse().join('');
    let x = 0;
    while (x < 16) {
      const fill = color(full[x]!);
      let w = 1;
      while (x + w < 16 && color(full[x + w]!) === fill) w++;
      if (fill) rects.push({ x, y, w, fill });
      x += w;
    }
  });
  return rects;
}

/** Nazwa zwierzaka w języku interfejsu. */
export const avatarLabel = (avatar: Avatar): string => t(`avatar.${avatar}`);

