import { afterAll, beforeAll, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { fixture, rawPage } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import type { Auth } from '../apps/server/src/identity/auth.js';
import { createApp } from '../apps/server/src/app.js';
import { Documents } from '../apps/server/src/documents/service.js';
import { documentJSON } from '@note/editor/schema';
import { documentFromJSON } from '@note/editor/schema';
import { Pages } from '../apps/server/src/pages/service.js';

let db: Database, app: FastifyInstance;
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
const request = (payload: Record<string, unknown>, user = 'editor') =>
  app.inject({
    method: 'POST',
    url: '/api/workspaces/studio/pages',
    payload: {
      ...payload,
      ...(payload.purpose === 'recovery' && !('expectedUserId' in payload)
        ? { expectedUserId: user }
        : {}),
    },
    headers: { 'x-note-request': '1', 'x-test-user': user },
  });
const content = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

test('content instantiation creates a durable independent private recovery page', async () => {
  const source = content('Retained local contribution');
  const created = await request({
    title: 'Recovered notes',
    content: source,
    purpose: 'recovery',
    requestId: 'recovery-private-copy',
    visibility: 'workspace',
  });
  expect(created.statusCode).toBe(200);
  const page = created.json();
  expect(page).toMatchObject({
    visibility: 'private',
    accessOwnerId: 'editor',
    parentId: null,
    kind: 'document',
  });
  const doc = await new Documents(db).load(page.id);
  try {
    expect(documentJSON(doc)).toEqual(source);
  } finally {
    doc.destroy();
  }
  expect(
    (
      await app.inject({
        method: 'GET',
        url: `/api/pages/${page.id}`,
        headers: { 'x-test-user': 'owner' },
      })
    ).statusCode,
  ).toBe(403);
});

test('an identical instantiation command reopens the same page while a changed payload conflicts', async () => {
  const payload = {
    title: 'Recovered once',
    content: content('One durable copy'),
    purpose: 'recovery',
    requestId: 'recovery-once',
  };
  const first = await request(payload),
    second = await request(payload);
  expect(first.statusCode).toBe(200);
  expect(second.statusCode).toBe(200);
  expect(second.json().id).toBe(first.json().id);
  expect(
    (await request({ ...payload, content: content('Different local state') })).statusCode,
  ).toBe(409);
  const [count] = await db.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM pages WHERE title='Recovered once'",
  );
  expect(Number(count.count)).toBe(1);
});

test('invalid content and unsafe recovery placement cannot create an empty or shared page', async () => {
  const parent = await rawPage(db);
  for (const patch of [
    { content: { type: 'doc', content: [{ type: 'unknown-node' }] } },
    { content: null },
    { content: content('Must stay private'), parentId: parent },
    { content: content('Missing operation identity'), requestId: '' },
  ]) {
    const response = await request({
      title: 'Rejected instantiation',
      purpose: 'recovery',
      requestId: 'invalid-recovery',
      ...patch,
    });
    expect(response.statusCode).toBe(400);
  }
  const [count] = await db.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM pages WHERE title='Rejected instantiation'",
  );
  expect(Number(count.count)).toBe(0);
});

test('instantiation and idempotent replay both enforce fresh workspace permissions', async () => {
  const payload = {
    title: 'Permission scoped copy',
    content: content('Private content'),
    purpose: 'recovery',
    requestId: 'recovery-permissions',
  };
  expect((await request(payload, 'viewer')).statusCode).toBe(403);
  expect((await request(payload)).statusCode).toBe(200);
  await db.query("DELETE FROM member WHERE user_id='editor' AND organization_id='studio'");
  try {
    expect((await request(payload)).statusCode).toBe(403);
  } finally {
    await db.query(
      "INSERT INTO member(id,user_id,organization_id,role) VALUES ('editor','editor','studio','editor')",
    );
  }
});

test('recovery refuses a local draft belonging to another signed-in identity', async () => {
  expect(
    (
      await request({
        title: 'Wrong account copy',
        content: content('Keep private'),
        purpose: 'recovery',
        requestId: 'recovery-account-change',
        expectedUserId: 'owner',
      })
    ).statusCode,
  ).toBe(409);
});

test('recovery retry after a source rename retains its original durable copy', async () => {
  const payload = {
    title: 'Recovered: Original source title',
    content: content('A draft independent of its source title'),
    purpose: 'recovery',
    requestId: 'recovery-renamed-source',
  };
  const first = await request(payload);
  expect(first.statusCode).toBe(200);
  const retry = await request({ ...payload, title: 'Recovered: Renamed source title' });
  expect(retry.statusCode).toBe(200);
  expect(retry.json().id).toBe(first.json().id);
});

test('recovery replay preserves an edited target and durably recreates the original draft', async () => {
  const payload = {
    title: 'Recovery receipt changed',
    content: content('Original retained contribution'),
    purpose: 'recovery',
    requestId: 'recovery-edited-target',
  };
  const first = (await request(payload)).json();
  const added = documentFromJSON(content('Later changes in the recovered page'));
  try {
    await new Documents(db).importContent({ userId: 'editor' }, first.id, added, first.generation);
  } finally {
    added.destroy();
  }
  const retry = await request(payload);
  expect(retry.statusCode).toBe(200);
  expect(retry.json().id).not.toBe(first.id);
  expect(retry.json()).toMatchObject({ visibility: 'private', parentId: null });
  const original = await new Documents(db).load(first.id),
    recovered = await new Documents(db).load(retry.json().id);
  try {
    expect(JSON.stringify(documentJSON(original))).toContain('Later changes in the recovered page');
    expect(documentJSON(recovered)).toEqual(payload.content);
  } finally {
    original.destroy();
    recovered.destroy();
  }
  expect((await request(payload)).json().id).toBe(retry.json().id);
});

test('recovery can recreate a previously trashed copy without reviving the discarded target', async () => {
  const payload = {
    title: 'Recovery receipt removed',
    content: content('Still retained on the device'),
    purpose: 'recovery',
    requestId: 'recovery-trashed-target',
  };
  const first = (await request(payload)).json();
  await new Pages(db).trash({ userId: 'editor' }, first.id);
  const retry = await request(payload);
  expect(retry.statusCode).toBe(200);
  expect(retry.json().id).not.toBe(first.id);
  expect(
    (
      await db.query<{ deleted_at: string }>('SELECT deleted_at FROM pages WHERE id=$1', [first.id])
    )[0].deleted_at,
  ).not.toBeNull();
});
