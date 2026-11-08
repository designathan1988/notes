import { afterAll, beforeAll, expect, test } from 'vitest';
import * as Y from 'yjs';
import type { FastifyInstance } from 'fastify';
import { fixture, rawPage } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import type { Auth } from '../apps/server/src/identity/auth.js';
import { createApp } from '../apps/server/src/app.js';
import { Documents } from '../apps/server/src/documents/service.js';
import { documentFromJSON, documentJSON } from '../packages/editor/src/schema.js';

let db: Database, app: FastifyInstance;
beforeAll(async () => {
  db = await fixture();
  // Authentication is the boundary here; real page/workspace authorization is exercised below.
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
const request = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object, user = 'owner') =>
  app.inject({ method, url, payload, headers: { 'x-note-request': '1', 'x-test-user': user } });

test('discussion replies and resolution survive rereading and stale resolutions cannot win', async () => {
  const page = await rawPage(db);
  const created = await request('POST', `/api/pages/${page}/discussions`, {
    body: 'What evidence supports this?',
    quote: 'A working hypothesis',
  });
  expect(created.statusCode).toBe(200);
  const thread = created.json();
  const reply = await request(
    'POST',
    `/api/pages/${page}/discussions/${thread.id}/messages`,
    { body: 'Three interviews.' },
    'editor',
  );
  expect(reply.statusCode).toBe(200);
  const messages = (
    await request('GET', `/api/pages/${page}/discussions/${thread.id}/messages`)
  ).json();
  expect(
    messages.messages.map((message: { body: string; authorName: string }) => [
      message.body,
      message.authorName,
    ]),
  ).toEqual([
    ['What evidence supports this?', 'owner'],
    ['Three interviews.', 'editor'],
  ]);
  const resolved = await request(
    'PATCH',
    `/api/pages/${page}/discussions/${thread.id}`,
    { resolved: true, revision: 1 },
    'editor',
  );
  expect(resolved.statusCode).toBe(200);
  expect(
    (
      await request('PATCH', `/api/pages/${page}/discussions/${thread.id}`, {
        resolved: false,
        revision: 1,
      })
    ).statusCode,
  ).toBe(409);
  const list = (await request('GET', `/api/pages/${page}/discussions?resolved=true`)).json();
  expect(list.threads[0]).toMatchObject({
    id: thread.id,
    resolved: true,
    revision: 2,
    messageCount: 2,
    quote: 'A working hypothesis',
  });
  expect(
    (
      await request('PATCH', `/api/pages/${page}/discussions/${thread.id}`, {
        resolved: false,
        revision: 2,
      })
    ).json().resolved,
  ).toBe(false);
});

test('discussion enforces current page access, typed input and thread/page ownership', async () => {
  const page = await rawPage(db),
    other = await rawPage(db),
    privatePage = await rawPage(db, { visibility: 'private' });
  const thread = (
    await request('POST', `/api/pages/${page}/discussions`, { body: 'Original' })
  ).json();
  expect
    .soft(
      (
        await request('POST', `/api/pages/${page}/discussions`, {
          body: 'Typed text',
          quote: 'Invalid\0context',
        })
      ).statusCode,
    )
    .toBe(400);
  expect
    .soft(
      (await request('POST', `/api/pages/${page}/history`, { label: 'Invalid\0name' })).statusCode,
    )
    .toBe(400);
  expect(
    (await request('POST', `/api/pages/${page}/discussions`, { body: 'No' }, 'viewer')).statusCode,
  ).toBe(403);
  expect(
    (await request('GET', `/api/pages/${privatePage}/discussions`, undefined, 'editor')).statusCode,
  ).toBe(403);
  expect(
    (await request('GET', `/api/pages/${page}/discussions`, undefined, 'outsider')).statusCode,
  ).toBe(403);
  expect(
    (await request('POST', `/api/pages/${page}/discussions`, { body: { unsafe: 'input' } }))
      .statusCode,
  ).toBe(400);
  expect(
    (
      await request('POST', `/api/pages/${other}/discussions/${thread.id}/messages`, {
        body: 'Wrong owner',
      })
    ).statusCode,
  ).toBe(404);
  await db.query("DELETE FROM member WHERE organization_id='studio' AND user_id='editor'");
  expect(
    (
      await request(
        'POST',
        `/api/pages/${page}/discussions/${thread.id}/messages`,
        { body: 'Revoked' },
        'editor',
      )
    ).statusCode,
  ).toBe(403);
  await db.query(
    "INSERT INTO member (id,organization_id,user_id,role) VALUES ('editor','studio','editor','editor')",
  );
});

async function replaceBody(page: string, body: string) {
  const current = await new Documents(db).load(page),
    source = documentFromJSON({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }],
    });
  const root = current.getXmlFragment('default');
  root.delete(0, root.length);
  root.insert(
    0,
    source
      .getXmlFragment('default')
      .toArray()
      .map((node) => {
        if (node instanceof Y.XmlElement || node instanceof Y.XmlText) return node.clone();
        throw new Error('Unexpected test node');
      }),
  );
  await new Documents(db).save({ userId: 'owner' }, page, Y.encodeStateAsUpdate(current), 1);
  current.destroy();
  source.destroy();
}
test('history preview is immutable and restoration creates a durable edit with a recoverable previous version', async () => {
  const page = await rawPage(db);
  await replaceBody(page, 'First durable version');
  const created = await request('POST', `/api/pages/${page}/history`, { label: 'Before review' });
  expect(created.statusCode).toBe(200);
  const checkpoint = created.json();
  await replaceBody(page, 'Second durable version');
  const preview = (await request('GET', `/api/pages/${page}/history/${checkpoint.id}`)).json();
  expect(preview.content.content[0].content[0].text).toBe('First durable version');
  expect(JSON.stringify(documentJSON(await new Documents(db).load(page)))).toContain(
    'Second durable version',
  );
  const history = (await request('GET', `/api/pages/${page}/history`)).json();
  const restored = await request('POST', `/api/pages/${page}/history/${checkpoint.id}/restore`, {
    version: history.version,
  });
  expect(restored.statusCode).toBe(200);
  expect(restored.json().version).toBeGreaterThan(history.version);
  expect(JSON.stringify(documentJSON(await new Documents(db).load(page)))).toContain(
    'First durable version',
  );
  const after = (await request('GET', `/api/pages/${page}/history`)).json();
  const preserved = after.entries.find(
    (entry: { kind: string }) => entry.kind === 'before-restore',
  );
  expect(preserved).toBeTruthy();
  expect(
    JSON.stringify(
      (await request('GET', `/api/pages/${page}/history/${preserved.id}`)).json().content,
    ),
  ).toContain('Second durable version');
  expect(
    (await request('GET', `/api/pages/${page}/history/${checkpoint.id}`)).json().content,
  ).toEqual(preview.content);
  const stale = documentFromJSON({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Offline work before restore' }] },
    ],
  });
  try {
    await expect(
      new Documents(db).save({ userId: 'editor' }, page, Y.encodeStateAsUpdate(stale), 1),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  } finally {
    stale.destroy();
  }
});

