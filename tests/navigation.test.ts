import { afterAll, beforeAll, expect, test } from 'vitest';
import { fixture, rawPage } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import { Navigation } from '../apps/server/src/pages/navigation.js';
let db: Database;
let navigation: Navigation;
beforeAll(async () => {
  db = await fixture();
  navigation = new Navigation(db);
});
afterAll(async () => {
  await db.close();
});
test('favorite pages remain available when their parent branch is collapsed', async () => {
  const parent = await rawPage(db, { title: 'Favorite parent' });
  const child = await rawPage(db, { parent, title: 'Favorite child' });
  const selected = await rawPage(db, { title: 'Elsewhere' });
  await db.query('INSERT INTO favorites (user_id,page_id) VALUES ($1,$2)', ['owner', child]);
  const snapshot = await navigation.bootstrap({ userId: 'owner' }, 'studio', selected);
  expect(snapshot.pages.some((page) => page.id === child)).toBe(true);
  expect(snapshot.expanded).not.toContain(parent);
  await db.query(
    "UPDATE pages SET visibility='private',created_by='admin',private_owner_id='admin' WHERE id=$1",
    [parent],
  );
  expect(
    (await navigation.bootstrap({ userId: 'owner' }, 'studio', selected)).pages.some(
      (page) => page.id === child,
    ),
  ).toBe(false);
  await db.query('UPDATE pages SET deleted_at=now() WHERE id=ANY($1::text[])', [
    [parent, child, selected],
  ]);
});
test('loads bounded sibling batches without duplicates instead of loading every page', async () => {
  await db.query(
    `INSERT INTO pages (id,workspace_id,title,created_by,position) SELECT 'nav-' || n,'studio','Page ' || n,'owner',n FROM generate_series(1,202) n`,
  );
  const first = await navigation.children({ userId: 'owner' }, 'studio');
  expect(first.pages).toHaveLength(100);
  expect(first.nextCursor).not.toBeNull();
  const second = await navigation.children({ userId: 'owner' }, 'studio', null, first.nextCursor!);
  expect(second.pages).toHaveLength(100);
  const last = await navigation.children({ userId: 'owner' }, 'studio', null, second.nextCursor!);
  expect(last.pages).toHaveLength(2);
  expect(last.nextCursor).toBeNull();
  expect(
    new Set([...first.pages, ...second.pages, ...last.pages].map((page) => page.id)).size,
  ).toBe(202);
});
test('opens deeply nested pages without a fixed hierarchy-depth rule', async () => {
  let parent: string | undefined;
  for (let i = 0; i < 60; i++)
    parent = await rawPage(db, { id: `deep-${i}`, parent, title: `Level ${i}` });
  const result = await navigation.bootstrap({ userId: 'owner' }, 'studio', parent);
  expect(result.selectedId).toBe(parent);
  expect(result.pages.some((page) => page.id === 'deep-0')).toBe(true);
  expect(result.expanded).toHaveLength(59);
});
test('refresh removes cached pages whose visibility changed and forbids cross-workspace children', async () => {
  const id = await rawPage(db, { title: 'Previously shared' });
  await db.query("UPDATE pages SET visibility='private' WHERE id=$1", [id]);
  const result = await navigation.refresh({ userId: 'admin' }, 'studio', [id], null);
  expect(result.pages.some((page) => page.id === id)).toBe(false);
  const other = await rawPage(db, { workspace: 'other', creator: 'outsider' });
  await expect(navigation.children({ userId: 'owner' }, 'studio', other)).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
});

test('the page explorer filters and sorts the authorized collection before pagination', async () => {
  const parent = await rawPage(db, { title: 'Explorer parent' });
  const alpha = await rawPage(db, { title: 'Explorer Alpha', parent });
  const zulu = await rawPage(db, { title: 'Explorer Zulu' });
  await rawPage(db, { title: 'Explorer private', visibility: 'private', creator: 'admin' });
  const result = await navigation.flat(
    { userId: 'owner' },
    'studio',
    0,
    'document',
    'Explorer',
    null,
    'title',
    'asc',
  );
  expect(result.pages.map((page) => page.title)).toEqual([
    'Explorer Alpha',
    'Explorer parent',
    'Explorer Zulu',
  ]);
  expect(result.pages.find((page) => page.id === alpha)?.parentTitle).toBe('Explorer parent');
  const reverse = await navigation.flat(
    { userId: 'owner' },
    'studio',
    0,
    'document',
    'Explorer',
    null,
    'title',
    'desc',
  );
  expect(reverse.pages[0].id).toBe(zulu);
});
