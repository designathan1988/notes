import { afterAll, beforeAll, expect, test } from 'vitest';
import { fixture } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import { Databases } from '../apps/server/src/databases/service.js';
import { Pages } from '../apps/server/src/pages/service.js';
import { compileFormulas } from '@note/data/formulas';
import type { RecordField } from '@note/contracts';
import { Knowledge } from '../apps/server/src/knowledge/service.js';
import { Navigation } from '../apps/server/src/pages/navigation.js';

test('malformed schema JSON is rejected as invalid input before any database definition changes', async () => {
  const databases = new Databases(db),
    page = await new Pages(db).create(actor, 'studio', { title: 'Schema input', kind: 'database' });
  for (const invalid of [
    [null],
    [{ name: 'Missing ID', type: 'text' }],
    [{ id: 'field', name: 42, type: 'text' }],
    [{ id: 'formula', name: 'Formula', type: 'formula', formula: {} }],
  ])
    await expect(
      databases.setFields(actor, page.id, invalid as unknown as RecordField[]),
    ).rejects.toMatchObject({ code: 'INVALID' });
  expect((await databases.definition(actor, page.id)).fieldsRevision).toBe(1);
});

test('record lookup distinguishes duplicate names by their accessible database context', async () => {
  const pages = new Pages(db),
    databases = new Databases(db);
  for (const title of ['Interviews', 'Reading']) {
    const database = await pages.create(actor, 'studio', { title, kind: 'database' });
    await databases.createRecord(actor, database.id, {
      title: 'Duplicate lookup record',
      values: {},
    });
  }
  const result = await new Navigation(db).flat(
    actor,
    'studio',
    0,
    'record',
    'Duplicate lookup record',
  );
  expect(result.pages.map((page) => page.parentTitle).sort()).toEqual(['Interviews', 'Reading']);
});

