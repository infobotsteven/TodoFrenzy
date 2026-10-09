import { asc, desc, eq, inArray, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import type { Checklist, ProjectDetail, ProjectSummary, Tag, Task, User } from '@todo/shared';
import { db } from './client.js';
import { checklists, checklistTags, projects, tags, taskUsers, tasks, users } from './schema.js';

const iso = (d: Date) => d.toISOString();

// --- Projekty ---

function summaries(where?: SQL): ProjectSummary[] {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      color: projects.color,
      isSystem: projects.isSystem,
      archivedAt: projects.archivedAt,
      sortOrder: projects.sortOrder,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      taskCount: sql<number>`count(${tasks.id})`.mapWith(Number),
      completedCount: sql<number>`coalesce(sum(${tasks.completed}), 0)`.mapWith(Number),
    })
    .from(projects)
    .leftJoin(checklists, eq(checklists.projectId, projects.id))
    .leftJoin(tasks, eq(tasks.checklistId, checklists.id))
    .where(where)
    .groupBy(projects.id)
    .orderBy(desc(projects.isSystem), asc(projects.sortOrder), asc(projects.createdAt))
    .all()
    .map((r) => ({ ...r, createdAt: iso(r.createdAt), updatedAt: iso(r.updatedAt), archivedAt: r.archivedAt ? iso(r.archivedAt) : null }));
}

export const listProjects = () => summaries();
export const getProjectSummary = (id: string) => summaries(eq(projects.id, id))[0];

export function getProjectDetail(id: string): ProjectDetail | undefined {
  const summary = getProjectSummary(id);
  if (!summary) return undefined;
  return { ...summary, checklists: loadChecklists(id) };
}

// --- Listy (z tagami) ---

function toChecklist(row: typeof checklists.$inferSelect, tagsOf: Tag[], tasksOf: Task[]): Checklist {
  return { ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), tags: tagsOf, tasks: tasksOf };
}

/** Tagi podanych list, alfabetycznie. */
function loadChecklistTags(checklistIds: string[]): Map<string, Tag[]> {
  const byList = new Map<string, Tag[]>();
  if (!checklistIds.length) return byList;
  const rows = db
    .select({ checklistId: checklistTags.checklistId, id: tags.id, name: tags.name })
    .from(checklistTags)
    .innerJoin(tags, eq(tags.id, checklistTags.tagId))
    .where(inArray(checklistTags.checklistId, checklistIds))
    .orderBy(asc(tags.name))
    .all();
  for (const { checklistId, ...tag } of rows) {
    byList.set(checklistId, [...(byList.get(checklistId) ?? []), tag]);
  }
  return byList;
}

function loadChecklists(projectId: string): Checklist[] {
  const rows = db
    .select()
    .from(checklists)
    .where(eq(checklists.projectId, projectId))
    .orderBy(asc(checklists.sortOrder), asc(checklists.createdAt))
    .all();
  const ids = rows.map((r) => r.id);
  const tagsByList = loadChecklistTags(ids);
  const tasksByList = loadTasks(ids);
  return rows.map((r) => toChecklist(r, tagsByList.get(r.id) ?? [], tasksByList.get(r.id) ?? []));
}

export function getChecklist(id: string): Checklist | undefined {
  const row = db.select().from(checklists).where(eq(checklists.id, id)).get();
  if (!row) return undefined;
  return toChecklist(row, loadChecklistTags([id]).get(id) ?? [], loadTasks([id]).get(id) ?? []);
}

/** Zastępuje tagi listy podanym zestawem (wywoływać w transakcji, gdy `executor` to `tx`). */
export function setChecklistTags(
  executor: Pick<typeof db, 'delete' | 'insert'>,
  checklistId: string,
  tagIds: string[],
) {
  executor.delete(checklistTags).where(eq(checklistTags.checklistId, checklistId)).run();
  for (const tagId of new Set(tagIds)) executor.insert(checklistTags).values({ checklistId, tagId }).run();
}

// --- Zadania ---

