import type { Lang, Msg } from '../define';
import { auth } from './auth';
import { calendar } from './calendar';
import { projects } from './projects';
import { shell } from './shell';
import { stats } from './stats';
import { tasks } from './tasks';

const areas = [shell, auth, projects, tasks, calendar, stats];

/** Wszystkie teksty obu języków (obszary w osobnych plikach, każdy z PL i EN obok siebie). */
export const MESSAGES: Record<Lang, Record<MessageKey, Msg>> = {
  pl: Object.assign({}, ...areas.map((a) => a.pl)),
  en: Object.assign({}, ...areas.map((a) => a.en)),
};

export type MessageKey =
  | keyof typeof shell.pl
  | keyof typeof auth.pl
  | keyof typeof projects.pl
  | keyof typeof tasks.pl
  | keyof typeof calendar.pl
  | keyof typeof stats.pl;
