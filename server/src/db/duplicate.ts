import { asc, eq, gt, sql } from 'drizzle-orm';
import { SYSTEM_COLOR } from '@todo/shared';
import { db } from './client.js';
import { newId } from './ids.js';
import { checklists, checklistTags, projects, taskUsers, tasks } from './schema.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const NAME_MAX = 200;

/** "Nazwa" -> "Nazwa (kopia)", z zachowaniem limitu długości nazwy. */
const copyName = (name: string) => `${name.slice(0, NAME_MAX - ' (kopia)'.length)} (kopia)`;

/** Kopiuje zadania listy: ta sama kolejność, priorytety, terminy i przypisani użytkownicy, ale wszystkie jako niewykonane. */
function copyTasks(tx: Tx, fromChecklistId: string, toChecklistId: string) {
  const source = tx.select().from(tasks).where(eq(tasks.checklistId, fromChecklistId)).orderBy(asc(tasks.sortOrder)).all();
  if (!source.length) return;

  for (const t of source) {
    const newTaskId = newId();
    tx.insert(tasks)
      .values({
        id: newTaskId,
        checklistId: toChecklistId,
        name: t.name,
        description: t.description,
        priority: t.priority,
        dueDate: t.dueDate,
        completed: false,
        sortOrder: t.sortOrder,
      })
      .run();
    const links = tx.select().from(taskUsers).where(eq(taskUsers.taskId, t.id)).all();
    for (const l of links) tx.insert(taskUsers).values({ taskId: newTaskId, userId: l.userId }).run();
  }
}

/** Kopiuje listę (z zadaniami) do wskazanego projektu na podane miejsce. Zwraca id kopii. */
function copyChecklist(tx: Tx, source: typeof checklists.$inferSelect, projectId: string, sortOrder: number, name: string) {
  const id = newId();
  tx.insert(checklists)
    .values({
      id,
      projectId,
      name,
      description: source.description,
      color: source.color,
      sortOrder,
    })
    .run();
  // tagi listy też są kopiowane
  const links = tx.select().from(checklistTags).where(eq(checklistTags.checklistId, source.id)).all();
  for (const l of links) tx.insert(checklistTags).values({ checklistId: id, tagId: l.tagId }).run();
  copyTasks(tx, source.id, id);
  return id;
}

/** Kopia projektu ląduje tuż za oryginałem. Zwraca id kopii albo undefined, gdy oryginał nie istnieje. */
export function duplicateProject(sourceId: string): string | undefined {
  return db.transaction((tx) => {
    const source = tx.select().from(projects).where(eq(projects.id, sourceId)).get();
    if (!source) return undefined;

    tx.update(projects).set({ sortOrder: sql`${projects.sortOrder} + 1` }).where(gt(projects.sortOrder, source.sortOrder)).run();
    const id = newId();
    tx.insert(projects)
      .values({
        id,
        name: copyName(source.name),
        description: source.description,
        // kolor „Inne” jest zarezerwowany dla stałego projektu - kopia dostaje domyślny wygląd
        color: source.color === SYSTEM_COLOR ? null : source.color,
        sortOrder: source.sortOrder + 1,
      })
      .run();
    const lists = tx.select().from(checklists).where(eq(checklists.projectId, sourceId)).orderBy(asc(checklists.sortOrder)).all();
    lists.forEach((list, index) => copyChecklist(tx, list, id, index, list.name));
    return id;
  });
}

/** Kopia listy ląduje tuż za oryginałem, w tym samym projekcie. */
export function duplicateChecklist(sourceId: string): string | undefined {
  return db.transaction((tx) => {
    const source = tx.select().from(checklists).where(eq(checklists.id, sourceId)).get();
    if (!source) return undefined;

    tx.update(checklists)
      .set({ sortOrder: sql`${checklists.sortOrder} + 1` })
      .where(sql`${checklists.projectId} = ${source.projectId} and ${checklists.sortOrder} > ${source.sortOrder}`)
      .run();
    return copyChecklist(tx, source, source.projectId, source.sortOrder + 1, copyName(source.name));
  });
}



