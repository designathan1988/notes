import type { FastifyInstance } from 'fastify';
import { assertObject, DomainError } from '../../../../packages/contracts/src/index.js';
import type { Pages } from './service.js';
export function pageRoutes(app: FastifyInstance, pages: Pages) {
  app.get<{ Params: { workspace: string }; Querystring: { trash?: string } }>('/api/workspaces/:workspace/pages', request => pages.list(request.actor, request.params.workspace, request.query.trash === 'true'));
  app.post<{ Params: { workspace: string } }>('/api/workspaces/:workspace/pages', async request => {
    assertObject(request.body);
    return pages.create(request.actor, request.params.workspace, { title: String(request.body.title ?? 'Untitled'), parentId: request.body.parentId as string | undefined, kind: request.body.kind as 'document' | 'database', visibility: request.body.visibility as 'workspace' | 'private' });
  });
  app.get<{ Params: { id: string } }>('/api/pages/:id', request => pages.get(request.actor,request.params.id));
  app.patch<{ Params: { id: string } }>('/api/pages/:id', request => {
    assertObject(request.body);
    return pages.update(request.actor,request.params.id,{ title: request.body.title as string | undefined, description: request.body.description as string | undefined, revision: Number(request.body.revision) });
  });
  app.post<{ Params: { id: string } }>('/api/pages/:id/move', request => {
    assertObject(request.body);
    if (request.body.parentId !== null && typeof request.body.parentId !== 'string') throw new DomainError('INVALID','Choose a destination.');
    return pages.move(request.actor,request.params.id,request.body.parentId,Number(request.body.revision),request.body.confirmed === true);
  });
  app.delete<{ Params: { id: string } }>('/api/pages/:id', async request => { await pages.trash(request.actor,request.params.id); return { ok: true }; });
  app.post<{ Params: { id: string } }>('/api/pages/:id/restore', async request => { await pages.restore(request.actor,request.params.id); return { ok: true }; });
}
