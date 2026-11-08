import type { FastifyInstance } from 'fastify';
import type { Database } from '../platform/database.js';
import { assertObject, DomainError } from '../../../../packages/contracts/src/index.js';
import { Discussions } from './service.js';
import { pageOffset } from '../platform/pagination.js';
export function discussionRoutes(app: FastifyInstance, db: Database) {
  const discussions = new Discussions(db);
  app.get<{ Params: { id: string }; Querystring: { resolved?: string; offset?: string } }>(
    '/api/pages/:id/discussions',
    (request) => {
      if (
        request.query.resolved !== undefined &&
        !['true', 'false'].includes(request.query.resolved)
      )
        throw new DomainError('INVALID', 'Use a valid discussion filter.');
      return discussions.list(
        request.actor,
        request.params.id,
        request.query.resolved === 'true',
        pageOffset(request.query.offset),
      );
    },
  );
  app.post<{ Params: { id: string } }>('/api/pages/:id/discussions', (request) => {
    assertObject(request.body);
    return discussions.create(
      request.actor,
      request.params.id,
      request.body.body,
      request.body.quote,
    );
  });
  app.get<{
    Params: { id: string; thread: string };
    Querystring: { offset?: string; before?: string };
  }>('/api/pages/:id/discussions/:thread/messages', (request) =>
    discussions.messages(
      request.actor,
      request.params.id,
      request.params.thread,
      pageOffset(request.query.offset),
      request.query.before,
    ),
  );
  app.post<{ Params: { id: string; thread: string } }>(
    '/api/pages/:id/discussions/:thread/messages',
    (request) => {
      assertObject(request.body);
      return discussions.reply(
        request.actor,
        request.params.id,
        request.params.thread,
        request.body.body,
      );
    },
  );
  app.patch<{ Params: { id: string; thread: string } }>(
    '/api/pages/:id/discussions/:thread',
    (request) => {
      assertObject(request.body);
      return discussions.resolve(
        request.actor,
        request.params.id,
        request.params.thread,
        request.body.resolved,
        request.body.revision,
      );
    },
  );
}
