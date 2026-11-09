import { afterEach, expect, test, vi } from 'vitest';
import { useWorkspace } from '../apps/web/src/state/store.js';
import { DocumentSession } from '../apps/web/src/documents/session.js';

const initial = useWorkspace.getState();
afterEach(() => {
  useWorkspace.setState(initial, true);
  vi.unstubAllGlobals();
});
function setup() {
  vi.stubGlobal('history', { pushState() {}, replaceState() {} });
  useWorkspace.setState({
    user: { id: 'owner', name: 'Owner', email: 'owner@example.com' },
    workspaceId: 'studio',
    selectedId: 'deleted',
    trackNavigation() {},
    pages: [{ id: 'other', kind: 'document' }] as typeof initial.pages,
  });
}
test('navigation clears an error belonging to the previous document', () => {
  setup();
  useWorkspace.getState().setPageError('deleted', new Error('This page is unavailable.'));
  expect(useWorkspace.getState().error).toBe('This page is unavailable.');
  useWorkspace.getState().navigate('other');
  expect(useWorkspace.getState().error).toBeNull();
  useWorkspace.getState().setPageError('deleted', new Error('Late access failure'));
  expect(useWorkspace.getState().error).toBeNull();
});
test('navigation preserves workspace errors', () => {
  setup();
  useWorkspace.getState().setError('Workspace disconnected');
  useWorkspace.getState().navigate('other');
  expect(useWorkspace.getState().error).toBe('Workspace disconnected');
});

test('deletion refresh clears a document error atomically when it replaces the selected page', async () => {
  setup();
  let finish!: (response: Response) => void;
  vi.stubGlobal('fetch', (url: string) =>
    url === '/api/session'
      ? Promise.resolve(Response.json({ workspaces: [] }))
      : new Promise<Response>((resolve) => {
          finish = resolve;
        }),
  );
  const loading = useWorkspace.getState().reload();
  useWorkspace.getState().setPageError('deleted', new Error('This page is unavailable.'));
  const stale: string[] = [];
  const unsubscribe = useWorkspace.subscribe((state) => {
    if (state.selectedId !== 'deleted' && state.errorPageId === 'deleted' && state.error)
      stale.push(state.error);
  });
  finish(
    Response.json({
      pages: [{ id: 'other', kind: 'document' }],
      selectedId: 'other',
      expanded: [],
      cursors: {},
      loaded: [],
    }),
  );
  await loading;
  unsubscribe();
  expect(stale).toEqual([]);
  expect(useWorkspace.getState().selectedId).toBe('other');
  expect(useWorkspace.getState().error).toBeNull();
});
test('a failed refresh for a previous selection cannot clear the current page', async () => {
  setup();
  let finish!: (response: Response) => void;
  vi.stubGlobal('fetch', (url: string) =>
    url === '/api/session'
      ? Promise.resolve(Response.json({ workspaces: [] }))
      : new Promise<Response>((resolve) => {
          finish = resolve;
        }),
  );
  const loading = useWorkspace.getState().reload();
  useWorkspace.getState().navigate('other');
  finish(
    Response.json({ code: 'FORBIDDEN', message: 'This page is unavailable.' }, { status: 403 }),
  );
  await loading;
  expect(useWorkspace.getState().selectedId).toBe('other');
  expect(useWorkspace.getState().pages.map((page) => page.id)).toEqual(['other']);
  expect(useWorkspace.getState().error).toBeNull();
});

test('trashing a page waits for its pending title write before sending deletion', async () => {
  setup();
  useWorkspace.setState({
    pages: [{ id: 'deleted', revision: 1 }] as typeof initial.pages,
    async reload() {},
  });
  let finishWrite!: (response: Response) => void;
  const methods: string[] = [];
  vi.stubGlobal('fetch', (_url: string, options: RequestInit) => {
    methods.push(options.method!);
    if (options.method === 'PATCH')
      return new Promise<Response>((resolve) => {
        finishWrite = resolve;
      });
    return Promise.resolve(Response.json({}));
  });
  const writing = useWorkspace
    .getState()
    .updatePage('deleted', { title: 'Renamed before deletion' });
  await vi.waitFor(() => expect(methods).toEqual(['PATCH']));
  const deleting = useWorkspace.getState().trashPage('deleted');
  expect(methods).toEqual(['PATCH']);
  finishWrite(Response.json({ id: 'deleted', revision: 2, title: 'Renamed before deletion' }));
  await Promise.all([writing, deleting]);
  expect(methods).toEqual(['PATCH', 'DELETE']);
});

