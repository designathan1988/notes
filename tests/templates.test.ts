import { afterAll, beforeAll, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { fixture } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import type { Storage } from '../apps/server/src/attachments/storage.js';
import type { Auth } from '../apps/server/src/identity/auth.js';
import { createApp } from '../apps/server/src/app.js';
import { Pages } from '../apps/server/src/pages/service.js';
import { Documents } from '../apps/server/src/documents/service.js';
import { Attachments } from '../apps/server/src/attachments/service.js';
import { Databases } from '../apps/server/src/databases/service.js';
import { documentFromJSON, documentJSON } from '@note/editor/schema';
import type { JSONContent } from '@tiptap/core';
import { Transfer } from '../apps/server/src/transfer/service.js';
import { Access } from '../apps/server/src/access/service.js';
import { availableStorage } from '../apps/server/src/platform/storage-capacity.js';

class TestStorage implements Storage {
  files = new Map<string, Buffer>();
  fail = false;
  afterWrite?: () => Promise<void>;
  async read(key: string) {
    const bytes = this.files.get(key);
    if (!bytes) throw new Error('Missing bytes');
    return Buffer.from(bytes);
  }
  async write(key: string, bytes: Buffer) {
    if (this.fail) throw new Error('Storage unavailable');
    this.files.set(key, Buffer.from(bytes));
    await this.afterWrite?.();
  }
  async remove(key: string) {
    this.files.delete(key);
  }
}
let db: Database, app: FastifyInstance;
const storage = new TestStorage(),
  actor = { userId: 'editor' };
beforeAll(async () => {
  db = await fixture();
  const auth = {
    api: {
      getSession: async ({ headers }: { headers: Headers }) => ({
        user: { id: headers.get('x-test-user') ?? 'editor' },
      }),
    },
  } as unknown as Auth;
  app = await createApp({ db, auth, storage });
});
afterAll(async () => {
  await app.close();
  await db.close();
});
const call = (
  method: 'GET' | 'POST' | 'PATCH',
  url: string,
  payload?: Record<string, unknown>,
  user = 'editor',
) =>
  app.inject({
    method,
    url,
    headers: { 'x-note-request': '1', 'x-test-user': user },
    ...(payload ? { payload: { expectedUserId: user, ...payload } } : {}),
  });
const body = (text: string): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
test('a definition can be duplicated while its referenced record database is unavailable', async () => {
  const pages = new Pages(db),
    databases = new Databases(db),
    database = await pages.create(actor, 'studio', {
      title: 'Unavailable template schema',
      kind: 'database',
    });
  await databases.setFields(actor, database.id, [{ id: 'hours', name: 'Hours', type: 'number' }]);
  const record = await databases.createRecord(actor, database.id, {
    title: 'Unavailable record source',
    values: { hours: 7 },
  });
  await content(record.pageId, body('Keep this reusable content'));
  const saved = await call('POST', `/api/pages/${record.pageId}/templates`, {
      requestId: 'save-unavailable-schema',
    }),
    template = saved.json();
  await pages.trash(actor, database.id);
  const copied = await call('POST', `/api/pages/${template.id}/duplicate`, {
    requestId: 'duplicate-unavailable-schema',
  });
  expect(copied.statusCode).toBe(200);
  expect(copied.json()).toMatchObject({
    templateRootId: copied.json().id,
    templateDatabaseId: database.id,
    templateValues: { hours: 7 },
  });
  expect(JSON.stringify(await content(copied.json().id))).toContain('Keep this reusable content');
  expect(
    (
      await call('POST', `/api/templates/${copied.json().id}/instances`, {
        requestId: 'use-unavailable-schema',
      })
    ).statusCode,
  ).toBe(403);
});
test('template descendants inherit their definition and cannot be moved across its boundary', async () => {
  const pages = new Pages(db),
    saved = await call('POST', '/api/workspaces/studio/templates', {
      requestId: 'blank-inheritance-template',
      title: 'Template hierarchy',
    }),
    root = saved.json();
  const child = await pages.create(actor, 'studio', { title: 'Template child', parentId: root.id }),
    nested = await pages.create(actor, 'studio', { title: 'Nested evidence', parentId: child.id }),
    ordinary = await pages.create(actor, 'studio', { title: 'Ordinary destination' });
  expect(child.templateRootId).toBe(root.id);
  expect(nested.templateRootId).toBe(root.id);
  const context = await call('GET', `/api/pages/${root.id}/copy-context`);
  expect(context.json()).toMatchObject({ userId: actor.userId, workspaceId: 'studio' });
  expect(
    context
      .json()
      .pages.map((page: { id: string }) => page.id)
      .sort(),
  ).toEqual([root.id, child.id, nested.id].sort());
  expect(
    (await call('GET', `/api/pages/${root.id}/copy-context`, undefined, 'owner')).statusCode,
  ).toBe(403);
  await expect(pages.move(actor, root.id, ordinary.id, root.revision, true)).rejects.toMatchObject({
    code: 'CONFLICT',
  });
  await expect(
    pages.move(actor, child.id, ordinary.id, child.revision, true),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  await expect(
    pages.move(actor, ordinary.id, child.id, ordinary.revision, true),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  expect(
    (await call('GET', `/api/workspaces/studio/page-list?q=Template%20child`)).json().pages,
  ).toEqual([]);
  expect(
    (await call('GET', `/api/workspaces/studio/page-list?template=${root.id}&q=Template%20child`))
      .json()
      .pages.map((page: { id: string }) => page.id),
  ).toContain(child.id);
});
test('storage allowance failure rolls back copied pages and removes the staged bytes', async () => {
  const pages = new Pages(db),
    root = await pages.create(actor, 'studio', { title: 'Quota copy source' }),
    attachments = new Attachments(db, storage),
    file = await attachments.begin(actor, root.id, {
      filename: 'quota.txt',
      mediaType: 'text/plain',
      size: 5,
    });
  await attachments.upload(actor, file.id, Buffer.from('proof'));
  const [entitlement] = await db.query<{ storage_limit: string }>(
    'SELECT storage_limit::text FROM beta_entitlements WHERE workspace_id=$1',
    ['studio'],
  );
  const previousLimit = entitlement ? Number(entitlement.storage_limit) : 1073741824,
    used = previousLimit - (await availableStorage(db, 'studio'));
  await db.query(
    'INSERT INTO beta_entitlements(workspace_id,storage_limit) VALUES($1,$2) ON CONFLICT(workspace_id) DO UPDATE SET storage_limit=excluded.storage_limit',
    ['studio', used],
  );
  const before = (await db.query<{ count: string }>('SELECT count(*)::text AS count FROM pages'))[0]
      .count,
    blobs = storage.files.size;
  try {
    expect(
      (
        await call('POST', `/api/pages/${root.id}/templates`, {
          requestId: 'quota-failed-template',
        })
      ).statusCode,
    ).toBe(413);
    expect(
      (await db.query<{ count: string }>('SELECT count(*)::text AS count FROM pages'))[0].count,
    ).toBe(before);
    expect(storage.files.size).toBe(blobs);
  } finally {
    if (entitlement)
      await db.query('UPDATE beta_entitlements SET storage_limit=$2 WHERE workspace_id=$1', [
        'studio',
        previousLimit,
      ]);
    else await db.query('DELETE FROM beta_entitlements WHERE workspace_id=$1', ['studio']);
  }
});
async function content(id: string, value?: JSONContent) {
  if (value) {
    const source = documentFromJSON(value);
    try {
      await new Documents(db).importContent(actor, id, source, 1);
    } finally {
      source.destroy();
    }
  }
  const doc = await new Documents(db).load(id);
  try {
    return documentJSON(doc);
  } finally {
    doc.destroy();
  }
}
const allNodes = (value: JSONContent): JSONContent[] => [
  value,
  ...(value.content ?? []).flatMap(allNodes),
];

test('saved templates independently retain owned pages, media, properties and internal references', async () => {
  const pages = new Pages(db),
    attachments = new Attachments(db, storage);
  const root = await pages.create(actor, 'studio', { title: 'Original research' }),
    child = await pages.create(actor, 'studio', { title: 'Evidence', parentId: root.id }),
    external = await pages.create(actor, 'studio', { title: 'External reference' });
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  );
  const image = await attachments.begin(actor, root.id, {
    filename: 'research.png',
    mediaType: 'image/png',
    size: bytes.length,
  });
  await attachments.upload(actor, image.id, bytes);
  const related = { id: 'related', name: 'Related page', type: 'relation' as const };
  await pages.update(actor, root.id, {
    revision: 1,
    icon: '🧭',
    tags: ['Research'],
    cover: { type: 'image', attachmentId: image.id, positionY: 36 },
    fields: [related],
  });
  await pages.update(actor, root.id, {
    revision: 2,
    property: { id: related.id, value: child.id, expectedValue: null, expectedField: related },
  });
  await content(root.id, {
    type: 'doc',
    content: [
      { type: 'pageLink', attrs: { targetId: child.id, label: 'Evidence' } },
      {
        type: 'paragraph',
        content: [
          { type: 'wikiLink', attrs: { targetId: external.id, label: 'External reference' } },
        ],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Internal anchor',
            marks: [{ type: 'link', attrs: { href: `#${child.id}/document` } }],
          },
        ],
      },
      {
        type: 'attachment',
        attrs: { id: image.id, filename: 'research.png', mediaType: 'image/png' },
      },
    ],
  });
  await content(child.id, {
    type: 'doc',
    content: [
      { type: 'pageLink', attrs: { targetId: root.id, label: 'Research parent' } },
      {
        type: 'attachment',
        attrs: { id: image.id, filename: 'research.png', mediaType: 'image/png' },
      },
    ],
  });
  const saved = await call('POST', `/api/pages/${root.id}/templates`, {
    requestId: 'save-research-template',
    title: 'Research starter',
  });
  expect(saved.statusCode).toBe(200);
  const template = saved.json();
  expect(template).toMatchObject({
    title: 'Research starter',
    templateRootId: template.id,
    visibility: 'private',
    parentId: null,
    icon: '🧭',
    tags: ['research'],
  });
  const [copyChild] = await db.query<{ id: string }>('SELECT id FROM pages WHERE parent_id=$1', [
    template.id,
  ]);
  const copied = allNodes(await content(template.id));
  expect(copied.find((node) => node.type === 'pageLink')?.attrs?.targetId).toBe(copyChild.id);
  expect(copied.find((node) => node.type === 'wikiLink')?.attrs?.targetId).toBe(external.id);
  expect(copied.find((node) => node.type === 'text')?.marks?.[0].attrs?.href).toBe(
    `#${copyChild.id}/document`,
  );
  expect(template.properties.values.related).toBe(copyChild.id);
  const coverId = template.cover.attachmentId;
  expect(coverId).not.toBe(image.id);
  expect((await attachments.read(actor, coverId)).bytes).toEqual(bytes);
  const childAsset = allNodes(await content(copyChild.id)).find(
    (node) => node.type === 'attachment',
  )?.attrs?.id;
  expect(childAsset).not.toBe(coverId);
  expect((await attachments.read(actor, childAsset)).pageId).toBe(copyChild.id);
  const list = await call('GET', '/api/workspaces/studio/templates');
  expect(list.json().items.map((page: { id: string }) => page.id)).toContain(template.id);
  const ordinary = await call('GET', '/api/workspaces/studio/page-list?q=Research%20starter');
  expect(ordinary.json().pages).toEqual([]);
  expect((await call('GET', `/api/pages/${template.id}`, undefined, 'owner')).statusCode).toBe(403);
  await storage.remove(image.objectKey);
  await pages.trash(actor, root.id);
  const first = await call('POST', `/api/templates/${template.id}/instances`, {
      requestId: 'use-research-template',
    }),
    retry = await call('POST', `/api/templates/${template.id}/instances`, {
      requestId: 'use-research-template',
    });
  expect(first.statusCode).toBe(200);
  expect(retry.json().id).toBe(first.json().id);
  expect(first.json().templateRootId).toBeNull();
  expect((await attachments.read(actor, first.json().cover.attachmentId)).bytes).toEqual(bytes);
  await content(first.json().id, body('Only this instance changes'));
  expect(JSON.stringify(await content(template.id))).not.toContain('Only this instance changes');
  await pages.trash(actor, template.id);
  const replay = await call('POST', `/api/templates/${template.id}/instances`, {
    requestId: 'use-research-template',
  });
  expect(replay.statusCode).toBe(200);
  expect(replay.json().id).toBe(first.json().id);
});

