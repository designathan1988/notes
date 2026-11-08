import { beforeAll, afterAll, test, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { fixture, rawPage } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import type { Auth } from '../apps/server/src/identity/auth.js';
import { createApp } from '../apps/server/src/app.js';
import { Knowledge } from '../apps/server/src/knowledge/service.js';
import { Databases } from '../apps/server/src/databases/service.js';
import type { RecordField } from '@note/contracts';

let db: Database, app: FastifyInstance;
const hours: RecordField = { id: 'hours', name: 'Hours', type: 'number' },
  topic: RecordField = { id: 'topic', name: 'Topic', type: 'text' };
beforeAll(async () => {
  db = await fixture();
  const auth = {
    api: {
      getSession: async ({ headers }: { headers: Headers }) => ({
        user: { id: headers.get('x-test-user') ?? 'editor' },
      }),
    },
  } as unknown as Auth;
  app = await createApp({ db, auth });
});
afterAll(async () => {
  await app.close();
  await db.close();
});
const patch = (id: string, payload: Record<string, unknown>, user = 'editor') =>
  app.inject({
    method: 'PATCH',
    url: `/api/pages/${id}`,
    payload,
    headers: { 'x-note-request': '1', 'x-test-user': user },
  });
const value = (field: RecordField, next: unknown, previous: unknown = null) => ({
  id: field.id,
  value: next,
  expectedValue: previous,
  expectedField: field,
});

test('typed page properties, formulas and safe actions share the page aggregate and search projection', async () => {
  const id = await rawPage(db);
  const fields = [
    hours,
    topic,
    { id: 'cost', name: 'Cost', type: 'formula', formula: '[hours] * 15' },
    { id: 'done', name: 'Done', type: 'checkbox' },
    { id: 'complete', name: 'Complete', type: 'button', action: { fieldId: 'done', value: true } },
  ];
  const defined = await patch(id, { revision: 1, fields });
  expect(defined.statusCode).toBe(200);
  expect(defined.json().properties).toEqual({ fields, values: {} });
  const edited = await patch(id, { revision: 2, property: value(hours, 4) });
  expect(edited.statusCode).toBe(200);
  const described = await patch(id, {
    revision: 3,
    property: value(topic, 'Ethnographic synthesis'),
  });
  expect(described.statusCode).toBe(200);
  const action = await patch(id, { revision: 4, propertyAction: 'complete' });
  expect(action.statusCode).toBe(200);
  expect(action.json().properties.values).toEqual({
    hours: 4,
    topic: 'Ethnographic synthesis',
    done: true,
  });
  const stored = await db.query<{ page_properties: unknown }>(
    'SELECT page_properties FROM pages WHERE id=$1',
    [id],
  );
  expect(stored[0].page_properties).toEqual(action.json().properties);
  const knowledge = new Knowledge(db);
  await knowledge.projectLatest(id);
  expect(
    (await knowledge.search({ userId: 'editor' }, 'studio', 'Ethnographic')).results.map(
      (page) => page.id,
    ),
  ).toContain(id);
  expect(
    (await knowledge.search({ userId: 'editor' }, 'studio', '60')).results.map((page) => page.id),
  ).toContain(id);
});

test('a focused property cannot overwrite a remote value or a changed definition', async () => {
  const id = await rawPage(db);
  await patch(id, { revision: 1, fields: [hours, topic] });
  await patch(id, { revision: 2, property: value(hours, 2) });
  expect((await patch(id, { revision: 3, property: value(hours, 5) })).statusCode).toBe(409);
  const changed = await patch(id, { revision: 3, fields: [{ ...hours, name: 'Effort' }, topic] });
  expect(changed.statusCode).toBe(200);
  expect((await patch(id, { revision: 4, property: value(hours, 5, 2) })).statusCode).toBe(409);
  expect(
    (await patch(id, { revision: 4, property: value(topic, 'Independent field') })).statusCode,
  ).toBe(200);
  expect((await patch(id, { revision: 4, fields: [hours, topic] })).statusCode).toBe(409);
});

test('invalid schemas and values fail atomically while archiving preserves stored data', async () => {
  const id = await rawPage(db);
  await patch(id, { revision: 1, fields: [hours] });
  await patch(id, { revision: 2, property: value(hours, 2) });
  for (const changes of [
    { fields: [] },
    { fields: [{ ...hours, type: 'checkbox' }] },
    { fields: [hours, { ...topic, name: ' hours ' }] },
    { fields: [{ ...hours, name: 'Bad\u0000name' }] },
    {
      fields: [
        hours,
        { id: 'status', name: 'Status', type: 'select', options: ['Bad\u0000option'] },
      ],
    },
    {
      fields: [
        hours,
        topic,
        {
          id: 'button',
          name: 'Set topic',
          type: 'button',
          action: { fieldId: 'topic', value: 'Bad\u0000value' },
        },
      ],
    },
    { property: value(hours, 'not a number', 2) },
    { property: value(hours, 9, 2), fields: [hours] },
  ])
    expect((await patch(id, { revision: 3, title: 'Must not save', ...changes })).statusCode).toBe(
      400,
    );
  const archived = await patch(id, { revision: 3, fields: [{ ...hours, archived: true }] });
  expect(archived.statusCode).toBe(200);
  expect(archived.json()).toMatchObject({ title: 'A note', properties: { values: { hours: 2 } } });
  expect(
    (await patch(id, { revision: 4, property: value({ ...hours, archived: true }, 7, 2) }))
      .statusCode,
  ).toBe(400);
});

test('the page-property aggregate enforces its storage budget without dropping earlier values', async () => {
  const id = await rawPage(db),
    fields: RecordField[] = Array.from({ length: 7 }, (_, index) => ({
      id: `text-${index}`,
      name: `Text ${index}`,
      type: 'text',
    }));
  expect((await patch(id, { revision: 1, fields })).statusCode).toBe(200);
  for (let index = 0; index < 6; index++)
    expect(
      (await patch(id, { revision: index + 2, property: value(fields[index], 'x'.repeat(10000)) }))
        .statusCode,
    ).toBe(200);
  const rejected = await patch(id, { revision: 8, property: value(fields[6], 'x'.repeat(10000)) });
  expect(rejected.statusCode).toBe(413);
  const stored = await app.inject({
    method: 'GET',
    url: `/api/pages/${id}`,
    headers: { 'x-test-user': 'editor' },
  });
  expect(stored.json().revision).toBe(8);
  expect(Object.keys(stored.json().properties.values)).toHaveLength(6);
});

test('relations require accessible pages in the same workspace and property definitions remain private', async () => {
  const id = await rawPage(db, { creator: 'editor', visibility: 'private' }),
    accessible = await rawPage(db),
    hidden = await rawPage(db, { visibility: 'private' }),
    other = await rawPage(db, { workspace: 'other', creator: 'outsider' });
  const related: RecordField = { id: 'related', name: 'Private research source', type: 'relation' };
  expect((await patch(id, { revision: 1, fields: [related] })).statusCode).toBe(200);
  expect((await patch(id, { revision: 2, property: value(related, hidden) })).statusCode).toBe(403);
  expect((await patch(id, { revision: 2, property: value(related, other) })).statusCode).toBe(403);
  expect((await patch(id, { revision: 2, property: value(related, accessible) })).statusCode).toBe(
    200,
  );
  const knowledge = new Knowledge(db);
  await knowledge.projectLatest(id);
  expect((await knowledge.graph({ userId: 'editor' }, 'studio')).edges).toContainEqual({
    source: id,
    target: accessible,
  });
  expect(
    (await knowledge.graph({ userId: 'owner' }, 'studio')).nodes.some((page) => page.id === id),
  ).toBe(false);
  expect(
    (await knowledge.search({ userId: 'owner' }, 'studio', 'Private research source')).results.map(
      (page) => page.id,
    ),
  ).not.toContain(id);
  expect((await patch(id, { revision: 3, fields: [] }, 'owner')).statusCode).toBe(403);
});

test('record-page properties stay database-owned and a direct record lookup enforces its owning database', async () => {
  const databases = new Databases(db),
    actor = { userId: 'editor' };
  const parent = await rawPage(db, { kind: 'database', creator: 'editor' });
  await db.query('INSERT INTO database_definitions(page_id,fields) VALUES($1,$2)', [
    parent,
    JSON.stringify([hours]),
  ]);
  const record = await databases.createRecord(actor, parent, {
    title: 'Canonical record',
    values: { hours: 3 },
  });
  const metadata = await app.inject({
    method: 'GET',
    url: `/api/pages/${record.pageId}`,
    headers: { 'x-test-user': 'editor' },
  });
  expect(
    (await patch(record.pageId, { revision: metadata.json().revision, fields: [topic] }))
      .statusCode,
  ).toBe(409);
  const lookup = await app.inject({
    method: 'GET',
    url: `/api/databases/${parent}/records/${record.pageId}`,
    headers: { 'x-test-user': 'editor' },
  });
  expect(lookup.statusCode).toBe(200);
  expect(lookup.json()).toMatchObject({
    fields: [hours],
    record: { pageId: record.pageId, values: { hours: 3 } },
  });
  const invalidParent = await app.inject({
    method: 'GET',
    url: `/api/databases/${await rawPage(db)}/records/${record.pageId}`,
    headers: { 'x-test-user': 'editor' },
  });
  expect(invalidParent.statusCode).not.toBe(200);
  await db.query("UPDATE pages SET visibility='private',private_owner_id='editor' WHERE id=$1", [
    parent,
  ]);
  expect(
    (
      await app.inject({
        method: 'GET',
        url: `/api/databases/${parent}/records/${record.pageId}`,
        headers: { 'x-test-user': 'owner' },
      })
    ).statusCode,
  ).toBe(403);
});

test('a record cell protects its original value even after the client learns a newer record revision', async () => {
  const parent = await rawPage(db, { kind: 'database', creator: 'editor' });
  await db.query('INSERT INTO database_definitions(page_id,fields) VALUES($1,$2)', [
    parent,
    JSON.stringify([hours]),
  ]);
  const record = await new Databases(db).createRecord({ userId: 'editor' }, parent, {
    title: 'Focused record',
    values: { hours: 3 },
  });
  const update = (revision: number, expectedValue: number) =>
    app.inject({
      method: 'PATCH',
      url: `/api/databases/${parent}/records/${record.pageId}`,
      headers: { 'x-test-user': 'editor', 'x-note-request': '1' },
      payload: {
        revision,
        values: { hours: 5 },
        expected: { id: 'hours', value: expectedValue, field: hours },
      },
    });
  expect((await update(record.revision, 3)).statusCode).toBe(200);
  expect((await update(record.revision + 1, 3)).statusCode).toBe(409);
});
