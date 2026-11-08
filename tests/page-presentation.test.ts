import { afterAll, beforeAll, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { fixture, rawPage } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import type { Auth } from '../apps/server/src/identity/auth.js';
import { createApp } from '../apps/server/src/app.js';
import { Knowledge } from '../apps/server/src/knowledge/service.js';

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
const patch = (id: string, payload: Record<string, unknown>, user = 'editor') =>
  app.inject({
    method: 'PATCH',
    url: `/api/pages/${id}`,
    payload,
    headers: { 'x-note-request': '1', 'x-test-user': user },
  });
const get = (id: string, user = 'editor') =>
  app.inject({ method: 'GET', url: `/api/pages/${id}`, headers: { 'x-test-user': user } });

test('page presentation persists with one metadata revision and normalized searchable tags', async () => {
  const id = await rawPage(db, { title: 'Presentation fixture' });
  const saved = await patch(id, {
    revision: 1,
    icon: '🧭',
    cover: { type: 'color', color: '#e9e4db' },
    tags: ['  Field research ', 'field RESEARCH', 'Insight'],
  });
  expect(saved.statusCode).toBe(200);
  expect(saved.json()).toMatchObject({
    icon: '🧭',
    cover: { type: 'color', color: '#e9e4db' },
    tags: ['field research', 'insight'],
    revision: 2,
  });
  expect((await get(id)).json()).toEqual(saved.json());
  expect((await patch(id, { revision: 1, icon: '📚' })).statusCode).toBe(409);
  const knowledge = new Knowledge(db);
  await knowledge.projectLatest(id);
  expect(
    (await knowledge.search({ userId: 'editor' }, 'studio', 'insight')).results.map(
      (page) => page.id,
    ),
  ).toContain(id);
  const filtered = await app.inject({
    method: 'GET',
    url: '/api/workspaces/studio/search?q=&tag=field%20research',
    headers: { 'x-test-user': 'editor' },
  });
  expect(filtered.json().results.map((page: { id: string }) => page.id)).toEqual([id]);
});

test('invalid presentation values are rejected atomically', async () => {
  const id = await rawPage(db);
  for (const payload of [
    { icon: 'not an icon' },
    { icon: '\u0000' },
    { tags: 'a tag' },
    { tags: [4] },
    { tags: ['bad\u0000tag'] },
    { cover: { type: 'color', color: 'url(javascript:alert(1))' } },
    { cover: { type: 'image', attachmentId: 'missing', positionY: 101 } },
  ]) {
    expect((await patch(id, { ...payload, revision: 1, title: 'Must not save' })).statusCode).toBe(
      400,
    );
  }
  expect((await get(id)).json()).toMatchObject({
    title: 'A note',
    revision: 1,
    icon: null,
    cover: null,
    tags: [],
  });
});

test('covers must be ready image attachments owned by the page', async () => {
  const id = await rawPage(db),
    other = await rawPage(db);
  await db.query(
    "INSERT INTO attachments (id,page_id,filename,media_type,size,object_key,status) VALUES ('cover-ready',$1,'cover.png','image/png',10,'cover-ready','ready'),('cover-pending',$1,'pending.png','image/png',10,'cover-pending','pending'),('cover-foreign',$2,'foreign.png','image/png',10,'cover-foreign','ready'),('cover-html',$1,'cover.html','text/html',10,'cover-html','ready')",
    [id, other],
  );
  for (const attachmentId of ['cover-pending', 'cover-foreign', 'cover-html'])
    expect(
      (await patch(id, { revision: 1, cover: { type: 'image', attachmentId, positionY: 50 } }))
        .statusCode,
    ).toBe(400);
  const saved = await patch(id, {
    revision: 1,
    cover: { type: 'image', attachmentId: 'cover-ready', positionY: 32 },
  });
  expect(saved.statusCode).toBe(200);
  expect(saved.json().cover).toEqual({ type: 'image', attachmentId: 'cover-ready', positionY: 32 });
  expect((await patch(id, { revision: 2, cover: null })).json().cover).toBeNull();
});

test('presentation and tag discovery honor private ancestry and fresh editing permissions', async () => {
  const id = await rawPage(db, { creator: 'editor', visibility: 'private' });
  expect((await patch(id, { revision: 1, tags: ['confidential-secret-tag'] })).statusCode).toBe(
    200,
  );
  expect((await get(id, 'owner')).statusCode).toBe(403);
  expect((await patch(id, { revision: 2, icon: '🔒' }, 'owner')).statusCode).toBe(403);
  const shared = await rawPage(db);
  expect((await patch(shared, { revision: 1, icon: '📚' }, 'viewer')).statusCode).toBe(403);
  const hidden = await app.inject({
    method: 'GET',
    url: '/api/workspaces/studio/search?q=&tag=confidential-secret-tag',
    headers: { 'x-test-user': 'owner' },
  });
  expect(hidden.json().results).toEqual([]);
});
