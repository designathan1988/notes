import type { FastifyInstance } from 'fastify';
import { assertObject } from '../../../../packages/contracts/src/index.js';
import type { WebPreviews } from './service.js';
export function webRoutes(app: FastifyInstance, previews: WebPreviews) {
  app.post<{ Params: { id: string } }>('/api/pages/:id/web-preview', (request) => {
    assertObject(request.body);
    return previews.create(request.actor, request.params.id, {
      position: Number(request.body.position),
      fingerprint: String(request.body.fingerprint ?? ''),
    });
  });
  app.post<{ Params: { token: string } }>('/api/web-previews/:token/renew', (request) =>
    previews.renew(request.actor, request.params.token),
  );
  app.delete<{ Params: { token: string } }>('/api/web-previews/:token', (request) =>
    previews.stop(request.actor, request.params.token),
  );
}
