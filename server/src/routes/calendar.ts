import type { FastifyPluginAsync } from 'fastify';
import { and, asc, desc, eq, gte, isNotNull, isNull, lt, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  calendarQuerySchema,
  overdueQuerySchema,
  type ArchivedTasks,
  type CalendarRange,
  type CalendarSourceProject,
  type CalendarSources,
  type CalendarTask,
  type OverdueTasks,
  type UndatedTasks,
} from '@todo/shared';
import { db } from '../db/client.js';
import { loadTaskUsers, toTask } from '../db/queries.js';
import { checklists, projects, tasks } from '../db/schema.js';

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/**
 * Zadania spełniające warunek, każde z projektem i listą, do których należy, oraz opcje filtrów (projekty i listy, w których
 * coś jest) — stały projekt „Inne” pierwszy, jak na liście projektów. Wspólne dla widoków „Zaległe”, „Bez terminu” i „Archiwum”.
 * Zadania zarchiwizowanych projektów trafiają tylko do archiwum (`includeArchivedProjects`) — w pozostałych widokach ich nie ma.
 */
function loadTaskList(
  where: SQL | undefined,
  order: SQL[],
  { includeArchivedProjects = false } = {},
): { tasks: CalendarTask[]; sources: CalendarSources } {
  const rows = db
    .select({
      task: tasks,
      projectId: projects.id,
      projectName: projects.name,
      projectColor: projects.color,
      projectArchivedAt: projects.archivedAt,
      projectSort: projects.sortOrder,
      projectIsSystem: projects.isSystem,
      checklistName: checklists.name,
      checklistColor: checklists.color,
      checklistSort: checklists.sortOrder,
    })
    .from(tasks)
    .innerJoin(checklists, eq(checklists.id, tasks.checklistId))
    .innerJoin(projects, eq(projects.id, checklists.projectId))
    .where(includeArchivedProjects ? where : and(where, isNull(projects.archivedAt)))
    .orderBy(...order)
    .all();
  const usersByTask = loadTaskUsers(rows.map((r) => r.task.id));

  const sorted = [...rows].sort(
    (a, b) =>
      Number(b.projectIsSystem) - Number(a.projectIsSystem) || a.projectSort - b.projectSort || a.checklistSort - b.checklistSort,
  );
  // opcje filtrów: aktywne i zarchiwizowane projekty osobno (zarchiwizowane są tylko w widoku „Archiwum”)
  const byProject = new Map<string, CalendarSourceProject>();
  const byArchivedProject = new Map<string, CalendarSourceProject>();
  for (const r of sorted) {
    const target = r.projectArchivedAt ? byArchivedProject : byProject;
    let project = target.get(r.projectId);
    if (!project) {
      project = { id: r.projectId, name: r.projectName, color: r.projectColor, lists: [] };
      target.set(r.projectId, project);
    }
    if (!project.lists.some((l) => l.id === r.task.checklistId)) {
      project.lists.push({ id: r.task.checklistId, name: r.checklistName, color: r.checklistColor });
    }
  }

  return {
    tasks: rows.map(({ task, projectSort: _ps, projectIsSystem: _si, checklistSort: _cs, projectArchivedAt, ...rest }) => ({
      ...toTask(task, usersByTask.get(task.id)),
      ...rest,
      projectArchivedAt: iso(projectArchivedAt),
    })),
    sources: { projects: [...byProject.values()], archivedProjects: [...byArchivedProject.values()] },
  };
}

