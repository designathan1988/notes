import { afterEach, expect, test, vi } from 'vitest';
import { databaseSlice, tableQueryKey } from '../apps/web/src/databases/state.js';
import type { WorkspaceState } from '../apps/web/src/state/store.js';
afterEach(() => vi.unstubAllGlobals());
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
