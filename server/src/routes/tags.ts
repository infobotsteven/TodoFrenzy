import type { FastifyPluginAsync } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { tagInputSchema } from '@todo/shared';
import { db } from '../db/client.js';
import { newId } from '../db/ids.js';
import { listTags } from '../db/queries.js';
import { tags } from '../db/schema.js';
import { HttpError, notFound } from '../errors.js';
import { emit } from '../realtime.js';

type IdParams = { Params: { id: string } };

export const tagRoutes: FastifyPluginAsync = async (app) => {
  app.get('/tags', async () => listTags());

  // Tag o istniejącej nazwie (bez względu na wielkość liter) nie jest dublowany - zwracamy istniejący
  app.post('/tags', async (req, reply) => {
    const { name } = tagInputSchema.parse(req.body);
    const existing = db.select().from(tags).where(sql`lower(${tags.name}) = lower(${name})`).get();
    if (existing) return existing;
    const tag = { id: newId(), name };
    db.insert(tags).values(tag).run();
    emit(req, { type: 'tag.updated', id: tag.id, data: tag });
    return reply.code(201).send(tag);
  });

  app.patch<IdParams>('/tags/:id', async (req) => {
    const { id } = req.params;
    const { name } = tagInputSchema.parse(req.body);
    if (!db.select({ id: tags.id }).from(tags).where(eq(tags.id, id)).get()) throw notFound('Tag');
    const clash = db.select({ id: tags.id }).from(tags).where(sql`lower(${tags.name}) = lower(${name}) and ${tags.id} <> ${id}`).get();
    if (clash) throw new HttpError(409, 'Tag o takiej nazwie już istnieje');
    db.update(tags).set({ name }).where(eq(tags.id, id)).run();
    const tag = { id, name };
    emit(req, { type: 'tag.updated', id, data: tag });
    return tag;
  });

  // Usunięcie tagu zdejmuje go ze wszystkich list (kaskada na checklist_tags)
  app.delete<IdParams>('/tags/:id', async (req, reply) => {
    const { changes } = db.delete(tags).where(eq(tags.id, req.params.id)).run();
    if (!changes) throw notFound('Tag');
    emit(req, { type: 'tag.deleted', id: req.params.id });
    return reply.code(204).send();
  });
};

