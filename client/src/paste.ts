import { MAX_BULK_TASKS } from '@todo/shared';
import { t } from './i18n';

export type PastedTask = { name: string; completed: boolean };

// Znaczniki listy na początku linii: "- ", "* ", "• ", "1. ", "2) ", a po nich opcjonalnie pole wyboru "[ ]" / "[x]"
const LINE = /^\s*(?:(?:[-*+•▪●◦–—]|\d+[.)])\s+)?(?:\[([ xX✓✔]?)\]\s*)?(.*)$/;

/**
 * Rozpoznaje wklejoną listę zadań. Zwraca zadania, gdy tekst ma co najmniej dwie niepuste linie,
 * w przeciwnym razie null (wtedy wklejanie działa jak zwykle). Usuwa punktory i numerację,
 * a "[x]" traktuje jako zadanie wykonane.
 */
export function parsePastedTasks(text: string): { tasks: PastedTask[]; truncated: boolean } | null {
  const tasks: PastedTask[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = LINE.exec(line);
    const name = match?.[2]?.trim().slice(0, 200);
    if (!name) continue;
    tasks.push({ name, completed: /[xX✓✔]/.test(match?.[1] ?? '') });
  }
  if (tasks.length < 2) return null;
  return { tasks: tasks.slice(0, MAX_BULK_TASKS), truncated: tasks.length > MAX_BULK_TASKS };
}

/** "1 zadanie", "3 zadania", "5 zadań" (w angielskim: "1 task", "5 tasks") */
export const pluralTasks = (n: number): string => t('tasks.count', { n });
