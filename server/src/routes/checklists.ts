import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { checklistInputSchema, checklistPatchSchema, reorderSchema } from '@todo/shared';
import { db } from '../db/client.js';
import { newId } from '../db/ids.js';
import {
  getChecklist,
  missingTagIds,
  nextChecklistSort,
  projectIdOfChecklist,
  setChecklistTags,
  touchProject,
} from '../db/queries.js';
import { duplicateChecklist } from '../db/duplicate.js';
import { reorderChecklists } from '../db/reorder.js';
import { checklists, projects } from '../db/schema.js';
import { isSystemProject } from '../db/system.js';
import { HttpError, notFound } from '../errors.js';

const SYSTEM_LIST_ERROR = 'Projekt „Inne” ma tylko jedną listę - nie można jej dodać, skopiować ani usunąć';
import { emit } from '../realtime.js';

function assertTagsExist(tagIds: string[]) {
  if (missingTagIds(tagIds).length) throw new HttpError(400, 'Nieznany tag');
}

export const checklistRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { projectId: string } }>('/projects/:projectId/checklists', async (req, reply) => {
    const { projectId } = req.params;
    const { tagIds, ...input } = checklistInputSchema.parse(req.body);
    if (!db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).get()) {
      throw notFound('Projekt');
    }
    if (isSystemProject(projectId)) throw new HttpError(403, SYSTEM_LIST_ERROR);
    assertTagsExist(tagIds);

    const id = newId();
    db.transaction((tx) => {
      tx.insert(checklists).values({ id, projectId, ...input, sortOrder: nextChecklistSort(projectId) }).run();
      setChecklistTags(tx, id, tagIds);
    });
    touchProject(projectId);
    const checklist = getChecklist(id)!;
    emit(req, { type: 'checklist.created', id, projectId, data: checklist });
    return reply.code(201).send(checklist);
  });

  app.patch('/checklists/reorder', async (req, reply) => {
    const { ids } = reorderSchema.parse(req.body);
    const projectId = reorderChecklists(ids);
    touchProject(projectId);
    emit(req, { type: 'checklist.reordered', projectId, ids });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/checklists/:id/duplicate', async (req, reply) => {
    const owner = projectIdOfChecklist(req.params.id);
    if (owner && isSystemProject(owner)) throw new HttpError(403, SYSTEM_LIST_ERROR);
    const id = duplicateChecklist(req.params.id);
    if (!id) throw notFound('Lista');
    const checklist = getChecklist(id)!;
    touchProject(checklist.projectId);
    emit(req, { type: 'checklist.created', id, projectId: checklist.projectId, data: checklist });
    return reply.code(201).send(checklist);
  });

  app.patch<{ Params: { id: string } }>('/checklists/:id', async (req) => {
    const { id } = req.params;
    const { tagIds, ...patch } = checklistPatchSchema.parse(req.body);
    const current = getChecklist(id);
    if (!current) throw notFound('Lista');
    if (tagIds) assertTagsExist(tagIds);

    db.transaction((tx) => {
      tx.update(checklists).set({ ...patch, updatedAt: new Date() }).where(eq(checklists.id, id)).run();
      if (tagIds) setChecklistTags(tx, id, tagIds);
    });
    touchProject(current.projectId);
    const checklist = getChecklist(id)!;
    emit(req, { type: 'checklist.updated', id, projectId: current.projectId, data: checklist });
    return checklist;
  });

  app.delete<{ Params: { id: string } }>('/checklists/:id', async (req, reply) => {
    const { id } = req.params;
    const projectId = projectIdOfChecklist(id);
    if (!projectId) throw notFound('Lista');
    if (isSystemProject(projectId)) throw new HttpError(403, SYSTEM_LIST_ERROR);
    db.delete(checklists).where(eq(checklists.id, id)).run();
    touchProject(projectId);
    emit(req, { type: 'checklist.deleted', id, projectId });
    return reply.code(204).send();
  });
};