export const calendarRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Zadania z terminem w podanym zakresie dat (włącznie), z projektem i listą, do których należą. Zadania zarchiwizowanych
   * projektów też są zwracane (z `projectArchivedAt`) — klient domyślnie je ukrywa, a użytkownik włącza je filtrem „Projekty archiwalne”.
   */
  app.get('/calendar', async (req): Promise<CalendarRange> => {
    const { from, to } = calendarQuerySchema.parse(req.query);
    const rows = db
      .select({
        task: tasks,
        projectId: projects.id,
        projectName: projects.name,
        projectColor: projects.color,
        projectArchivedAt: projects.archivedAt,
        checklistName: checklists.name,
        checklistColor: checklists.color,
      })
      .from(tasks)
      .innerJoin(checklists, eq(checklists.id, tasks.checklistId))
      .innerJoin(projects, eq(projects.id, checklists.projectId))
      .where(and(gte(tasks.dueDate, from), lte(tasks.dueDate, to)))
      .orderBy(asc(tasks.dueDate), asc(projects.sortOrder), asc(checklists.sortOrder), asc(tasks.sortOrder))
      .all();
    const usersByTask = loadTaskUsers(rows.map((r) => r.task.id));
    return {
      from,
      to,
      tasks: rows.map(({ task, projectArchivedAt, ...rest }) => ({
        ...toTask(task, usersByTask.get(task.id)),
        ...rest,
        projectArchivedAt: iso(projectArchivedAt),
      })),
    };
  });

  /** Niewykonane zadania po terminie (od najstarszych) oraz projekty i listy, w których są (opcje filtrów). */
  app.get('/overdue', async (req): Promise<OverdueTasks> => {
    const { before } = overdueQuerySchema.parse(req.query);
    const list = loadTaskList(
      and(lt(tasks.dueDate, before), eq(tasks.completed, false)),
      [asc(tasks.dueDate), asc(projects.sortOrder), asc(checklists.sortOrder), asc(tasks.sortOrder)],
    );
    return { before, ...list };
  });

  /** Niewykonane zadania bez terminu (w kolejności: projekt, lista, pozycja; „Inne” pierwsze) + opcje filtrów. */
  app.get('/undated', async (): Promise<UndatedTasks> =>
    loadTaskList(
      and(isNull(tasks.dueDate), eq(tasks.completed, false)),
      [desc(projects.isSystem), asc(projects.sortOrder), asc(checklists.sortOrder), asc(tasks.sortOrder)],
    ),
  );

  /**
   * Archiwum zadań: wykonane zadania oraz WSZYSTKIE zadania zarchiwizowanych projektów. Od najnowszych wpisów — dla zadań
   * zarchiwizowanego projektu liczy się moment archiwizacji projektu, dla pozostałych czas wykonania (`updated_at`).
   */
  app.get('/archive', async (): Promise<ArchivedTasks> =>
    loadTaskList(
      or(eq(tasks.completed, true), isNotNull(projects.archivedAt)),
      [
        desc(sql`coalesce(${projects.archivedAt}, ${tasks.updatedAt})`),
        desc(projects.isSystem),
        asc(projects.sortOrder),
        asc(checklists.sortOrder),
        asc(tasks.sortOrder),
      ],
      { includeArchivedProjects: true },
    ),
  );

  /** Projekty i listy, w których jest przynajmniej jedno zadanie z terminem — opcje filtrów kalendarza (aktywne i archiwalne osobno). */
  app.get('/calendar/sources', async (): Promise<CalendarSources> => {
    const rows = db
      .selectDistinct({
        projectId: projects.id,
        projectName: projects.name,
        projectColor: projects.color,
        projectSort: projects.sortOrder,
        projectArchivedAt: projects.archivedAt,
        listId: checklists.id,
        listName: checklists.name,
        listColor: checklists.color,
        listSort: checklists.sortOrder,
      })
      .from(tasks)
      .innerJoin(checklists, eq(checklists.id, tasks.checklistId))
      .innerJoin(projects, eq(projects.id, checklists.projectId))
      .where(isNotNull(tasks.dueDate))
      .orderBy(asc(projects.sortOrder), asc(checklists.sortOrder))
      .all();

    const active = new Map<string, CalendarSourceProject>();
    const archived = new Map<string, CalendarSourceProject>();
    for (const r of rows) {
      const target = r.projectArchivedAt ? archived : active;
      let project = target.get(r.projectId);
      if (!project) {
        project = { id: r.projectId, name: r.projectName, color: r.projectColor, lists: [] };
        target.set(r.projectId, project);
      }
      project.lists.push({ id: r.listId, name: r.listName, color: r.listColor });
    }
    return { projects: [...active.values()], archivedProjects: [...archived.values()] };
  });
};
