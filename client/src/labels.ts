import { SYSTEM_COLOR, SYSTEM_LIST_NAME, SYSTEM_PROJECT_DESCRIPTION, type Priority } from '@todo/shared';
import { t } from './i18n';

export const priorityLabel = (priority: Priority): string => t(`priority.${priority}`);

// Stały projekt „Inne” i jego lista „Zadania” są w bazie po polsku - na ekranie pokazujemy je w języku interfejsu.
/** Nazwa projektu do wyświetlenia (stały projekt tłumaczymy, pozostałe to dane użytkownika). */
export const projectName = (p: { name: string; isSystem: boolean }): string => (p.isSystem ? t('system.project') : p.name);
export const projectDescription = (p: { description: string; isSystem: boolean }): string => (p.isSystem && p.description === SYSTEM_PROJECT_DESCRIPTION ? t('system.description') : p.description);
/** Projekt z zadań kalendarza rozpoznajemy po zarezerwowanym kolorze stałego projektu. */
const isSystemColor = (color: string | null): boolean => color === SYSTEM_COLOR;
export const calendarProjectName = (name: string, color: string | null): string => (isSystemColor(color) ? t('system.project') : name);
/** Nazwa listy: jedyna lista stałego projektu jest tłumaczona, listy użytkownika nie. */
export const listName = (name: string, inSystemProject: boolean): string => (inSystemProject && name === SYSTEM_LIST_NAME ? t('system.list') : name);

/** Data lokalna w formacie YYYY-MM-DD (do porównań z datami list, które też są bez godziny). */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
