import Fastify from 'fastify';
import type { Database } from './platform/database.js';
import { DomainError } from '../../../packages/contracts/src/index.js';
import { createAuth, type Auth } from './identity/auth.js';
import { Access } from './access/service.js';
import { Pages } from './pages/service.js';
import { accessRoutes } from './access/routes.js';
import { pageRoutes } from './pages/routes.js';
import { requestHeaders } from './platform/http.js';
import { collaborationRoutes } from './documents/collaboration.js';
import { attachmentRoutes } from './attachments/routes.js';

export async function createApp(options: { db: Database; auth?: Auth }) {
  const app = Fastify({ bodyLimit: 4 * 1024 * 1024, logger: false });
  const auth = options.auth ?? createAuth(options.db);
  const access = new Access(options.db); const pages = new Pages(options.db,access);
  app.decorateRequest('actor');
  app.addHook('preHandler', async request => {
    if (request.url === '/api/health' || request.url.startsWith('/api/auth/') || !request.url.startsWith('/api/')) return;
    const session = await auth.api.getSession({ headers: requestHeaders(request) });
    if (!session) throw new DomainError('UNAUTHENTICATED','Sign in to open your workspace.');
    request.actor = { userId: session.user.id };
    if (!['GET','HEAD','OPTIONS'].includes(request.method)) {
      const origin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173';
      if (request.headers['x-note-request'] !== '1' || (request.headers.origin && request.headers.origin !== origin)) throw new DomainError('FORBIDDEN','This request origin is not allowed.');
    }
  });
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
  accessRoutes(app,access,auth); pageRoutes(app,pages);
  const collaboration=await collaborationRoutes(app,options.db,auth,access);
  attachmentRoutes(app,options.db);
  pages.onChanged=workspace=>{void collaboration.invalidate(workspace);};
  return app;
}
