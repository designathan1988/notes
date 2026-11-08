import Fastify from 'fastify';
import type { Database } from './platform/database.js';
import { DomainError } from '../../../packages/contracts/src/index.js';
import { createAuth, type Auth } from './identity/auth.js';
import { appearanceRoutes } from './identity/appearance.js';
import { WebPreviews } from './web/service.js';
import { webRoutes } from './web/routes.js';
import { Access } from './access/service.js';
import { Pages } from './pages/service.js';
import { accessRoutes } from './access/routes.js';
import { pageRoutes } from './pages/routes.js';
import { requestHeaders } from './platform/http.js';
import { collaborationRoutes } from './documents/collaboration.js';
import { attachmentRoutes } from './attachments/routes.js';
import { databaseRoutes } from './databases/routes.js';
import { knowledgeRoutes } from './knowledge/routes.js';
import { storageFromEnvironment, type Storage } from './attachments/storage.js';
import { templateRoutes } from './templates/routes.js';
import { transferRoutes } from './transfer/routes.js';
import { invitationRoutes } from './access/invitation-routes.js';
import { workspaceEvents } from './access/events.js';
import { discussionRoutes } from './discussion/routes.js';
import { historyRoutes } from './history/routes.js';

export async function createApp(options: {
  db: Database;
  auth?: Auth;
  storage?: Storage;
  previews?: WebPreviews;
}) {
  const app = Fastify({ bodyLimit: 4 * 1024 * 1024, logger: false });
  const auth = options.auth ?? createAuth(options.db);
  const access = new Access(options.db);
  const pages = new Pages(options.db, access);
  app.decorateRequest('actor');
  app.addHook('preHandler', async (request) => {
    if (
      request.url === '/api/health' ||
      request.url.startsWith('/api/auth/') ||
      !request.url.startsWith('/api/')
    )
      return;
    const session = await auth.api.getSession({ headers: requestHeaders(request) });
    if (!session) throw new DomainError('UNAUTHENTICATED', 'Sign in to open your workspace.');
    request.actor = { userId: session.user.id };
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173';
      if (
        request.headers['x-note-request'] !== '1' ||
        (request.headers.origin && request.headers.origin !== origin)
      )
        throw new DomainError('FORBIDDEN', 'This request origin is not allowed.');
    }
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      const status = {
        INVALID: 400,
        NOT_FOUND: 404,
        FORBIDDEN: 403,
        CONFLICT: 409,
        UNAUTHENTICATED: 401,
        LIMIT: 413,
      }[error.code];
      return reply.status(status).send({ code: error.code, message: error.message });
    }
    app.log.error(error);
    return reply
      .status(500)
      .send({ code: 'INTERNAL', message: 'The operation could not be completed.' });
  });
  app.get('/api/health', async () => {
    await options.db.query('SELECT 1');
    return { status: 'ok', storage: 'postgresql' };
  });
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: async (request, reply) => {
      if (request.url.includes('/organization/'))
        throw new DomainError('FORBIDDEN', 'Use the workspace access endpoints.');
      const origin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173';
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers))
        if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      const response = await auth.handler(
        new Request(new URL(request.url, origin), {
          method: request.method,
          headers,
          body: request.method === 'GET' ? undefined : JSON.stringify(request.body ?? {}),
        }),
      );
      for (const [key, value] of response.headers)
        if (key !== 'set-cookie') reply.header(key, value);
      const cookies = response.headers.getSetCookie();
      if (cookies.length) reply.header('set-cookie', cookies);
      return reply.status(response.status).send(await response.text());
    },
  });
  accessRoutes(app, access, auth);
  appearanceRoutes(app, options.db);
  pageRoutes(app, pages);
  const collaboration = await collaborationRoutes(app, options.db, auth, access);
  discussionRoutes(app, options.db);
  historyRoutes(app, options.db, collaboration.publish);
  const storage = options.storage ?? storageFromEnvironment();
  webRoutes(app, options.previews ?? new WebPreviews(options.db, storage));
  templateRoutes(app, options.db, storage);
  attachmentRoutes(app, options.db, storage);
  databaseRoutes(app, options.db);
  await knowledgeRoutes(app, options.db);
  transferRoutes(app, options.db, storage);
  invitationRoutes(app, options.db);
  workspaceEvents(app, access);
  pages.onChanged = (workspace, pageId) => {
    void collaboration.invalidate(workspace, pageId);
  };
  return app;
}