test('record templates use their database schema and retain incompatible defaults for explicit review', async () => {
  const pages = new Pages(db),
    databases = new Databases(db);
  const database = await pages.create(actor, 'studio', {
    title: 'Live research',
    kind: 'database',
  });
  const hours = { id: 'hours', name: 'Hours', type: 'number' as const };
  await databases.setFields(actor, database.id, [hours]);
  const original = await databases.createRecord(actor, database.id, {
    title: 'Interview',
    values: { hours: 2 },
  });
  await content(original.pageId, body('Reusable interview body'));
  const saved = await call('POST', `/api/pages/${original.pageId}/templates`, {
    requestId: 'save-record-template',
    title: 'Interview starter',
  });
  expect(saved.statusCode).toBe(200);
  const template = saved.json();
  expect(template).toMatchObject({
    kind: 'document',
    parentId: null,
    templateDatabaseId: database.id,
    templateValues: { hours: 2 },
    visibility: 'private',
  });
  expect((await databases.records(actor, database.id)).total).toBe(1);
  const changed = await call('PATCH', `/api/templates/${template.id}/defaults`, {
    revision: template.revision,
    fieldsRevision: (await databases.definition(actor, database.id)).fieldsRevision,
    property: { id: 'hours', value: 5, expectedValue: 2, expectedField: hours },
  });
  expect(changed.statusCode).toBe(200);
  expect((await databases.record(actor, database.id, original.pageId)).values.hours).toBe(2);
  const created = await call('POST', `/api/templates/${template.id}/instances`, {
    requestId: 'instantiate-record-template',
  });
  expect(created.statusCode).toBe(200);
  expect(created.json()).toMatchObject({
    kind: 'record',
    parentId: database.id,
    templateRootId: null,
  });
  expect((await databases.record(actor, database.id, created.json().id)).values.hours).toBe(5);
  expect(JSON.stringify(await content(created.json().id))).toContain('Reusable interview body');
  for (const record of (await databases.records(actor, database.id)).records)
    await databases.updateRecord(actor, database.id, record.pageId, {
      revision: record.revision,
      values: { hours: null },
    });
  await databases.setFields(actor, database.id, [{ ...hours, type: 'checkbox' }]);
  const before = (await databases.records(actor, database.id)).total;
  const invalid = await call('POST', `/api/templates/${template.id}/instances`, {
    requestId: 'invalid-record-defaults',
  });
  expect(invalid.statusCode).toBe(400);
  expect((await databases.records(actor, database.id)).total).toBe(before);
  const review = await call('GET', `/api/templates/${template.id}/defaults`);
  expect(review.json().issues).toHaveLength(1);
  const current = await pages.get(actor, template.id);
  expect(current.templateValues?.hours).toBe(5);
  const reset = await call('PATCH', `/api/templates/${template.id}/defaults`, {
    revision: current.revision,
    fieldsRevision: (await databases.definition(actor, database.id)).fieldsRevision,
    resetInvalid: true,
  });
  expect(reset.statusCode).toBe(200);
  expect(reset.json().templateValues).toEqual({});
  expect(
    (
      await call('POST', `/api/templates/${template.id}/instances`, {
        requestId: 'valid-record-after-reset',
      })
    ).statusCode,
  ).toBe(200);
});

