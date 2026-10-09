import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { tr } from './i18n.js';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} nie istnieje`);

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError | HttpError | ZodError, req, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: tr(req.headers, 'Nieprawidłowe dane'),
        issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: tr(req.headers, error.message) });
    }
    // Błędy Fastify z kodem 4xx (np. zepsuty JSON) oddajemy klientowi, resztę ukrywamy jako 500
    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    req.log.error(error);
    return reply.code(500).send({ error: tr(req.headers, 'Błąd serwera') });
  });
}
