import { afterAll, beforeAll, expect, test } from 'vitest';
import { fixture, rawPage } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import { Access } from '../apps/server/src/access/service.js';
import { createApp } from '../apps/server/src/app.js';
let db: Database;
let access: Access;
beforeAll(async () => {
  db = await fixture();
  access = new Access(db);
});
afterAll(async () => {
  await db.close();
});
test('denies cross-workspace access and viewer writes', async () => {
  const id = await rawPage(db);
  await expect(access.requirePage({ userId: 'outsider' }, id, 'read')).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  await expect(access.requirePage({ userId: 'viewer' }, id, 'write')).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  expect((await access.requirePage({ userId: 'editor' }, id, 'write')).id).toBe(id);
});
test('hides private subtrees even from workspace administrators', async () => {
  const root = await rawPage(db, { visibility: 'private' });
  const child = await rawPage(db, { parent: root });
  await expect(access.requirePage({ userId: 'admin' }, child, 'read')).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  expect((await access.requirePage({ userId: 'owner' }, child, 'read')).id).toBe(child);
});
test('prevents removal or downgrade of the final owner', async () => {
  await expect(
    access.changeRole({ userId: 'owner' }, 'studio', 'owner', 'editor'),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  await expect(
    access.changeRole({ userId: 'admin' }, 'studio', 'owner', null),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
test('actual Better Auth cookie establishes an authenticated session', async () => {
  const app = await createApp({ db });
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { origin: 'http://127.0.0.1:5173' },
    payload: { name: 'Real account', email: 'actual@note.test', password: 'a-long-test-password' },
  });
  expect(response.statusCode).toBe(200);
  const setCookie = response.headers['set-cookie'];
  const cookie = (Array.isArray(setCookie) ? setCookie : [setCookie])
    .map((value) => value?.split(';')[0])
    .join('; ');
  const session = await app.inject({
    method: 'GET',
    url: '/api/auth/get-session',
    headers: { cookie },
  });
  expect(session.json().user.email).toBe('actual@note.test');
  await app.close();
});