test('failed storage and revoked permissions leave no published copy or unlinked cloned blobs', async () => {
  const root = await new Pages(db).create(actor, 'studio', { title: 'Atomic template source' });
  const attachments = new Attachments(db, storage),
    file = await attachments.begin(actor, root.id, {
      filename: 'source.txt',
      mediaType: 'text/plain',
      size: 5,
    });
  await attachments.upload(actor, file.id, Buffer.from('proof'));
  const count = async () =>
    Number(
      (await db.query<{ count: string }>('SELECT count(*)::text AS count FROM pages'))[0].count,
    );
  const before = await count(),
    blobs = storage.files.size;
  storage.fail = true;
  try {
    expect(
      (await call('POST', `/api/pages/${root.id}/templates`, { requestId: 'storage-failure-copy' }))
        .statusCode,
    ).toBe(500);
  } finally {
    storage.fail = false;
  }
  expect(await count()).toBe(before);
  expect(storage.files.size).toBe(blobs);
  storage.afterWrite = async () => {
    storage.afterWrite = undefined;
    await db.query(
      "UPDATE pages SET visibility='private',private_owner_id='owner',revision=revision+1 WHERE id=$1",
      [root.id],
    );
  };
  expect(
    (await call('POST', `/api/pages/${root.id}/templates`, { requestId: 'revoked-source-copy' }))
      .statusCode,
  ).toBe(403);
  expect(await count()).toBe(before);
  expect(storage.files.size).toBe(blobs);
});

