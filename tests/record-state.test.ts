import { afterEach, expect, test, vi } from 'vitest';
import { useWorkspace } from '../apps/web/src/state/store.js';
const initial = useWorkspace.getState();
afterEach(() => {
  useWorkspace.setState(initial, true);
  vi.unstubAllGlobals();
});
test('copy preparation can await the record owner’s queued writes before reading its defaults', async () => {
  const record = {
    pageId: 'record',
    pageRevision: 1,
    title: 'Interview',
    values: { hours: 2 },
    revision: 1,
    updatedAt: '2026-11-08T10:00:00Z',
  };
  useWorkspace.setState({
    user: { id: 'first', name: 'First', email: 'first@example.com' },
    workspaceId: 'studio',
    recordEntities: { record },
  });
  let finish!: (response: Response) => void;
  vi.stubGlobal(
    'fetch',
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  const writing = useWorkspace
    .getState()
    .editRecord('database', 'record', { values: { hours: 9 } });
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  let settled = false;
  const waiting = useWorkspace
    .getState()
    .settleRecordWrites(['record'])
    .then(() => {
      settled = true;
    });
  await Promise.resolve();
  expect(settled).toBe(false);
  finish(Response.json({ ...record, revision: 2, values: { hours: 9 } }));
  await Promise.all([writing, waiting]);
  expect(settled).toBe(true);
  expect(useWorkspace.getState().recordEntities.record.values.hours).toBe(9);
});

test.each(['identity', 'workspace', 'invalidation'])(
  'a late single-record response cannot repopulate data after %s changes',
  async (scope) => {
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    useWorkspace.setState({
      user: { id: 'first', name: 'First', email: 'first@example.com' },
      workspaceId: 'studio',
      tables: {},
      recordEntities: {},
    });
    const loading = useWorkspace.getState().loadRecord('database', 'record');
    if (scope === 'identity')
      useWorkspace.setState({
        user: { id: 'second', name: 'Second', email: 'second@example.com' },
      });
    if (scope === 'workspace') useWorkspace.setState({ workspaceId: 'other' });
    if (scope === 'invalidation') useWorkspace.getState().invalidateKnowledge();
    finish(
      Response.json({
        title: 'Private database',
        pageRevision: 1,
        fieldsRevision: 1,
        fields: [{ id: 'private', name: 'Confidential property', type: 'text' }],
        viewsRevision: 1,
        views: [],
        record: {
          pageId: 'record',
          pageRevision: 1,
          title: 'Private record',
          values: { private: 'Confidential value' },
          revision: 1,
          updatedAt: '2026-11-08T09:00:00Z',
        },
      }),
    );
    await loading;
    expect(useWorkspace.getState().tables).toEqual({});
    expect(useWorkspace.getState().recordEntities).toEqual({});
  },
);

test('record values and the page title merge according to their independent revisions', async () => {
  const current = {
    pageId: 'record',
    pageRevision: 3,
    title: 'Later page title',
    values: { hours: 2 },
    revision: 1,
    updatedAt: '2026-11-08T10:00:00Z',
  };
  const incoming = {
    ...current,
    pageRevision: 2,
    title: 'Earlier page title',
    values: { hours: 4 },
    revision: 2,
    updatedAt: '2026-11-08T09:00:00Z',
  };
  useWorkspace.setState({
    user: { id: 'first', name: 'First', email: 'first@example.com' },
    workspaceId: 'studio',
    recordEntities: { record: current },
    tables: {},
  });
  vi.stubGlobal('fetch', async () =>
    Response.json({
      title: 'Database',
      pageRevision: 1,
      fieldsRevision: 1,
      fields: [],
      viewsRevision: 1,
      views: [],
      record: incoming,
    }),
  );
  await useWorkspace.getState().loadRecord('database', 'record');
  expect(useWorkspace.getState().recordEntities.record).toMatchObject({
    title: 'Later page title',
    pageRevision: 3,
    revision: 2,
    values: { hours: 4 },
  });
});
