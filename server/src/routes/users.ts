import type { FastifyPluginAsync } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { userInputSchema, userPatchSchema } from '@todo/shared';
import { db } from '../db/client.js';
import { newId } from '../db/ids.js';
import { listUsers } from '../db/queries.js';
import { users } from '../db/schema.js';
import { HttpError, notFound } from '../errors.js';
import { emit } from '../realtime.js';

type IdParams = { Params: { id: string } };

const nickTaken = (nick: string, exceptId?: string) =>
  !!db
    .select({ id: users.id })
    .from(users)
    .where(
      exceptId
        ? sql`lower(${users.nick}) = lower(${nick}) and ${users.id} <> ${exceptId}`
        : sql`lower(${users.nick}) = lower(${nick})`,
    )
    .get();

const publicUser = (u: { id: string; nick: string; avatar: (typeof users.$inferSelect)['avatar'] }) => ({
  id: u.id,
  nick: u.nick,
  avatar: u.avatar,
});

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.get('/users', async () => listUsers());

  app.post('/users', async (req, reply) => {
    const input = userInputSchema.parse(req.body);
    if (nickTaken(input.nick)) throw new HttpError(409, 'Użytkownik o takim nicku już istnieje');
    const user = { id: newId(), ...input };
    db.insert(users).values(user).run();
    emit(req, { type: 'user.updated', id: user.id, data: user });
    return reply.code(201).send(user);
  });

  app.patch<IdParams>('/users/:id', async (req) => {
    const { id } = req.params;
    const patch = userPatchSchema.parse(req.body);
    const current = db.select().from(users).where(eq(users.id, id)).get();
    if (!current) throw notFound('Użytkownik');
    if (patch.nick !== undefined && nickTaken(patch.nick, id)) throw new HttpError(409, 'Użytkownik o takim nicku już istnieje');
    db.update(users).set(patch).where(eq(users.id, id)).run();
    const user = publicUser({ ...current, ...patch });
    emit(req, { type: 'user.updated', id, data: user });
    return user;
  });

  // Usunięcie użytkownika zdejmuje go ze wszystkich zadań (kaskada na task_users)
  app.delete<IdParams>('/users/:id', async (req, reply) => {
    const { changes } = db.delete(users).where(eq(users.id, req.params.id)).run();
    if (!changes) throw notFound('Użytkownik');
    emit(req, { type: 'user.deleted', id: req.params.id });
    return reply.code(204).send();
  });
};