test('copy commands enforce the captured identity and current editing role', async () => {
  const root = await new Pages(db).create(actor, 'studio', { title: 'Copy scope source' });
  expect(
    (
      await call(
        'POST',
        `/api/pages/${root.id}/templates`,
        { requestId: 'viewer-template-copy' },
        'viewer',
      )
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await call('POST', `/api/pages/${root.id}/templates`, {
        requestId: 'wrong-account-copy',
        expectedUserId: 'owner',
      })
    ).statusCode,
  ).toBe(409);
});

test('owned databases, saved views and record relations clone while external databases stay linked', async () => {
  const pages = new Pages(db),
    databases = new Databases(db);
  const root = await pages.create(actor, 'studio', { title: 'Connected template source' }),
    owned = await pages.create(actor, 'studio', {
      title: 'Owned tracker',
      kind: 'database',
      parentId: root.id,
    }),
    external = await pages.create(actor, 'studio', { title: 'External tracker', kind: 'database' });
  const fields = [
    { id: 'status', name: 'Status', type: 'select' as const, options: ['Draft', 'Ready'] },
    { id: 'related', name: 'Related', type: 'relation' as const },
  ];
  await databases.setFields(actor, owned.id, fields);
  const first = await databases.createRecord(actor, owned.id, {
      title: 'First',
      values: { status: 'Draft' },
    }),
    second = await databases.createRecord(actor, owned.id, {
      title: 'Second',
      values: { status: 'Ready', related: first.pageId },
    });
  await databases.updateRecord(actor, owned.id, first.pageId, {
    revision: first.revision,
    values: { related: second.pageId },
  });
  await databases.saveView(actor, owned.id, 'By status', { layout: 'board', groupBy: 'status' });
  await content(root.id, {
    type: 'doc',
    content: [
      { type: 'databaseView', attrs: { databaseId: owned.id } },
      { type: 'databaseView', attrs: { databaseId: external.id } },
    ],
  });
  const saved = await call('POST', `/api/pages/${root.id}/templates`, {
    requestId: 'save-connected-tree',
    title: 'Connected starter',
  });
  expect(saved.statusCode).toBe(200);
  const created = await call('POST', `/api/templates/${saved.json().id}/instances`, {
    requestId: 'use-connected-tree',
  });
  expect(created.statusCode).toBe(200);
  const [copiedDB] = await db.query<{ id: string }>(
    "SELECT id FROM pages WHERE parent_id=$1 AND kind='database'",
    [created.json().id],
  );
  expect(copiedDB.id).not.toBe(owned.id);
  const copiedRecords = (await databases.records(actor, copiedDB.id)).records;
  const copiedFirst = copiedRecords.find((record) => record.title === 'First')!,
    copiedSecond = copiedRecords.find((record) => record.title === 'Second')!;
  expect(copiedFirst.values.related).toBe(copiedSecond.pageId);
  expect(copiedSecond.values.related).toBe(copiedFirst.pageId);
  expect((await databases.definition(actor, copiedDB.id)).views).toMatchObject([
    { name: 'By status', config: { layout: 'board', groupBy: 'status' } },
  ]);
  expect(
    allNodes(await content(created.json().id))
      .filter((node) => node.type === 'databaseView')
      .map((node) => node.attrs?.databaseId),
  ).toEqual([copiedDB.id, external.id]);
});

