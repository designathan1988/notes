import type { FastifyInstance } from 'fastify';
import type { Database } from '../platform/database.js';
import type { Storage } from '../attachments/storage.js';
import { assertObject, type PageUpdate } from '@note/contracts';
import { Pages } from '../pages/service.js';
import { PageInstances } from '../pages/instantiation.js';
import { inspectDefaults } from './defaults.js';
import { TemplateClone } from './clone.js';
import { Templates } from './service.js';

export function templateRoutes(app: FastifyInstance, db: Database, storage: Storage) {
  const templates = new Templates(db);
  app.get<{ Params: { id: string } }>('/api/pages/:id/copy-context', (request) =>
    templates.copyContext(request.actor, request.params.id),
  );
  app.post<{ Params: { workspace: string } }>('/api/workspaces/:workspace/templates', (request) => {
    assertObject(request.body);
    return new TemplateClone(db, storage).blank(request.actor, request.params.workspace, {
      requestId: request.body.requestId,
      expectedUserId: request.body.expectedUserId,
      title: request.body.title,
      visibility: request.body.visibility,
    });
  });
  app.get<{ Params: { id: string } }>('/api/templates/:id/preview', (request) =>
    templates.preview(request.actor, request.params.id),
  );
  const location = (id: string) => templates.sourceWorkspace(id);
  app.get<{
    Params: { workspace: string };
    Querystring: { q?: string; database?: string; kind?: string; after?: string; id?: string };
  }>('/api/workspaces/:workspace/templates', (request) =>
    templates.list(request.actor, request.params.workspace, request.query),
  );
  app.post<{ Params: { id: string } }>('/api/pages/:id/templates', async (request) => {
    assertObject(request.body);
    return new PageInstances(db).copyFrom(
      request.actor,
      await location(request.params.id),
      request.params.id,
      {
        ...request.body,
        mode: 'template',
        requestId: request.body.requestId,
        expectedUserId: request.body.expectedUserId,
      },
      storage,
    );
  });
  app.post<{ Params: { id: string } }>('/api/templates/:id/instances', async (request) => {
    assertObject(request.body);
    return new PageInstances(db).copyFrom(
      request.actor,
      await location(request.params.id),
      request.params.id,
      {
        ...request.body,
        mode: 'instance',
        requestId: request.body.requestId,
        expectedUserId: request.body.expectedUserId,
      },
      storage,
    );
  });
  app.post<{ Params: { id: string } }>('/api/pages/:id/duplicate', async (request) => {
    assertObject(request.body);
    return new PageInstances(db).copyFrom(
      request.actor,
      await location(request.params.id),
      request.params.id,
      {
        ...request.body,
        mode: 'duplicate',
        requestId: request.body.requestId,
        expectedUserId: request.body.expectedUserId,
      },
      storage,
    );
  });
  app.get<{ Params: { id: string } }>('/api/templates/:id/defaults', async (request) =>
    inspectDefaults(db, request.actor, await new Pages(db).get(request.actor, request.params.id)),
  );
  app.patch<{ Params: { id: string } }>('/api/templates/:id/defaults', async (request) => {
    assertObject(request.body);
    return new Pages(db).update(request.actor, request.params.id, {
      revision: Number(request.body.revision),
      templateDefaults: {
        fieldsRevision: Number(request.body.fieldsRevision),
        property: request.body.property as PageUpdate['property'],
        resetInvalid: request.body.resetInvalid as boolean | undefined,
      },
    });
  });
}
