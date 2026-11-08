import { afterAll, beforeAll, expect, test } from 'vitest';
import { fixture } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import { Databases } from '../apps/server/src/databases/service.js';
import { Pages } from '../apps/server/src/pages/service.js';
let db: Database;
let databases: Databases;
let id: string;
const actor = { userId: 'owner' };
beforeAll(async () => {
  db = await fixture();
  databases = new Databases(db);
  id = (await new Pages(db).create(actor, 'studio', { title: 'Research', kind: 'database' })).id;
});
afterAll(async () => {
  await db.close();
});
test('validates typed property values and rejects unknown fields', async () => {
  await databases.setFields(actor, id, [
    { id: 'priority', name: 'Priority', type: 'number' },
    { id: 'url', name: 'URL', type: 'url' },
  ]);
  await expect(
    databases.createRecord(actor, id, { title: 'Invalid', values: { priority: 'high' } }),
  ).rejects.toMatchObject({ code: 'INVALID' });
  await expect(
    databases.createRecord(actor, id, { title: 'Invalid', values: { url: 'javascript:alert(1)' } }),
  ).rejects.toMatchObject({ code: 'INVALID' });
  await expect(
    databases.createRecord(actor, id, { title: 'Invalid', values: { surprise: true } }),
  ).rejects.toMatchObject({ code: 'INVALID' });
});
test('connected views read the same record and concurrent stale writes are explicit', async () => {
  const record = await databases.createRecord(actor, id, {
    title: 'Interview',
    values: { priority: 1 },
  });
  await databases.updateRecord(actor, id, record.pageId, {
    values: { priority: 2 },
    revision: record.revision,
  });
  const first = await databases.records(actor, id, { sort: 'title' });
  const second = await databases.records(actor, id, { filter: 'Interview' });
  expect(first.records.find((row) => row.pageId === record.pageId)?.values.priority).toBe(2);
  expect(second.records[0].pageId).toBe(record.pageId);
  await expect(
    databases.updateRecord(actor, id, record.pageId, {
      values: { priority: 3 },
      revision: record.revision,
    }),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
});
test('record relations cannot expose another private root', async () => {
  const privateDatabase = await new Pages(db).create(actor, 'studio', {
    title: 'Private database',
    kind: 'database',
    visibility: 'private',
  });
  const secret = await databases.createRecord(actor, privateDatabase.id, {
    title: 'Secret',
    values: {},
  });
  await databases.setFields(actor, id, [
    { id: 'priority', name: 'Priority', type: 'number' },
    { id: 'url', name: 'URL', type: 'url' },
    { id: 'related', name: 'Related', type: 'relation' },
  ]);
  await expect(
    databases.createRecord({ userId: 'editor' }, id, {
      title: 'Should not link',
      values: { related: secret.pageId },
    }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
test('ordinary page creation cannot manufacture unowned record pages', async () => {
  await expect(
    new Pages(db).create(actor, 'studio', { title: 'Unowned', kind: 'record' }),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
});
test('a schema change racing record creation cannot commit an invalid typed value', async () => {
  const database = (
    await new Pages(db).create(actor, 'studio', { title: 'Schema race', kind: 'database' })
  ).id;
  await databases.setFields(actor, database, [{ id: 'score', name: 'Score', type: 'number' }]);
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const delayed: Database = {
    ...db,
    transaction: async (fn) => {
      entered();
      await gate;
      return db.transaction(fn);
    },
  };
  const creating = new Databases(delayed).createRecord(actor, database, {
    title: 'Racing record',
    values: { score: 42 },
  });
  await ready;
  await databases.setFields(actor, database, [{ id: 'score', name: 'Score', type: 'text' }]);
  release();
  await expect(creating).rejects.toMatchObject({ code: 'INVALID' });
});

test('saved database views retain the chosen visible property columns', async () => {
  const view = await databases.saveView(actor, id, 'Focused columns', {
    columns: ['priority'],
    sort: 'title',
  });
  expect(
    (await databases.views(actor, id)).find((item) => item.id === view.id)?.config.columns,
  ).toEqual(['priority']);
});
