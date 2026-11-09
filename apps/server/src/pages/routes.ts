import type { FastifyInstance } from 'fastify';
import { PageInstances } from './instantiation.js';
import { assertObject, DomainError, type PageUpdate } from '@note/contracts';
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
    Querystring: {
      offset?: string;
      kind?: string;
      q?: string;
      template?: string;
      sort?: string;
      direction?: string;
    };
  }>('/api/workspaces/:workspace/page-list', (request) =>
    navigation.flat(
      request.actor,
      request.params.workspace,
      Number(request.query.offset) || 0,
      ['document', 'database', 'record', 'canvas'].includes(request.query.kind ?? '')
        ? request.query.kind!
        : '',
      request.query.q ?? '',
      typeof request.query.template === 'string' && /^[\w-]{1,128}$/.test(request.query.template)
        ? request.query.template
        : null,
      request.query.sort,
      request.query.direction,
    ),
  );
  app.get<{ Params: { workspace: string }; Querystring: { since?: string } }>(
    '/api/workspaces/:workspace/overview',
    (request) => {
      const since = new Date(request.query.since ?? '');
      if (Number.isNaN(since.getTime())) throw new DomainError('INVALID', 'Invalid overview date.');
      return navigation.overview(request.actor, request.params.workspace, since.toISOString());
    },
  );
  app.get<{ Params: { workspace: string } }>('/api/workspaces/:workspace/favorites', (request) =>
    pages.favorites(request.actor, request.params.workspace),
  );
  app.put<{ Params: { id: string } }>('/api/pages/:id/favorite', async (request) => {
    assertObject(request.body);
    await pages.setFavorite(request.actor, request.params.id, request.body.favorite === true);
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
      if (
        request.body.kind &&
        !['document', 'database', 'canvas'].includes(String(request.body.kind))
      )
        throw new DomainError('INVALID', 'Use the database record command for records.');
      return pages.create(request.actor, request.params.workspace, {
        title: String(request.body.title ?? 'Untitled'),
        parentId: request.body.parentId as string | undefined,
        kind: request.body.kind as 'document' | 'database' | 'canvas',
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
      appearance: request.body.appearance as PageUpdate['appearance'],
      tags: request.body.tags as PageUpdate['tags'],
      fields: request.body.fields as PageUpdate['fields'],
      property: request.body.property as PageUpdate['property'],
      propertyAction: request.body.propertyAction as PageUpdate['propertyAction'],
      templateDefaults: request.body.templateDefaults as PageUpdate['templateDefaults'],
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