test('workspace transfer retains template identity and remaps its database reference and defaults', async () => {
  const transfer = new Transfer(db, storage),
    archive = await transfer.exportWorkspace(actor, 'studio'),
    destination = await new Access(db).createWorkspace(actor, 'Restored template workspace');
  let progress = await transfer.beginImport(actor, destination.id, archive);
  for (let index = 0; index < 100 && !progress.complete; index++)
    progress = await transfer.advance(actor, progress.jobId);
  expect(progress.complete).toBe(true);
  const pages = await new Access(db).visiblePages(actor, destination.id),
    recordTemplate = pages.find((page) => page.title === 'Interview starter')!,
    liveDB = pages.find((page) => page.title === 'Live research')!;
  expect(recordTemplate.templateRootId).toBe(recordTemplate.id);
  expect(recordTemplate.templateDatabaseId).toBe(liveDB.id);
  const copied = await call('POST', `/api/templates/${recordTemplate.id}/instances`, {
    requestId: 'use-restored-record-template',
  });
  expect(copied.statusCode).toBe(200);
  expect(copied.json().parentId).toBe(liveDB.id);
  const tree = pages.find((page) => page.title === 'Connected starter')!;
  expect(tree.templateRootId).toBe(tree.id);
  const descendants = pages.filter((page) => page.parentId === tree.id);
  expect(descendants.every((page) => page.templateRootId === tree.id)).toBe(true);
});

