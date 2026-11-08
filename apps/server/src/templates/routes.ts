import type { FastifyInstance } from 'fastify';
import type { Database } from '../platform/database.js';
import type { Storage } from '../attachments/storage.js';
import {
  assertObject,
  DomainError,
  type PageUpdate,
} from '../../../../packages/contracts/src/index.js';
import { Pages } from '../pages/service.js';
import { PageInstances } from '../pages/instantiation.js';
import { Access } from '../access/service.js';
import { toVisiblePage, type VisiblePageRow } from '../pages/model.js';
import { inspectDefaults } from './defaults.js';
import { TemplateClone } from './clone.js';
import { Documents } from '../documents/service.js';
import { assertSourceReady } from './metadata.js';
import * as Y from 'yjs';

export function templateRoutes(app: FastifyInstance, db: Database, storage: Storage) {
  app.get<{ Params: { id: string } }>('/api/pages/:id/copy-context', async (request) => {
    const initial = await new Pages(db).get(request.actor, request.params.id);
    return db.transaction(async (tx) => {
      await new Access(tx).guardWorkspace(initial.workspaceId);
      const page = await new Pages(tx).get(request.actor, initial.id);
      await assertSourceReady(tx, page.id);
      const rows = await tx.query<{ id: string; generation: number; title: string }>(
        `WITH RECURSIVE branch AS (SELECT id,generation,title,0 AS depth FROM pages WHERE id=$1 AND deleted_at IS NULL UNION ALL SELECT p.id,p.generation,p.title,b.depth+1 FROM pages p JOIN branch b ON p.parent_id=b.id WHERE p.deleted_at IS NULL AND b.depth<200) SELECT id,generation,title FROM branch LIMIT 201`,
        [page.id],
      );
      if (rows.length > 200)
        throw new DomainError('LIMIT', 'A template can contain up to 200 owned pages.');
      return { userId: request.actor.userId, workspaceId: page.workspaceId, pages: rows };
    });
  });
  app.post<{ Params: { workspace: string } }>('/api/workspaces/:workspace/templates', (request) => {
    assertObject(request.body);
    return new TemplateClone(db, storage).blank(request.actor, request.params.workspace, {
      requestId: request.body.requestId,
      expectedUserId: request.body.expectedUserId,
      title: request.body.title,
      visibility: request.body.visibility,
    });
  });
  app.get<{ Params: { id: string } }>('/api/templates/:id/preview', async (request) => {
    const initial = await new Pages(db).get(request.actor, request.params.id);
    return db.transaction(async (tx) => {
      await new Access(tx).guardWorkspace(initial.workspaceId);
      const page = await new Pages(tx).get(request.actor, initial.id);
      if (page.templateRootId !== page.id)
        throw new DomainError('INVALID', 'Choose a template root.');
      await assertSourceReady(tx, page.id);
      const doc = await new Documents(tx).load(page.id);
      try {
        return {
          pageId: page.id,
          state: Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64'),
        };
      } finally {
        doc.destroy();
      }
    });
  });
  const location = async (id: string) => {
    const [row] = await db.query<{ workspace_id: string }>(
      'SELECT workspace_id FROM pages WHERE id=$1',
      [id],
    );
    if (!row) throw new DomainError('FORBIDDEN', 'This source is unavailable.');
    return row.workspace_id;
  };
  app.get<{
    Params: { workspace: string };
    Querystring: { q?: string; database?: string; kind?: string; after?: string; id?: string };
  }>('/api/workspaces/:workspace/templates', async (request) => {
    const { workspace } = request.params,
      { q = '', database = '', kind = '', after, id = '' } = request.query;
    const scope = await new Access(db).scope(request.actor, workspace);
    if (after && (!Number.isFinite(Date.parse(after)) || !id || id.length > 128))
      throw new DomainError('INVALID', 'Invalid template cursor.');
    const rows = await db.query<VisiblePageRow>(
      `${scope.sql} SELECT p.* FROM visible p LEFT JOIN search_projection s ON s.page_id=p.id
      WHERE p.template_root_id=p.id AND ($3='' OR p.title ILIKE $4 OR p.description ILIKE $4 OR s.tokens @@ websearch_to_tsquery('simple',$3))
      AND ($5='' OR p.template_database_id=$5) AND ($6='' OR ($6='record' AND p.template_database_id IS NOT NULL) OR ($6='document' AND p.template_database_id IS NULL))
      AND ($7::timestamptz IS NULL OR (p.updated_at,p.id)<($7::timestamptz,$8))
      AND NOT EXISTS(SELECT 1 FROM transfer_jobs j CROSS JOIN LATERAL jsonb_each_text(j.mapping->'pages') m WHERE j.stage<>'complete' AND m.value=p.id)
      ORDER BY p.updated_at DESC,p.id DESC LIMIT 51`,
      [...scope.params, q.slice(0, 200), `%${q.slice(0, 200)}%`, database, kind, after ?? null, id],
    );
    const items = rows.slice(0, 50).map(toVisiblePage),
      last = items.at(-1),
      ids = items.flatMap((page) => (page.templateDatabaseId ? [page.templateDatabaseId] : []));
    const databases = await db.query<VisiblePageRow>(
      `${scope.sql} SELECT * FROM visible WHERE id=ANY($3::text[])`,
      [...scope.params, ids],
    );
    return {
      items,
      databases: databases.map(toVisiblePage),
      nextCursor: rows.length > 50 && last ? { after: last.updatedAt, id: last.id } : null,
    };
  });
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
