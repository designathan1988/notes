import type { FastifyInstance } from 'fastify';
import type { Database } from '../platform/database.js';
import { assertObject } from '../../../../packages/contracts/src/index.js';
import { pageOffset } from '../platform/pagination.js';
import { History } from './service.js';
import type { DurableAcknowledgement } from '../documents/service.js';
export function historyRoutes(
  app: FastifyInstance,
  db: Database,
  publish: (ack: DurableAcknowledgement) => Promise<void>,
) {
  const history = new History(db);
  app.get<{ Params: { id: string }; Querystring: { offset?: string } }>(
    '/api/pages/:id/history',
    (request) => history.list(request.actor, request.params.id, pageOffset(request.query.offset)),
  );
  app.post<{ Params: { id: string } }>('/api/pages/:id/history', (request) => {
    assertObject(request.body);
    return history.save(request.actor, request.params.id, request.body.label);
  });
  app.get<{ Params: { id: string; checkpoint: string } }>(
    '/api/pages/:id/history/:checkpoint',
    (request) => history.preview(request.actor, request.params.id, request.params.checkpoint),
  );
  app.post<{ Params: { id: string; checkpoint: string } }>(
    '/api/pages/:id/history/:checkpoint/restore',
    async (request) => {
      assertObject(request.body);
      const ack = await history.restore(
        request.actor,
        request.params.id,
        request.params.checkpoint,
        request.body.version,
      );
      await publish(ack);
      return { version: ack.version };
    },
  );
}
