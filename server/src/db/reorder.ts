import { eq, inArray } from 'drizzle-orm';
import { HttpError } from '../errors.js';
import { db } from './client.js';
import { checklists, projects, tasks } from './schema.js';

type Row = { id: string; sortOrder: number; parent: string };

/**
 * Zmiana kolejności "w slotach": przesyłane id dostają kolejno te same wartości sort_order,
 * które zajmowały wcześniej (posortowane rosnąco). Elementy spoza listy zostają na swoich miejscach,
 * więc równoległe dodanie/usunięcie elementu przez inną osobę nie psuje kolejności.
 */
function plan(rows: Row[], ids: string[]) {
  if (new Set(ids).size !== ids.length) throw new HttpError(400, 'Powtórzone identyfikatory');
  if (rows.length !== ids.length) throw new HttpError(404, 'Nie znaleziono jednego z elementów');
  if (new Set(rows.map((r) => r.parent)).size > 1) {
    throw new HttpError(400, 'Elementy należą do różnych rodziców');
  }
  const slots = rows.map((r) => r.sortOrder).sort((a, b) => a - b);
  return { parent: rows[0]?.parent ?? '', updates: ids.map((id, i) => ({ id, sortOrder: slots[i]! })) };
}

export function reorderProjects(ids: string[]) {
  const rows = db
    .select({ id: projects.id, sortOrder: projects.sortOrder })
    .from(projects)
    .where(inArray(projects.id, ids))
    .all()
    .map((r) => ({ ...r, parent: '' }));
  const { updates } = plan(rows, ids);
  db.transaction((tx) => {
    for (const u of updates) tx.update(projects).set({ sortOrder: u.sortOrder }).where(eq(projects.id, u.id)).run();
  });
}

/** Zwraca id projektu, do którego należą listy (do odświeżenia jego daty aktualizacji). */
export function reorderChecklists(ids: string[]): string {
  const rows = db
    .select({ id: checklists.id, sortOrder: checklists.sortOrder, parent: checklists.projectId })
    .from(checklists)
    .where(inArray(checklists.id, ids))
    .all();
  const { parent, updates } = plan(rows, ids);
  db.transaction((tx) => {
    for (const u of updates) tx.update(checklists).set({ sortOrder: u.sortOrder }).where(eq(checklists.id, u.id)).run();
  });
  return parent;
}

/** Zwraca id projektu, do którego należą zadania. */
export function reorderTasks(ids: string[]): string {
  const rows = db
    .select({ id: tasks.id, sortOrder: tasks.sortOrder, parent: tasks.checklistId, projectId: checklists.projectId })
    .from(tasks)
    .innerJoin(checklists, eq(checklists.id, tasks.checklistId))
    .where(inArray(tasks.id, ids))
    .all();
  const { updates } = plan(rows, ids);
  db.transaction((tx) => {
    for (const u of updates) tx.update(tasks).set({ sortOrder: u.sortOrder }).where(eq(tasks.id, u.id)).run();
  });
  return rows[0]!.projectId;
}
