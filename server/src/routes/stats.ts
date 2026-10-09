import type { FastifyPluginAsync } from 'fastify';
import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { statsQuerySchema, type CompletionStats } from '@todo/shared';
import { db } from '../db/client.js';
import { checklists, projects, tasks } from '../db/schema.js';

export const statsRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Zadania wykonane w zakresie czasu [from, to) (od najwcześniejszego): chwila wykonania, nazwa i kolor projektu. Dni (i strefę
   * czasową) rozstrzyga klient - serwer nie zna strefy użytkownika, a w sieci lokalnej każdy może być w innej. Liczą się też zadania
   * zarchiwizowanych projektów; usunięte zadania znikają ze statystyk razem z danymi.
   */
  app.get('/stats/completions', async (req): Promise<CompletionStats> => {
    const { from, to } = statsQuerySchema.parse(req.query);
    const rows = db
      .select({ id: tasks.id, name: tasks.name, completedAt: tasks.completedAt, projectColor: projects.color })
      .from(tasks)
      .innerJoin(checklists, eq(checklists.id, tasks.checklistId))
      .innerJoin(projects, eq(projects.id, checklists.projectId))
      .where(and(eq(tasks.completed, true), gte(tasks.completedAt, new Date(from)), lt(tasks.completedAt, new Date(to))))
      .orderBy(asc(tasks.completedAt))
      .all();
    return {
      tasks: rows.flatMap((r) => (r.completedAt ? [{ id: r.id, name: r.name, completedAt: r.completedAt.toISOString(), projectColor: r.projectColor }] : [])),
    };
  });
};
