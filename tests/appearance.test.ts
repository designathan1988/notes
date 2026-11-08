import { afterAll, beforeAll, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { fixture, rawPage } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import type { Auth } from '../apps/server/src/identity/auth.js';
import { createApp } from '../apps/server/src/app.js';

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
const read = (user = 'editor') =>
  app.inject({
    method: 'GET',
    url: '/api/preferences/appearance',
    headers: { 'x-test-user': user },
  });
const write = (payload: Record<string, unknown>, user = 'editor') =>
  app.inject({
    method: 'PATCH',
    url: '/api/preferences/appearance',
    payload,
    headers: { 'x-note-request': '1', 'x-test-user': user },
  });

test('appearance belongs to an account, accepts individual arbitrary fonts and CSS, and resets without copying defaults', async () => {
  expect((await read()).json()).toEqual({ revision: 0, overrides: {} });
  const overrides = {
    interfaceFont: 'Arial',
    bodyFont: 'Georgia',
    headingFont: 'Custom display',
    codeFont: 'Consolas',
    background: '#151515',
    text: '#eeeeee',
    accent: 'oklch(70% 0.12 240)',
    density: 0.9,
    fonts: [{ family: 'Custom display', url: 'https://example.com/display.woff2' }],
    customCss: '.workbench-tab { border-radius: 0; }',
  };
  const saved = await write({ revision: 0, overrides });
  expect(saved.statusCode).toBe(200);
  expect((await read()).json()).toEqual({ revision: 1, overrides });
  expect((await read('owner')).json()).toEqual({ revision: 0, overrides: {} });
  expect((await write({ revision: 1, overrides: {} })).json()).toEqual({
    revision: 2,
    overrides: {},
  });
});

test('stale windows and invalid appearance never silently overwrite the persisted preference', async () => {
  expect(
    (await write({ revision: 0, overrides: { bodyFont: 'Georgia' } }, 'owner')).statusCode,
  ).toBe(200);
  expect((await write({ revision: 0, overrides: { bodyFont: 'Arial' } }, 'owner')).statusCode).toBe(
    409,
  );
  for (const overrides of [
    { density: 0 },
    { bodySize: 1000 },
    { fonts: [{ family: 'Bad', url: 'javascript:alert(1)' }] },
    { unknown: true },
  ]) {
    expect((await write({ revision: 1, overrides }, 'owner')).statusCode).toBe(400);
  }
  expect((await read('owner')).json()).toEqual({ revision: 1, overrides: { bodyFont: 'Georgia' } });
});

test('page appearance uses the existing metadata revision and permission owner', async () => {
  const id = await rawPage(db);
  const patch = (user: string, revision: number, appearance: unknown) =>
    app.inject({
      method: 'PATCH',
      url: `/api/pages/${id}`,
      headers: { 'x-note-request': '1', 'x-test-user': user },
      payload: { revision, appearance },
    });
  expect((await patch('viewer', 1, { bodyFont: 'Georgia' })).statusCode).toBe(403);
  const saved = await patch('editor', 1, {
    bodyFont: 'Georgia',
    bodySize: 20,
    customCss: '.page-title { letter-spacing: 0; }',
  });
  expect(saved.statusCode).toBe(200);
  expect(saved.json()).toMatchObject({
    revision: 2,
    appearance: { bodyFont: 'Georgia', bodySize: 20 },
  });
  expect((await patch('editor', 1, {})).statusCode).toBe(409);
  expect((await patch('editor', 2, {})).json()).toMatchObject({ revision: 3, appearance: {} });
});
