import type { FastifyPluginAsync } from 'fastify';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { projectInputSchema, projectPatchSchema, reorderSchema } from '@todo/shared';
import { db } from '../db/client.js';
import { newId } from '../db/ids.js';
import { getProjectDetail, getProjectSummary, listProjects, nextProjectSort } from '../db/queries.js';
import { duplicateProject } from '../db/duplicate.js';
import { reorderProjects } from '../db/reorder.js';
import { projects } from '../db/schema.js';
import { isSystemProject } from '../db/system.js';
import { HttpError, notFound } from '../errors.js';
import { emit } from '../realtime.js';

type IdParams = { Params: { id: string } };

export const projectRoutes: FastifyPluginAsync = async (app) => {
  app.get('/projects', async () => listProjects());

  app.post('/projects', async (req, reply) => {
    const input = projectInputSchema.parse(req.body);
    const id = newId();
    db.insert(projects).values({ id, ...input, sortOrder: nextProjectSort() }).run();
    const project = getProjectSummary(id)!;
    emit(req, { type: 'project.created', id, data: project });
    return reply.code(201).send(project);
  });

  app.patch('/projects/reorder', async (req, reply) => {
    const { ids } = reorderSchema.parse(req.body);
    if (ids.some(isSystemProject)) throw new HttpError(400, "Projektu „Inne” nie można przesuwać - zawsze jest pierwszy");
    reorderProjects(ids);
    emit(req, { type: 'project.reordered', ids });
    return reply.code(204).send();
  });

  app.get<IdParams>('/projects/:id', async (req) => {
    const project = getProjectDetail(req.params.id);
    if (!project) throw notFound('Projekt');
    return project;
  });

  app.post<IdParams>('/projects/:id/duplicate', async (req, reply) => {
    const id = duplicateProject(req.params.id);
    if (!id) throw notFound('Projekt');
    const project = getProjectSummary(id)!;
    emit(req, { type: 'project.created', id, data: project });
    return reply.code(201).send(project);
  });

  app.patch<IdParams>('/projects/:id', async (req) => {
    const patch = projectPatchSchema.parse(req.body);
    // nazwa i kolor stałego projektu są niezmienne (tylko opis można edytować)
    if (isSystemProject(req.params.id)) {
      delete patch.name;
      delete patch.color;
    }
    const { changes } = db
      .update(projects)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(projects.id, req.params.id))
      .run();
    if (!changes) throw notFound('Projekt');
    const project = getProjectSummary(req.params.id)!;
    emit(req, { type: 'project.updated', id: project.id, data: project });
    return project;
  });

  /**
   * Archiwizacja projektu: ustawia `archived_at`. Zadania projektu trafiają wtedy do archiwum zadań i znikają z kalendarza,
   * zaległych oraz „Bez terminu” (nic nie jest kopiowane ani kasowane). Stały projekt „Inne” nie podlega archiwizacji.
   */
  app.post<IdParams>('/projects/:id/archive', async (req) => {
    if (isSystemProject(req.params.id)) throw new HttpError(403, 'Projektu „Inne” nie można zarchiwizować');
    const { changes } = db
      .update(projects)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(projects.id, req.params.id), isNull(projects.archivedAt)))
      .run();
    const project = getProjectSummary(req.params.id);
    if (!project) throw notFound('Projekt');
    if (changes) emit(req, { type: 'project.updated', id: project.id, data: project });
    return project; // idempotentnie: ponowna archiwizacja zwraca stan bez zmian
  });

  /** Przywrócenie projektu z archiwum — wraca cały projekt razem z zadaniami (kalendarz, zaległe i „Bez terminu” znów je widzą). */
  app.post<IdParams>('/projects/:id/restore', async (req) => {
    const { changes } = db
      .update(projects)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(and(eq(projects.id, req.params.id), isNotNull(projects.archivedAt)))
      .run();
    const project = getProjectSummary(req.params.id);
    if (!project) throw notFound('Projekt');
    if (changes) emit(req, { type: 'project.updated', id: project.id, data: project });
    return project;
  });

  app.delete<IdParams>('/projects/:id', async (req, reply) => {
    if (isSystemProject(req.params.id)) throw new HttpError(403, "Projektu „Inne” nie można usunąć");
    const { changes } = db.delete(projects).where(eq(projects.id, req.params.id)).run();
    if (!changes) throw notFound('Projekt');
    emit(req, { type: 'project.deleted', id: req.params.id });
    return reply.code(204).send();
  });
};
