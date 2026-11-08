import { afterEach, expect, test, vi } from 'vitest';
import { databaseSlice, tableQueryKey } from '../apps/web/src/databases/state.js';
import type { WorkspaceState } from '../apps/web/src/state/store.js';
afterEach(() => vi.unstubAllGlobals());

test('a newer page revision updates a record title even if transaction timestamps arrive out of order', async () => {
  let state: WorkspaceState,
    count = 0;
  const slice = databaseSlice(
    (partial) => Object.assign(state, partial),
    () => state,
  );
  state = { ...slice, user: { id: 'owner' }, workspaceId: 'studio' } as WorkspaceState;
  vi.stubGlobal('fetch', async () =>
    Response.json({
      title: 'Data',
      pageRevision: 1,
      fieldsRevision: 1,
      viewsRevision: 1,
      fields: [],
      views: [],
      total: 1,
      records: [
        {
          pageId: 'row',
          revision: 1,
          pageRevision: ++count + 1,
          title: count === 1 ? 'Old' : 'New',
          values: {},
          updatedAt: count === 1 ? '2026-11-08T12:00:00Z' : '2026-11-08T11:00:00Z',
        },
      ],
    }),
  );
  await state.loadTable('database');
  await state.loadTable('database');
  expect(state.recordEntities.row.title).toBe('New');
});
test('two filtered views keep separate row lists and share one canonical record entity', async () => {
  let state: WorkspaceState;
  const slice = databaseSlice(
    (partial) => Object.assign(state, partial),
    () => state,
  );
  state = { ...slice, user: { id: 'owner' }, workspaceId: 'studio' } as WorkspaceState;
  vi.stubGlobal('fetch', async (url: string) => {
    const filtered = url.includes('filter=second');
    return Response.json({
      title: 'Research',
      pageRevision: 1,
      fieldsRevision: 1,
      fields: [],
      views: [],
      total: 1,
      records: [
        {
          pageId: filtered ? 'second' : 'first',
          title: filtered ? 'Second' : 'First',
          values: {},
          revision: 1,
          updatedAt: '2026-11-07T00:00:00Z',
        },
      ],
    });
  });
  await state.loadTable('database', { filter: 'first' });
  await state.loadTable('database', { filter: 'second' });
  expect(state.tableQueries[tableQueryKey('database', { filter: 'first' })].ids).toEqual(['first']);
  expect(state.tableQueries[tableQueryKey('database', { filter: 'second' })].ids).toEqual([
    'second',
  ]);
  expect(Object.keys(state.recordEntities)).toHaveLength(2);
});

test('view deletion and newer metadata cannot be undone by a slow response for another row query', async () => {
  let state: WorkspaceState, old!: (response: Response) => void;
  const slice = databaseSlice(
    (partial) => Object.assign(state, partial),
    () => state,
  );
  state = { ...slice, user: { id: 'owner' }, workspaceId: 'studio' } as WorkspaceState;
  const result = (viewsRevision: number, views: unknown[]) => ({
    title: 'Data',
    pageRevision: 1,
    fieldsRevision: 1,
    viewsRevision,
    fields: [],
    views,
    records: [],
    total: 0,
  });
  vi.stubGlobal('fetch', async (url: string) =>
    url.includes('filter=slow')
      ? new Promise<Response>((resolve) => {
          old = resolve;
        })
      : Response.json(result(3, [])),
  );
  const slow = state.loadTable('database', { filter: 'slow' });
  await state.loadTable('database', { filter: 'new' });
  old(Response.json(result(2, [{ id: 'removed', name: 'Deleted view', revision: 1, config: {} }])));
  await slow;
  expect(state.tables.database.views).toEqual([]);
});
