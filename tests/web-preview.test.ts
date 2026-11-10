import { beforeAll, afterAll, expect, test } from 'vitest';
import { fixture, rawPage } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import type { Storage } from '../apps/server/src/attachments/storage.js';
import { Documents } from '../apps/server/src/documents/service.js';
import { documentFromJSON } from '@note/editor/schema';
import { newWebContent, webSource, sourceFingerprint } from '@note/editor/web';
import { WebPreviews } from '../apps/server/src/web/service.js';
import { createWebRenderer } from '../apps/server/src/web/renderer.js';

let db: Database;
const storage: Storage = {
  read: async () => {
    throw new Error('No asset in this fixture.');
  },
  write: async () => {},
  remove: async () => {},
};
const configuration = {
  appOrigin: 'http://127.0.0.1:5173',
  originTemplate: 'http://preview-{token}.localhost:3002',
};
beforeAll(async () => {
  db = await fixture();
});
afterAll(async () => {
  await db.close();
});
async function site() {
  const id = await rawPage(db, { title: 'A full website' }),
    content = newWebContent(),
    doc = documentFromJSON(content);
  try {
    await new Documents(db).importContent({ userId: 'owner' }, id, doc, 1);
  } finally {
    doc.destroy();
  }
  return { id, fingerprint: await sourceFingerprint(webSource(content.content![0])) };
}
test('a preview derives its immutable source from the committed document and has a unique origin', async () => {
  const previews = new WebPreviews(db, storage, configuration),
    source = await site();
  const first = await previews.create({ userId: 'editor' }, source.id, {
    position: 0,
    fingerprint: source.fingerprint,
  });
  const second = await previews.create({ userId: 'editor' }, source.id, {
    position: 0,
    fingerprint: source.fingerprint,
  });
  expect(new URL(first.url).origin).not.toBe(new URL(second.url).origin);
  expect(new URL(first.url).origin).not.toBe(configuration.appOrigin);
  const read = await previews.read(first.token);
  expect(read.source.files.map((file) => file.path)).toEqual([
    'index.html',
    'styles.css',
    'main.js',
    'document.json',
  ]);
  expect(read.pageId).toBe(source.id);
  await expect(
    previews.create({ userId: 'editor' }, source.id, { position: 0, fingerprint: '0'.repeat(64) }),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  await expect(
    previews.create({ userId: 'outsider' }, source.id, {
      position: 0,
      fingerprint: source.fingerprint,
    }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
test('capability reads and renewals enforce current membership, generation and capability ownership', async () => {
  const previews = new WebPreviews(db, storage, configuration),
    source = await site();
  const ticket = await previews.create({ userId: 'viewer' }, source.id, {
    position: 0,
    fingerprint: source.fingerprint,
  });
  await expect(previews.renew({ userId: 'owner' }, ticket.token)).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
  await previews.renew({ userId: 'viewer' }, ticket.token);
  await db.query("DELETE FROM member WHERE user_id='viewer' AND organization_id='studio'");
  await expect(previews.read(ticket.token)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await db.query(
    "INSERT INTO member(id,user_id,organization_id,role) VALUES('viewer','viewer','studio','viewer')",
  );
  await db.query('UPDATE pages SET generation=generation+1 WHERE id=$1', [source.id]);
  await expect(previews.read(ticket.token)).rejects.toMatchObject({ code: 'CONFLICT' });
  const other = await site(),
    disposable = await previews.create({ userId: 'owner' }, other.id, {
      position: 0,
      fingerprint: other.fingerprint,
    });
  await previews.stop({ userId: 'owner' }, disposable.token);
  await expect(previews.read(disposable.token)).rejects.toMatchObject({ code: 'NOT_FOUND' });
});
test('an expired capability cannot be used and executable content cannot share the application site', async () => {
  const previews = new WebPreviews(db, storage, configuration),
    source = await site();
  const ticket = await previews.create({ userId: 'owner' }, source.id, {
    position: 0,
    fingerprint: source.fingerprint,
  });
  await db.query("UPDATE web_previews SET expires_at=now()-interval '1 second'");
  await expect(previews.read(ticket.token)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  for (const originTemplate of [
    'http://127.0.0.1:3002',
    'https://preview-{token}.app.example.com',
  ]) {
    expect(
      () =>
        new WebPreviews(db, storage, {
          appOrigin: originTemplate.includes('example')
            ? 'https://app.example.com'
            : configuration.appOrigin,
          originTemplate,
        }),
    ).toThrow();
  }
});

test('the separate renderer delivers real files, sandbox headers and no application API', async () => {
  const previews = new WebPreviews(db, storage, configuration),
    source = await site();
  const ticket = await previews.create({ userId: 'owner' }, source.id, {
    position: 0,
    fingerprint: source.fingerprint,
  });
  const renderer = createWebRenderer(previews),
    headers = { host: new URL(ticket.url).host };
  try {
    const html = await renderer.inject({ method: 'GET', url: '/', headers });
    expect(html.statusCode).toBe(200);
    expect(html.headers['content-type']).toContain('text/html');
    expect(html.headers['content-security-policy']).toContain(
      'sandbox allow-scripts allow-same-origin',
    );
    expect(html.headers['content-security-policy']).toContain(
      'frame-ancestors http://127.0.0.1:5173',
    );
    expect(html.headers['referrer-policy']).toBe('no-referrer');
    expect(html.body).toContain(`src="${new URL('/.note/runtime.js', ticket.url).href}"`);
    expect(html.body).toContain('src="./main.js"');
    expect(
      (await renderer.inject({ method: 'GET', url: '/main.js', headers })).headers['content-type'],
    ).toContain('text/javascript');
    expect(
      (await renderer.inject({ method: 'GET', url: '/styles.css', headers })).headers[
        'content-type'
      ],
    ).toContain('text/css');
    expect(
      (await renderer.inject({ method: 'GET', url: '/api/session', headers })).statusCode,
    ).toBe(404);
    expect(
      (await renderer.inject({ method: 'GET', url: '/', headers: { host: '127.0.0.1:3002' } }))
        .statusCode,
    ).toBe(404);
    expect(
      (await renderer.inject({ method: 'GET', url: '/.note/assets/not-owned', headers }))
        .statusCode,
    ).toBe(404);
    await previews.stop({ userId: 'owner' }, ticket.token);
    expect((await renderer.inject({ method: 'GET', url: '/main.js', headers })).statusCode).toBe(
      404,
    );
  } finally {
    await renderer.close();
  }
});
