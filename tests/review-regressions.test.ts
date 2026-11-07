import { afterEach, beforeEach, expect, test } from 'vitest';
import { fixture } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import { Access } from '../apps/server/src/access/service.js';
import { Pages } from '../apps/server/src/pages/service.js';
import { Databases } from '../apps/server/src/databases/service.js';
let db: Database;
const owner = { userId: 'owner' },
  editor = { userId: 'editor' };
beforeEach(async () => {
  db = await fixture();
});
afterEach(async () => {
  await db.close();
});
test('detaching a private subtree preserves its effective owner without changing authorship', async () => {
  const pages = new Pages(db);
  const root = await pages.create(owner, 'studio', {
    title: 'Confidential',
    visibility: 'private',
  });
  const shared = await pages.create(editor, 'studio', { title: 'Originally shared' });
  const hidden = await pages.move(owner, shared.id, root.id, shared.revision, true);
  const detached = await pages.move(owner, shared.id, null, hidden.revision, false);
  expect((await pages.get(owner, detached.id)).createdBy).toBe(editor.userId);
  await expect(pages.get(editor, detached.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
test.each(['rename', 'trash'] as const)(
  'revocation committed before the %s transaction prevents the mutation',
  async (command) => {
    const pages = new Pages(db);
    const note = await pages.create(editor, 'studio', { title: 'Keep original' });
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>((resolve) => (enter = resolve));
    const gate = new Promise<void>((resolve) => (release = resolve));
    const delayed: Database = {
      ...db,
      transaction: async (fn) => {
        enter();
        await gate;
        return db.transaction(fn);
      },
    };
    const pending =
      command === 'rename'
        ? new Pages(delayed).update(editor, note.id, {
            title: 'Unauthorized',
            revision: note.revision,
          })
        : new Pages(delayed).trash(editor, note.id);
    await entered;
    await new Access(db).changeRole(owner, 'studio', editor.userId, null);
    const assertion = expect(pending).rejects.toMatchObject({ code: 'FORBIDDEN' });
    release();
    await assertion;
    expect((await pages.get(owner, note.id)).title).toBe('Keep original');
  },
);
test('stale schema replacement cannot erase a concurrent property addition', async () => {
  const page = await new Pages(db).create(owner, 'studio', { title: 'Schema', kind: 'database' });
  const databases = new Databases(db);
  const initial = await databases.fields(owner, page.id);
  await databases.setFields(
    owner,
    page.id,
    [...initial, { id: 'alpha', name: 'Alpha', type: 'text' }],
    1,
  );
  await expect(
    databases.setFields(
      editor,
      page.id,
      [...initial, { id: 'beta', name: 'Beta', type: 'text' }],
      1,
    ),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  expect((await databases.fields(owner, page.id)).some((field) => field.id === 'alpha')).toBe(true);
});