/** Użytkownicy przypisani do podanych zadań, alfabetycznie po nicku. */
export function loadTaskUsers(taskIds: string[]): Map<string, User[]> {
  const byTask = new Map<string, User[]>();
  if (!taskIds.length) return byTask;
  const rows = db
    .select({ taskId: taskUsers.taskId, id: users.id, nick: users.nick, avatar: users.avatar })
    .from(taskUsers)
    .innerJoin(users, eq(users.id, taskUsers.userId))
    .where(inArray(taskUsers.taskId, taskIds))
    .orderBy(sql`lower(${users.nick})`)
    .all();
  for (const { taskId, ...user } of rows) {
    byTask.set(taskId, [...(byTask.get(taskId) ?? []), user]);
  }
  return byTask;
}

export function toTask(row: typeof tasks.$inferSelect, usersOf: User[] = []): Task {
  return { ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), users: usersOf };
}

/** Zastępuje użytkowników zadania podanym zestawem (wywoływać w transakcji, gdy `executor` to `tx`). */
export function setTaskUsers(executor: Pick<typeof db, 'delete' | 'insert'>, taskId: string, userIds: string[]) {
  executor.delete(taskUsers).where(eq(taskUsers.taskId, taskId)).run();
  for (const userId of new Set(userIds)) executor.insert(taskUsers).values({ taskId, userId }).run();
}

export const listUsers = (): User[] => db.select().from(users).orderBy(sql`lower(${users.nick})`).all().map(({ createdAt: _c, ...u }) => u);

/** Zwraca id użytkowników, których nie ma w bazie. */
export function missingUserIds(ids: string[]): string[] {
  if (!ids.length) return [];
  const found = new Set(db.select({ id: users.id }).from(users).where(inArray(users.id, ids)).all().map((u) => u.id));
  return ids.filter((id) => !found.has(id));
}

function loadTasks(checklistIds: string[]): Map<string, Task[]> {
  const byList = new Map<string, Task[]>();
  if (!checklistIds.length) return byList;
  const rows = db
    .select()
    .from(tasks)
    .where(inArray(tasks.checklistId, checklistIds))
    .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt))
    .all();
  const usersByTask = loadTaskUsers(rows.map((r) => r.id));
  for (const row of rows) {
    byList.set(row.checklistId, [...(byList.get(row.checklistId) ?? []), toTask(row, usersByTask.get(row.id))]);
  }
  return byList;
}

export function getTask(id: string): Task | undefined {
  const row = db.select().from(tasks).where(eq(tasks.id, id)).get();
  return row && toTask(row, loadTaskUsers([id]).get(id));
}

export const listTags = (): Tag[] => db.select().from(tags).orderBy(asc(tags.name)).all();

/** Zwraca id tagów, których nie ma w bazie. */
export function missingTagIds(ids: string[]): string[] {
  if (!ids.length) return [];
  const found = new Set(
    db.select({ id: tags.id }).from(tags).where(inArray(tags.id, ids)).all().map((t) => t.id),
  );
  return ids.filter((id) => !found.has(id));
}

// --- Kolejność: nowy element ląduje na końcu ---

const maxSort = (col: AnyColumn) => sql<number>`coalesce(max(${col}), -1)`.mapWith(Number);

export const nextProjectSort = () =>
  db.select({ m: maxSort(projects.sortOrder) }).from(projects).get()!.m + 1;

export const nextChecklistSort = (projectId: string) =>
  db.select({ m: maxSort(checklists.sortOrder) }).from(checklists).where(eq(checklists.projectId, projectId)).get()!.m + 1;

export const nextTaskSort = (checklistId: string) =>
  db.select({ m: maxSort(tasks.sortOrder) }).from(tasks).where(eq(tasks.checklistId, checklistId)).get()!.m + 1;

// --- Odświeżanie "Zaktualizowano" projektu po zmianach w jego listach i zadaniach ---

export function touchProject(projectId: string) {
  db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId)).run();
}

export const projectIdOfChecklist = (checklistId: string) =>
  db.select({ id: checklists.projectId }).from(checklists).where(eq(checklists.id, checklistId)).get()?.id;

export const projectIdOfTask = (taskId: string) =>
  db
    .select({ id: checklists.projectId })
    .from(tasks)
    .innerJoin(checklists, eq(checklists.id, tasks.checklistId))
    .where(eq(tasks.id, taskId))
    .get()?.id;