test('history rejects stale restores and freshly revoked or read-only identities without altering the document', async () => {
  const page = await rawPage(db);
  await replaceBody(page, 'Retain me');
  const checkpoint = (
    await request('POST', `/api/pages/${page}/history`, { label: 'Snapshot' })
  ).json();
  const history = (await request('GET', `/api/pages/${page}/history`)).json();
  await replaceBody(page, 'Newer work');
  expect(
    (
      await request('POST', `/api/pages/${page}/history/${checkpoint.id}/restore`, {
        version: history.version,
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (await request('POST', `/api/pages/${page}/history`, { label: 'No' }, 'viewer')).statusCode,
  ).toBe(403);
  expect(
    (await request('GET', `/api/pages/${page}/history/${checkpoint.id}`, undefined, 'outsider'))
      .statusCode,
  ).toBe(403);
  await db.query(
    "UPDATE member SET role='viewer' WHERE user_id='editor' AND organization_id='studio'",
  );
  expect(
    (
      await request(
        'POST',
        `/api/pages/${page}/history/${checkpoint.id}/restore`,
        { version: history.version + 1 },
        'editor',
      )
    ).statusCode,
  ).toBe(403);
  expect(JSON.stringify(documentJSON(await new Documents(db).load(page)))).toContain('Newer work');
  await db.query(
    "UPDATE member SET role='editor' WHERE user_id='editor' AND organization_id='studio'",
  );
});

test('a failed pre-restore snapshot rolls back restoration and ordinary edits still persist when history storage is full', async () => {
  const page = await rawPage(db);
  await replaceBody(page, 'Checkpoint body');
  const checkpoint = (
    await request('POST', `/api/pages/${page}/history`, { label: 'Safe point' })
  ).json();
  await replaceBody(page, 'Keep this body');
  await db.query(
    "INSERT INTO beta_entitlements (workspace_id,storage_limit) VALUES ('studio',0) ON CONFLICT(workspace_id) DO UPDATE SET storage_limit=0",
  );
  try {
    const history = (await request('GET', `/api/pages/${page}/history`)).json();
    expect(
      (
        await request('POST', `/api/pages/${page}/history/${checkpoint.id}/restore`, {
          version: history.version,
        })
      ).statusCode,
    ).toBe(413);
    expect((await request('GET', `/api/pages/${page}/history`)).json().entries).toHaveLength(
      history.entries.length,
    );
    await replaceBody(page, 'Continue writing');
    const fresh = await rawPage(db);
    await replaceBody(fresh, 'New note while history storage is full');
    expect((await request('GET', `/api/pages/${fresh}/history`)).json().entries).toEqual([]);
    expect(JSON.stringify(documentJSON(await new Documents(db).load(fresh)))).toContain(
      'New note while history storage is full',
    );
    expect(JSON.stringify(documentJSON(await new Documents(db).load(page)))).toContain(
      'Continue writing',
    );
  } finally {
    await db.query(
      "UPDATE beta_entitlements SET storage_limit=1073741824 WHERE workspace_id='studio'",
    );
  }
});

test('long discussions show the latest replies and paginate earlier messages in chronological order', async () => {
  const page = await rawPage(db),
    thread = (await request('POST', `/api/pages/${page}/discussions`, { body: 'Original' })).json();
  await db.query("UPDATE discussion_messages SET created_at='2020-01-01' WHERE thread_id=$1", [
    thread.id,
  ]);
  await db.query(
    `INSERT INTO discussion_messages (id,thread_id,author_id,body,created_at)
    SELECT $1||':'||i,$1,'editor','Reply '||i,'2020-01-01'::timestamptz+i*interval '1 second' FROM generate_series(1,55) i`,
    [thread.id],
  );
  const current = (
    await request('GET', `/api/pages/${page}/discussions/${thread.id}/messages`)
  ).json();
  expect(current.messages[0].body).toBe('Reply 6');
  expect(current.messages.at(-1).body).toBe('Reply 55');
  expect(current.hasMore).toBe(true);
  const earlier = (
    await request('GET', `/api/pages/${page}/discussions/${thread.id}/messages?offset=50`)
  ).json();
  expect(earlier.messages.map((message: { body: string }) => message.body)).toEqual([
    'Original',
    'Reply 1',
    'Reply 2',
    'Reply 3',
    'Reply 4',
    'Reply 5',
  ]);
  expect(earlier.hasMore).toBe(false);
});

test('saved versions and attachments use the same workspace storage allowance', async () => {
  const page = await rawPage(db);
  await replaceBody(page, 'Storage allocation');
  const [usage] = await db.query<{ used: string }>(
    `SELECT coalesce(sum(octet_length(c.state)),0)::text AS used FROM document_checkpoints c JOIN pages p ON p.id=c.page_id WHERE p.workspace_id='studio'`,
  );
  await db.query(
    "INSERT INTO beta_entitlements (workspace_id,storage_limit) VALUES ('studio',$1) ON CONFLICT(workspace_id) DO UPDATE SET storage_limit=$1",
    [Number(usage.used) + 10],
  );
  try {
    expect(
      (
        await request('POST', `/api/pages/${page}/attachments`, {
          filename: 'overflow.txt',
          mediaType: 'text/plain',
          size: 20,
        })
      ).statusCode,
    ).toBe(413);
  } finally {
    await db.query(
      "UPDATE beta_entitlements SET storage_limit=1073741824 WHERE workspace_id='studio'",
    );
  }
});

test('legacy checkpoints without version metadata are identified as unknown versions', async () => {
  const page = await rawPage(db),
    doc = documentFromJSON({ type: 'doc', content: [{ type: 'paragraph' }] });
  try {
    await db.query('INSERT INTO document_checkpoints (id,page_id,state) VALUES ($1,$2,$3)', [
      page + ':legacy',
      page,
      Buffer.from(Y.encodeStateAsUpdate(doc)),
    ]);
  } finally {
    doc.destroy();
  }
  const history = (await request('GET', `/api/pages/${page}/history`)).json();
  expect(history.entries[0].version).toBe(0);
});
