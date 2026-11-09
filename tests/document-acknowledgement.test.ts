import { afterAll, beforeAll, expect, test } from 'vitest';
import { fixture, rawPage } from './helpers.js';
import { createApp } from '../apps/server/src/app.js';
import type { Database } from '../apps/server/src/platform/database.js';
import type { Auth } from '../apps/server/src/identity/auth.js';
let db: Database;
let app: Awaited<ReturnType<typeof createApp>>;
beforeAll(async () => {
  db = await fixture();
  const auth = {
    api: {
      getSession: async ({ headers }: { headers: Headers }) => ({
        user: { id: headers.get('x-test-user') ?? 'owner' },
      }),
    },
  } as unknown as Auth;
  app = await createApp({ db, auth });
});
afterAll(async () => {
  await app.close();
  await db.close();
});
test('the durable document snapshot is readable only by authorized identities', async () => {
  const id = await rawPage(db);
  const response = await app.inject({ url: `/api/pages/${id}/document/acknowledgement` });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({ type: 'durable', pageId: id, generation: 1 });
  expect(response.json().snapshot).toBeTruthy();
  const denied = await app.inject({
    url: `/api/pages/${id}/document/acknowledgement`,
    headers: { 'x-test-user': 'outsider' },
  });
  expect(denied.statusCode).toBe(403);
  expect(denied.json()).not.toHaveProperty('snapshot');
});
