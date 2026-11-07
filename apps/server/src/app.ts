import Fastify from 'fastify';
import type { Database } from './platform/database.js';
import { DomainError } from '../../../packages/contracts/src/index.js';
import { createAuth, type Auth } from './identity/auth.js';

export async function createApp(options: { db: Database; auth?: Auth }) {
  const app = Fastify({ bodyLimit: 4 * 1024 * 1024, logger: false });
  const auth = options.auth ?? createAuth(options.db);
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      const status = { INVALID: 400, NOT_FOUND: 404, FORBIDDEN: 403, CONFLICT: 409, UNAUTHENTICATED: 401, LIMIT: 413 }[error.code];
      return reply.status(status).send({ code: error.code, message: error.message });
    }
    app.log.error(error);
    return reply.status(500).send({ code: 'INTERNAL', message: 'The operation could not be completed.' });
  });
  app.get('/api/health', async () => {
    await options.db.query('SELECT 1');
    return { status: 'ok', storage: 'postgresql' };
  });
  app.route({ method: ['GET', 'POST'], url: '/api/auth/*', handler: async (request, reply) => {
    if (request.url.includes('/organization/')) throw new DomainError('FORBIDDEN', 'Use the workspace access endpoints.');
    const origin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173';
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    const response = await auth.handler(new Request(new URL(request.url, origin), {
      method: request.method, headers,
      body: request.method === 'GET' ? undefined : JSON.stringify(request.body ?? {}),
    }));
    for (const [key, value] of response.headers) if (key !== 'set-cookie') reply.header(key, value);
    const cookies = response.headers.getSetCookie(); if (cookies.length) reply.header('set-cookie', cookies);
    return reply.status(response.status).send(await response.text());
  }});
  return app;
}
