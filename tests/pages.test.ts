import { afterAll, beforeAll, expect, test } from 'vitest';
import { fixture, rawPage } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import { Pages } from '../apps/server/src/pages/service.js';
let db: Database; let pages: Pages;
const actor = { userId: 'owner' };
beforeAll(async () => { db = await fixture(); pages = new Pages(db); });
afterAll(async () => { await db.close(); });
test('rejects a move that would make a parent its own descendant', async () => {
  const parent = await pages.create(actor, 'studio', { title: 'Parent' });
  const child = await pages.create(actor, 'studio', { title: 'Child', parentId: parent.id });
  await expect(pages.move(actor, parent.id, child.id, parent.revision, false)).rejects.toMatchObject({ code: 'CONFLICT' });
});
test('detects stale revisions and requires confirmation when visibility changes', async () => {
  const publicPage = await pages.create(actor, 'studio', { title: 'Public' });
  const privatePage = await pages.create(actor, 'studio', { title: 'Private', visibility: 'private' });
  await pages.update(actor, publicPage.id, { title: 'Renamed', revision: 1 });
  await expect(pages.update(actor, publicPage.id, { title: 'Stale', revision: 1 })).rejects.toMatchObject({ code: 'CONFLICT' });
  await expect(pages.move(actor, publicPage.id, privatePage.id, 2, false)).rejects.toMatchObject({ code: 'CONFLICT' });
  await pages.move(actor, publicPage.id, privatePage.id, 2, true);
  await expect(pages.get({ userId: 'admin' }, publicPage.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
test('trashes and restores a branch without changing stable page identities', async () => {
  const root = await pages.create(actor, 'studio', { title: 'Branch' });
  const child = await pages.create(actor, 'studio', { title: 'Leaf', parentId: root.id });
  await pages.trash(actor, root.id);
  expect((await pages.list(actor, 'studio')).some(page => page.id === child.id)).toBe(false);
  await pages.restore(actor, root.id);
  expect((await pages.get(actor, child.id)).title).toBe('Leaf');
});
test('record pages cannot move away from their owning database', async () => {
  const databaseId = await rawPage(db, { kind: 'database' });
  await db.query('INSERT INTO database_definitions (page_id) VALUES ($1)', [databaseId]);
  const recordId = await rawPage(db, { parent: databaseId, kind: 'record' });
  await db.query('INSERT INTO records (page_id,database_id) VALUES ($1,$2)', [recordId, databaseId]);
  await expect(pages.move(actor, recordId, null, 1, false)).rejects.toMatchObject({ code: 'CONFLICT' });
});