test('source changes during staging abort atomically and the same intent can retry the latest source', async () => {
  const root = await new Pages(db).create(actor, 'studio', { title: 'Changing copy source' }),
    file = await new Attachments(db, storage).begin(actor, root.id, {
      filename: 'source.txt',
      mediaType: 'text/plain',
      size: 5,
    });
  await new Attachments(db, storage).upload(actor, file.id, Buffer.from('proof'));
  const before = Number(
      (await db.query<{ count: string }>('SELECT count(*)::text AS count FROM pages'))[0].count,
    ),
    blobs = storage.files.size;
  storage.afterWrite = async () => {
    storage.afterWrite = undefined;
    await content(root.id, body('Changed during staging'));
  };
  const first = await call('POST', `/api/pages/${root.id}/templates`, {
    requestId: 'changed-source-retry',
  });
  expect(first.statusCode).toBe(409);
  expect(storage.files.size).toBe(blobs);
  expect(
    Number(
      (await db.query<{ count: string }>('SELECT count(*)::text AS count FROM pages'))[0].count,
    ),
  ).toBe(before);
  const retry = await call('POST', `/api/pages/${root.id}/templates`, {
    requestId: 'changed-source-retry',
  });
  expect(retry.statusCode).toBe(200);
  expect(JSON.stringify(await content(retry.json().id))).toContain('Changed during staging');
});

test('overlapping identical copy intents publish one tree and remove the losing staged files', async () => {
  const root = await new Pages(db).create(actor, 'studio', { title: 'Concurrent copy source' }),
    attachment = new Attachments(db, storage),
    file = await attachment.begin(actor, root.id, {
      filename: 'source.txt',
      mediaType: 'text/plain',
      size: 5,
    });
  await attachment.upload(actor, file.id, Buffer.from('proof'));
  const blobs = storage.files.size;
  let arrived!: () => void, release!: () => void;
  const waiting = new Promise<void>((resolve) => {
      arrived = resolve;
    }),
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
  storage.afterWrite = async () => {
    storage.afterWrite = undefined;
    arrived();
    await gate;
  };
  const first = call('POST', `/api/pages/${root.id}/templates`, {
    requestId: 'overlapping-copy-intent',
  });
  try {
    await waiting;
    const second = await call('POST', `/api/pages/${root.id}/templates`, {
      requestId: 'overlapping-copy-intent',
    });
    expect(second.statusCode).toBe(200);
    release();
    const result = await first;
    expect(result.statusCode).toBe(200);
    expect(result.json().id).toBe(second.json().id);
    expect(storage.files.size).toBe(blobs + 1);
  } finally {
    release();
    storage.afterWrite = undefined;
  }
});

test('new empty templates are editable canonical documents and do not appear in ordinary navigation', async () => {
  const created = await call('POST', '/api/workspaces/studio/templates', {
    requestId: 'new-empty-template',
    title: 'New reusable model',
    visibility: 'private',
  });
  expect(created.statusCode).toBe(200);
  expect(created.json()).toMatchObject({
    templateRootId: created.json().id,
    kind: 'document',
    visibility: 'private',
  });
  const retry = await call('POST', '/api/workspaces/studio/templates', {
    requestId: 'new-empty-template',
    title: 'New reusable model',
    visibility: 'private',
  });
  expect(retry.json().id).toBe(created.json().id);
  await content(created.json().id, body('User-authored template blocks'));
  expect(JSON.stringify(await content(created.json().id))).toContain(
    'User-authored template blocks',
  );
  const navigation = await call('GET', '/api/workspaces/studio/navigation');
  expect(navigation.json().pages.map((page: { id: string }) => page.id)).not.toContain(
    created.json().id,
  );
});
