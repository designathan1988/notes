import type { FastifyInstance } from 'fastify';
import type { Database } from '../platform/database.js';
import { Databases } from './service.js';
import {
  assertObject,
  DomainError,
  type RecordField,
} from '../../../../packages/contracts/src/index.js';
export function databaseRoutes(app: FastifyInstance, db: Database) {
  const databases = new Databases(db);
  app.get<{
    Params: { id: string };
    Querystring: {
      filter?: string;
      sort?: string;
      direction?: string;
      offset?: number;
      limit?: number;
    };
  }>('/api/databases/:id', async (request) => {
    const [fields, rows, views] = await Promise.all([
      databases.definition(request.actor, request.params.id),
      databases.records(request.actor, request.params.id, request.query),
      databases.views(request.actor, request.params.id),
    ]);
    return { ...fields, ...rows, views };
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
  return databases;
}