test('a deleted document session access response cannot leak into the newly selected page', async () => {
  setup();
  vi.stubGlobal('window', { removeEventListener() {} });
  let finish!: (response: Response) => void;
  vi.stubGlobal(
    'fetch',
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  const session = new DocumentSession({
    id: 'deleted',
    workspaceId: 'studio',
    generation: 1,
  } as (typeof initial.pages)[number]);
  // Reproduce the document socket access refresh that races the deletion/navigation refresh.
  const resuming = (session as unknown as { resume(rejoin: boolean): Promise<void> }).resume(false);
  useWorkspace.getState().navigate('other');
  finish(
    Response.json({ code: 'NOT_FOUND', message: 'This page is unavailable.' }, { status: 404 }),
  );
  await resuming;
  expect(useWorkspace.getState().selectedId).toBe('other');
  expect(useWorkspace.getState().error).toBeNull();
  await session.destroy();
});

test('an older workspace bootstrap cannot replace the latest workspace pages or favorites', async () => {
  setup();
  vi.stubGlobal('location', { hash: '#/document' });
  useWorkspace.setState({ restoreWorkbench() {}, restoreTemplateCommands() {}, async reload() {} });
  const requests = new Map<string, (response: Response) => void>();
  vi.stubGlobal(
    'fetch',
    (url: string) =>
      new Promise<Response>((resolve) => {
        requests.set(url, resolve);
      }),
  );
  const first = useWorkspace.getState().chooseWorkspace('first');
  const latest = useWorkspace.getState().chooseWorkspace('latest');
  const snapshot = (id: string) => ({
    pages: [{ id, kind: 'document' }],
    selectedId: id,
    expanded: [],
    cursors: {},
    loaded: [],
  });
  requests.get('/api/workspaces/latest/navigation')!(Response.json(snapshot('latest-page')));
  requests.get('/api/workspaces/latest/favorites')!(Response.json(['latest-page']));
  await latest;
  requests.get('/api/workspaces/first/navigation')!(Response.json(snapshot('first-page')));
  requests.get('/api/workspaces/first/favorites')!(Response.json(['first-page']));
  await first;
  expect(useWorkspace.getState()).toMatchObject({
    workspaceId: 'latest',
    selectedId: 'latest-page',
    favorites: ['latest-page'],
  });
  expect(useWorkspace.getState().pages.map((page) => page.id)).toEqual(['latest-page']);
});

test('a failed bootstrap for an old identity cannot surface an error or stop the current loading state', async () => {
  setup();
  vi.stubGlobal('location', { hash: '' });
  useWorkspace.setState({ restoreWorkbench() {}, restoreTemplateCommands() {}, async reload() {} });
  let finish!: (response: Response) => void;
  vi.stubGlobal('fetch', (url: string) =>
    url.endsWith('/favorites')
      ? Promise.resolve(Response.json([]))
      : new Promise<Response>((resolve) => {
          finish = resolve;
        }),
  );
  const loading = useWorkspace.getState().chooseWorkspace('first');
  useWorkspace.setState({
    user: { id: 'second', name: 'Second', email: 'second@example.com' },
    workspaceId: 'second',
    loading: true,
  });
  finish(
    Response.json(
      { code: 'FORBIDDEN', message: 'This workspace is unavailable.' },
      { status: 403 },
    ),
  );
  await loading;
  expect(useWorkspace.getState()).toMatchObject({
    workspaceId: 'second',
    loading: true,
    error: null,
  });
});