test('a stale record title cannot overwrite a newer page title while value-only edits preserve it', async () => {
  const databases = new Databases(db),
    pages = new Pages(db),
    database = await pages.create(actor, 'studio', { title: 'Title ownership', kind: 'database' });
  const record = await databases.createRecord(actor, database.id, {
    title: 'Original',
    values: {},
  });
  const page = await pages.get(actor, record.pageId);
  await pages.update(actor, record.pageId, { title: 'Header edit', revision: page.revision });
  await expect(
    databases.updateRecord(actor, database.id, record.pageId, {
      title: 'Stale table edit',
      values: {},
      revision: record.revision,
      pageRevision: record.pageRevision,
    }),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  await databases.updateRecord(actor, database.id, record.pageId, {
    values: {},
    revision: record.revision,
  });
  expect((await pages.get(actor, record.pageId)).title).toBe('Header edit');
});

test('search indexes computed values and reindexes records after a formula definition changes', async () => {
  const databases = new Databases(db),
    knowledge = new Knowledge(db),
    page = await new Pages(db).create(actor, 'studio', {
      title: 'Computed search',
      kind: 'database',
    });
  const schema: RecordField[] = [
    { id: 'hours', name: 'Hours', type: 'number' },
    { id: 'cost', name: 'Cost', type: 'formula', formula: '[hours] * 15' },
  ];
  await databases.setFields(actor, page.id, schema);
  const row = await databases.createRecord(actor, page.id, {
    title: 'Computed evidence',
    values: { hours: 9 },
  });
  await knowledge.processOutbox();
  expect(
    (await databases.records(actor, page.id, { filter: '135' })).records.map(
      (record) => record.pageId,
    ),
  ).toContain(row.pageId);
  expect(
    (await knowledge.search(actor, 'studio', '135')).results.map((result) => result.id),
  ).toContain(row.pageId);
  await databases.setFields(actor, page.id, [schema[0], { ...schema[1], formula: '[hours] * 20' }]);
  await knowledge.processOutbox();
  expect(
    (await knowledge.search(actor, 'studio', '180')).results.map((result) => result.id),
  ).toContain(row.pageId);
  expect(
    (await knowledge.search(actor, 'studio', '135')).results.map((result) => result.id),
  ).not.toContain(row.pageId);
});

let db: Database;
beforeAll(async () => {
  db = await fixture();
});
afterAll(async () => {
  await db.close();
});
const actor = { userId: 'owner' };
const fields: RecordField[] = [
  { id: 'hours', name: 'Hours', type: 'number' },
  { id: 'rate', name: 'Rate', type: 'number' },
  { id: 'total', name: 'Total', type: 'formula', formula: 'round([hours] * [rate], 2)' },
  { id: 'tax', name: 'With tax', type: 'formula', formula: '[total] * 1.2' },
];
test('formulas compute derived numeric values without executing JavaScript or storing outputs', () => {
  const calculate = compileFormulas(fields),
    values = { hours: 2.5, rate: 15 };
  expect(calculate(values)).toEqual({ total: 37.5, tax: 45 });
  expect(values).toEqual({ hours: 2.5, rate: 15 });
  expect(calculate({})).toEqual({ total: null, tax: null });
  for (const formula of [
    'globalThis.process.exit()',
    'constructor.constructor("return this")()',
    '[missing]',
    '1 / (',
    '1 ** 2',
  ])
    expect(() => compileFormulas([{ id: 'bad', name: 'Bad', type: 'formula', formula }])).toThrow();
  expect(() =>
    compileFormulas([{ id: 'loop', name: 'Loop', type: 'formula', formula: '[loop] + 1' }]),
  ).toThrow();
});
test('computed fields, archived properties and saved layouts keep canonical records and enforce permissions', async () => {
  const databases = new Databases(db),
    page = await new Pages(db).create(actor, 'studio', {
      title: 'Connected layouts',
      kind: 'database',
    });
  await databases.setFields(actor, page.id, fields);
  const row = await databases.createRecord(actor, page.id, {
    title: 'Estimate',
    values: { hours: 2.5, rate: 15 },
  });
  expect(row.computedValues?.total).toBe(37.5);
  await expect(
    databases.updateRecord(actor, page.id, row.pageId, {
      values: { total: 999 },
      revision: row.revision,
    }),
  ).rejects.toMatchObject({ code: 'INVALID' });
  await databases.setFields(
    actor,
    page.id,
    fields.map((field) => (field.id === 'rate' ? { ...field, archived: true } : field)),
  );
  const read = await databases.records(actor, page.id);
  expect(read.records[0].values.rate).toBe(15);
  expect(read.records[0].computedValues?.tax).toBe(45);
  for (const layout of ['board', 'list', 'calendar'] as const) {
    const view = await databases.saveView(actor, page.id, layout, { layout });
    expect(view.config.layout).toBe(layout);
    await databases.updateView(actor, page.id, view.id, 'Renamed', { layout: 'table' });
    expect((await databases.views(actor, page.id)).find((item) => item.id === view.id)?.name).toBe(
      'Renamed',
    );
    await expect(
      databases.deleteView({ userId: 'viewer' }, page.id, view.id),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await databases.deleteView(actor, page.id, view.id);
  }
  expect(await databases.views(actor, page.id)).toEqual([]);
});

test('record actions are schema-defined, revision checked and never accept executable input', async () => {
  const databases = new Databases(db),
    page = await new Pages(db).create(actor, 'studio', { title: 'Actions', kind: 'database' });
  await databases.setFields(actor, page.id, [
    { id: 'done', name: 'Done', type: 'checkbox' },
    { id: 'complete', name: 'Complete', type: 'button', action: { fieldId: 'done', value: true } },
  ]);
  const record = await databases.createRecord(actor, page.id, {
    title: 'A task',
    values: { done: false },
  });
  const changed = await databases.runAction(
    actor,
    page.id,
    record.pageId,
    'complete',
    record.revision,
  );
  expect(changed.values.done).toBe(true);
  await expect(
    databases.runAction(actor, page.id, record.pageId, 'complete', record.revision),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  await expect(
    databases.runAction({ userId: 'viewer' }, page.id, record.pageId, 'complete', changed.revision),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});

test('formula sorting uses a derived projection that updates atomically with records and formulas', async () => {
  const databases = new Databases(db),
    page = await new Pages(db).create(actor, 'studio', { title: 'Formula sort', kind: 'database' });
  const schema: RecordField[] = [
    { id: 'hours', name: 'Hours', type: 'number' },
    { id: 'cost', name: 'Cost', type: 'formula', formula: '[hours] * 15' },
  ];
  await databases.setFields(actor, page.id, schema);
  const a = await databases.createRecord(actor, page.id, { title: 'High', values: { hours: 9 } });
  await databases.createRecord(actor, page.id, { title: 'Low', values: { hours: 2 } });
  expect(
    (await databases.records(actor, page.id, { sort: 'cost' })).records.map(
      (record) => record.title,
    ),
  ).toEqual(['Low', 'High']);
  await databases.updateRecord(actor, page.id, a.pageId, {
    revision: a.revision,
    values: { hours: 1 },
  });
  expect(
    (await databases.records(actor, page.id, { sort: 'cost' })).records.map(
      (record) => record.title,
    ),
  ).toEqual(['High', 'Low']);
  await databases.setFields(actor, page.id, [
    schema[0],
    { ...schema[1], formula: '100 - [hours]' },
  ]);
  expect(
    (await databases.records(actor, page.id, { sort: 'cost' })).records.map(
      (record) => record.title,
    ),
  ).toEqual(['Low', 'High']);
});

test('calendar queries filter the entire collection before pagination and expose undated records explicitly', async () => {
  const databases = new Databases(db),
    page = await new Pages(db).create(actor, 'studio', { title: 'Calendar', kind: 'database' });
  await databases.setFields(actor, page.id, [{ id: 'date', name: 'Due', type: 'date' }]);
  await databases.createRecord(actor, page.id, {
    title: 'November',
    values: { date: '2026-11-08' },
  });
  await databases.createRecord(actor, page.id, {
    title: 'December',
    values: { date: '2026-12-08' },
  });
  await databases.createRecord(actor, page.id, { title: 'Undated', values: {} });
  const month = await databases.records(actor, page.id, {
    dateField: 'date',
    dateFrom: '2026-11-01',
    dateTo: '2026-11-30',
    limit: 1,
  });
  expect(month.total).toBe(1);
  expect(month.records[0].title).toBe('November');
  const undated = await databases.records(actor, page.id, { dateField: 'date', undated: true });
  expect(undated.records.map((record) => record.title)).toEqual(['Undated']);
  await expect(
    databases.records(actor, page.id, {
      dateField: 'date',
      dateFrom: '2026-02-30',
      dateTo: '2026-03-05',
    }),
  ).rejects.toMatchObject({ code: 'INVALID' });
});

test('a late invalid record rolls back every earlier computed projection and the schema together', async () => {
  const databases = new Databases(db),
    page = await new Pages(db).create(actor, 'studio', {
      title: 'Atomic formula batches',
      kind: 'database',
    });
  const schema: RecordField[] = [
    { id: 'source', name: 'Source', type: 'number' },
    { id: 'status', name: 'Status', type: 'select', options: ['Early', 'Late'] },
    { id: 'cost', name: 'Cost', type: 'formula', formula: '[source] * 10' },
  ];
  await databases.setFields(actor, page.id, schema);
  const rows = Array.from({ length: 501 }, (_, index) => ({
    id: `batch-${page.id}-${String(index).padStart(4, '0')}`,
    values: { source: 1, status: index === 500 ? 'Late' : 'Early' },
  }));
  await db.query(
    `INSERT INTO pages (id,workspace_id,parent_id,title,kind,created_by) SELECT x.id,'studio',$2,x.id,'record','owner' FROM jsonb_to_recordset($1::jsonb) AS x(id text)`,
    [JSON.stringify(rows), page.id],
  );
  await db.query(
    `INSERT INTO records (page_id,database_id,values,computed_values) SELECT x.id,$2,x.values,'{"cost":10}'::jsonb FROM jsonb_to_recordset($1::jsonb) AS x(id text,values jsonb)`,
    [JSON.stringify(rows), page.id],
  );
  await expect(
    databases.setFields(actor, page.id, [
      schema[0],
      { ...schema[1], options: ['Early'] },
      { ...schema[2], formula: '[source] * 20' },
    ]),
  ).rejects.toMatchObject({ code: 'INVALID' });
  expect(
    (await databases.fields(actor, page.id)).find((field) => field.id === 'cost')?.formula,
  ).toBe('[source] * 10');
  const [result] = await db.query<{ computed_values: { cost: number } }>(
    'SELECT computed_values FROM records WHERE page_id=$1',
    [rows[0].id],
  );
  expect(result.computed_values.cost).toBe(10);
});
