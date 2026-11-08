import type { FastifyInstance } from 'fastify';
import type { Database } from '../platform/database.js';
import { Databases } from './service.js';
import {
  assertObject,
  DomainError,
  type RecordField,
  type RecordQuery,
} from '../../../../packages/contracts/src/index.js';
export function databaseRoutes(app: FastifyInstance, db: Database) {
  const databases = new Databases(db);
  app.get<{
    Params: { id: string };
    Querystring: RecordQuery;
  }>('/api/databases/:id', async (request) => {
    const [fields, rows] = await Promise.all([
      databases.definition(request.actor, request.params.id),
      databases.records(request.actor, request.params.id, request.query),
    ]);
    return { ...fields, ...rows };
  });
  app.put<{ Params: { id: string } }>('/api/databases/:id/fields', async (request) => {
    assertObject(request.body);
    if (!Number.isSafeInteger(request.body.revision) || Number(request.body.revision) < 1)
      throw new DomainError('INVALID', 'A current schema revision is required.');
    await databases.setFields(
      request.actor,
      request.params.id,
      request.body.fields as RecordField[],
      Number(request.body.revision),
    );
    return { ok: true };
  });
  app.post<{ Params: { id: string } }>('/api/databases/:id/records', (request) => {
    assertObject(request.body);
    return databases.createRecord(request.actor, request.params.id, {
      title: String(request.body.title ?? 'Untitled'),
      values: (request.body.values ?? {}) as Record<string, unknown>,
    });
  });
  app.patch<{ Params: { id: string; page: string } }>(
    '/api/databases/:id/records/:page',
    (request) => {
      assertObject(request.body);
      return databases.updateRecord(request.actor, request.params.id, request.params.page, {
        title: request.body.title as string | undefined,
        pageRevision: request.body.pageRevision as number | undefined,
        values: (request.body.values ?? {}) as Record<string, unknown>,
        revision: Number(request.body.revision),
      });
    },
  );
  app.post<{ Params: { id: string } }>('/api/databases/:id/views', (request) => {
    assertObject(request.body);
    assertObject(request.body.config);
    return databases.saveView(
      request.actor,
      request.params.id,
      String(request.body.name ?? ''),
      request.body.config,
    );
  });
  app.post<{ Params: { id: string; page: string; field: string } }>(
    '/api/databases/:id/records/:page/actions/:field',
    (request) => {
      assertObject(request.body);
      if (!Number.isSafeInteger(request.body.revision))
        throw new DomainError('INVALID', 'A record revision is required.');
      return databases.runAction(
        request.actor,
        request.params.id,
        request.params.page,
        request.params.field,
        Number(request.body.revision),
      );
    },
  );
  app.patch<{ Params: { id: string; view: string } }>(
    '/api/databases/:id/views/:view',
    (request) => {
      assertObject(request.body);
      assertObject(request.body.config);
      if (!Number.isSafeInteger(request.body.revision))
        throw new DomainError('INVALID', 'A view revision is required.');
      return databases.updateView(
        request.actor,
        request.params.id,
        request.params.view,
        String(request.body.name ?? ''),
        request.body.config,
        Number(request.body.revision),
      );
    },
  );
  app.delete<{ Params: { id: string; view: string }; Querystring: { revision: string } }>(
    '/api/databases/:id/views/:view',
    async (request) => {
      const revision = Number(request.query.revision);
      if (!Number.isSafeInteger(revision) || revision < 1)
        throw new DomainError('INVALID', 'A view revision is required.');
      await databases.deleteView(request.actor, request.params.id, request.params.view, revision);
      return { ok: true };
    },
  );
  return databases;
}
