import type { FastifyPluginAsync } from 'fastify';
import { and, asc, eq, gte, sql } from 'drizzle-orm';
import { reorderSchema, taskBulkSchema, taskCompletedSchema, taskCreateSchema, taskPatchSchema } from '@todo/shared';
import { db } from '../db/client.js';
import { newId } from '../db/ids.js';
import {
  getTask,
  missingUserIds,
  nextTaskSort,
  projectIdOfChecklist,
  projectIdOfTask,
  setTaskUsers,
  touchProject,
} from '../db/queries.js';
import { reorderTasks } from '../db/reorder.js';
import { tasks } from '../db/schema.js';
import { HttpError, notFound } from '../errors.js';
import { emit } from '../realtime.js';

type IdParams = { Params: { id: string } };

function assertUsersExist(userIds: string[]) {
  if (missingUserIds(userIds).length) throw new HttpError(400, 'Nieznany użytkownik');
}

export const taskRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { checklistId: string } }>('/checklists/:checklistId/tasks', async (req, reply) => {
    const { checklistId } = req.params;
    const { position, userIds, ...fields } = taskCreateSchema.parse(req.body);
    const projectId = projectIdOfChecklist(checklistId);
    if (!projectId) throw notFound('Lista');
    assertUsersExist(userIds);

    const id = newId();
    db.transaction((tx) => {
      let sortOrder = nextTaskSort(checklistId);
      if (position !== undefined) {
        // Wstawienie w środek listy: robimy miejsce, przesuwając zadania od tej pozycji w dół
        const atPosition = tx
          .select({ sortOrder: tasks.sortOrder })
          .from(tasks)
          .where(eq(tasks.checklistId, checklistId))
          .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt))
          .limit(1)
          .offset(position)
          .get();
        if (atPosition) {
          sortOrder = atPosition.sortOrder;
          tx.update(tasks)
            .set({ sortOrder: sql`${tasks.sortOrder} + 1` })
            .where(and(eq(tasks.checklistId, checklistId), gte(tasks.sortOrder, sortOrder)))
            .run();
        }
      }
      tx.insert(tasks).values({ id, checklistId, ...fields, completedAt: fields.completed ? new Date() : null, sortOrder }).run();
      setTaskUsers(tx, id, userIds);
    });
    touchProject(projectId);
    const task = getTask(id)!;
    emit(req, { type: 'task.created', id, projectId, data: task });
    return reply.code(201).send(task);
  });

  app.post<{ Params: { checklistId: string } }>('/checklists/:checklistId/tasks/bulk', async (req, reply) => {
    const { checklistId } = req.params;
    const { items } = taskBulkSchema.parse(req.body);
    const projectId = projectIdOfChecklist(checklistId);
    if (!projectId) throw notFound('Lista');

    const ids = db.transaction((tx) => {
      const first = nextTaskSort(checklistId);
      return items.map((item, i) => {
        const id = newId();
        tx.insert(tasks)
          .values({ id, checklistId, name: item.name, completed: item.completed, completedAt: item.completed ? new Date() : null, sortOrder: first + i })
          .run();
        return id;
      });
    });
    touchProject(projectId);
    const created = ids.map((id) => getTask(id)!);
    for (const task of created) emit(req, { type: 'task.created', id: task.id, projectId, data: task });
    return reply.code(201).send(created);
  });

  app.patch('/tasks/reorder', async (req, reply) => {
    const { ids } = reorderSchema.parse(req.body);
    const projectId = reorderTasks(ids);
    touchProject(projectId);
    emit(req, { type: 'task.reordered', projectId, ids });
    return reply.code(204).send();
  });

  app.patch<IdParams>('/tasks/:id', async (req) => {
    const { id } = req.params;
    const { userIds, ...fields } = taskPatchSchema.parse(req.body);
    const projectId = projectIdOfTask(id);
    if (!projectId) throw notFound('Zadanie');
    if (userIds) assertUsersExist(userIds);

    db.transaction((tx) => {
      tx.update(tasks).set({ ...fields, updatedAt: new Date() }).where(eq(tasks.id, id)).run();
      if (userIds) setTaskUsers(tx, id, userIds);
    });
    touchProject(projectId);
    const task = getTask(id)!;
    emit(req, { type: 'task.updated', id, projectId, data: task });
    return task;
  });

  app.patch<IdParams>('/tasks/:id/completed', async (req) => {
    const { id } = req.params;
    const { completed } = taskCompletedSchema.parse(req.body);
    const projectId = projectIdOfTask(id);
    if (!projectId) throw notFound('Zadanie');
    // moment wykonania zapisujemy raz (powtórne „wykonane” go nie przesuwa), a odznaczenie go czyści
    const current = db.select({ completed: tasks.completed, completedAt: tasks.completedAt }).from(tasks).where(eq(tasks.id, id)).get();
    const completedAt = !completed ? null : current?.completed && current.completedAt ? current.completedAt : new Date();
    db.update(tasks).set({ completed, completedAt, updatedAt: new Date() }).where(eq(tasks.id, id)).run();
    touchProject(projectId);
    const task = getTask(id)!;
    emit(req, { type: 'task.completed', id, projectId, data: task });
    return task;
  });

  app.delete<IdParams>('/tasks/:id', async (req, reply) => {
    const { id } = req.params;
    const task = getTask(id);
    const projectId = projectIdOfTask(id);
    if (!task || !projectId) throw notFound('Zadanie');
    db.delete(tasks).where(eq(tasks.id, id)).run();
    touchProject(projectId);
    emit(req, { type: 'task.deleted', id, projectId, checklistId: task.checklistId });
    return reply.code(204).send();
  });
};


