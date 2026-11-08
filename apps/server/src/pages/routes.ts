import type { FastifyInstance } from 'fastify';
import { PageInstances } from './instantiation.js';
import { assertObject, DomainError, type PageUpdate } from '../../../../packages/contracts/src/index.js';
import type { Pages } from './service.js';
import { Navigation } from './navigation.js';
export function pageRoutes(app: FastifyInstance, pages: Pages) {
  const navigation = new Navigation(pages.db);
  app.get<{ Params: { workspace: string }; Querystring: { selected?: string } }>(
    '/api/workspaces/:workspace/navigation',
    (request) =>
      navigation.bootstrap(request.actor, request.params.workspace, request.query.selected),
  );
  app.post<{ Params: { workspace: string } }>(
    '/api/workspaces/:workspace/navigation',
    (request) => {
      assertObject(request.body);
      if (
        !Array.isArray(request.body.loaded) ||
        request.body.loaded.length > 5000 ||
        request.body.loaded.some((id) => typeof id !== 'string') ||
        (request.body.expanded !== undefined &&
          (!Array.isArray(request.body.expanded) ||
            request.body.expanded.length > 5000 ||
            request.body.expanded.some((id) => typeof id !== 'string')))
      )
        throw new DomainError('INVALID', 'Invalid navigation window.');
      return navigation.refresh(
        request.actor,
        request.params.workspace,
        request.body.loaded,
        String(request.body.selected ?? '') || null,
        (request.body.expanded ?? []) as string[],
      );
    },
  );
  app.get<{
    Params: { workspace: string };
    Querystring: { parent?: string; after?: string; id?: string };
  }>('/api/workspaces/:workspace/children', (request) => {
    const { after, id, parent } = request.query;
    const cursor = after === undefined ? null : { position: Number(after), id: id ?? '' };
    if (cursor && (!Number.isSafeInteger(cursor.position) || !cursor.id || cursor.id.length > 128))
      throw new DomainError('INVALID', 'Invalid page cursor.');
    return navigation.children(request.actor, request.params.workspace, parent || null, cursor);
  });
  app.get<{
    Params: { workspace: string };
    Querystring: { offset?: string; kind?: string; q?: string };
  }>('/api/workspaces/:workspace/page-list', (request) =>
    navigation.flat(
      request.actor,
      request.params.workspace,
      Number(request.query.offset) || 0,
      ['document', 'database', 'record'].includes(request.query.kind ?? '')
        ? request.query.kind!
        : '',
      request.query.q ?? '',
    ),
  );
  app.get<{ Params: { workspace: string } }>(
    '/api/workspaces/:workspace/favorites',
    async (request) => {
      const visible = await pages.list(request.actor, request.params.workspace);
      const rows = await pages.db.query<{ page_id: string }>(
        'SELECT page_id FROM favorites WHERE user_id=$1',
        [request.actor.userId],
      );
      const ids = new Set(visible.map((page) => page.id));
      return rows.map((row) => row.page_id).filter((id) => ids.has(id));
    },
  );
  app.put<{ Params: { id: string } }>('/api/pages/:id/favorite', async (request) => {
    await pages.get(request.actor, request.params.id);
    assertObject(request.body);
    if (request.body.favorite === true)
      await pages.db.query(
        'INSERT INTO favorites (user_id,page_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [request.actor.userId, request.params.id],
      );
    else
      await pages.db.query('DELETE FROM favorites WHERE user_id=$1 AND page_id=$2', [
        request.actor.userId,
        request.params.id,
      ]);
    return { ok: true };
  });
  app.get<{ Params: { workspace: string }; Querystring: { trash?: string } }>(
    '/api/workspaces/:workspace/pages',
    (request) =>
      pages.list(request.actor, request.params.workspace, request.query.trash === 'true'),
  );
  app.post<{ Params: { workspace: string } }>(
    '/api/workspaces/:workspace/pages',
    async (request) => {
      assertObject(request.body);
      if ('content' in request.body || 'purpose' in request.body)
        return new PageInstances(pages.db).create(request.actor, request.params.workspace, {
          title: request.body.title,
          content: request.body.content,
          requestId: request.body.requestId,
          purpose: request.body.purpose,
          description: request.body.description,
          parentId: request.body.parentId,
          visibility: request.body.visibility,
          kind: request.body.kind,
          expectedUserId: request.body.expectedUserId,
        });
      if (request.body.kind && !['document', 'database'].includes(String(request.body.kind)))
        throw new DomainError('INVALID', 'Use the database record command for records.');
      return pages.create(request.actor, request.params.workspace, {
        title: String(request.body.title ?? 'Untitled'),
        parentId: request.body.parentId as string | undefined,
        kind: request.body.kind as 'document' | 'database',
        visibility: request.body.visibility as 'workspace' | 'private',
      });
    },
  );
  app.get<{ Params: { id: string } }>('/api/pages/:id', (request) =>
    pages.get(request.actor, request.params.id),
  );
  app.patch<{ Params: { id: string } }>('/api/pages/:id', (request) => {
    assertObject(request.body);
    return pages.update(request.actor, request.params.id, {
      title: request.body.title as string | undefined,
      description: request.body.description as string | undefined,
      icon: request.body.icon as PageUpdate['icon'],
      cover: request.body.cover as PageUpdate['cover'],
      tags: request.body.tags as PageUpdate['tags'],
      revision: Number(request.body.revision),
    });
  });
  app.post<{ Params: { id: string } }>('/api/pages/:id/move', (request) => {
    assertObject(request.body);
    if (request.body.parentId !== null && typeof request.body.parentId !== 'string')
      throw new DomainError('INVALID', 'Choose a destination.');
    if (request.body.beforeId != null && typeof request.body.beforeId !== 'string')
      throw new DomainError('INVALID', 'Choose a valid sibling.');
    return pages.move(
      request.actor,
      request.params.id,
      request.body.parentId,
      Number(request.body.revision),
      request.body.confirmed === true,
      request.body.beforeId as string | null | undefined,
    );
  });
  app.delete<{ Params: { id: string } }>('/api/pages/:id', async (request) => {
    await pages.trash(request.actor, request.params.id);
    return { ok: true };
  });
  app.post<{ Params: { id: string } }>('/api/pages/:id/restore', async (request) => {
    await pages.restore(request.actor, request.params.id);
    return { ok: true };
  });
}
