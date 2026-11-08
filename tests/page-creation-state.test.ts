import { afterEach, expect, test, vi } from 'vitest';
import { useWorkspace } from '../apps/web/src/state/store.js';
import type { Page } from '../packages/contracts/src/index.js';
const initial = useWorkspace.getState();
afterEach(() => {
  useWorkspace.setState(initial, true);
  vi.unstubAllGlobals();
});

test('a delayed metadata response does not replace a newer canonical page revision', async () => {
  let finish!: (response: Response) => void, arrived!: () => void;
  const requested = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  vi.stubGlobal(
    'fetch',
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
        arrived();
      }),
  );
  const page: Page = {
    id: 'page',
    accessOwnerId: 'first',
    workspaceId: 'studio',
    parentId: null,
    title: 'Original',
    description: '',
    kind: 'document',
    visibility: 'private',
    createdBy: 'first',
    position: 1,
    revision: 1,
    generation: 1,
    updatedAt: '2026-11-08T09:00:00Z',
    deletedAt: null,
  };
  useWorkspace.setState({
    user: { id: 'first', name: 'First', email: 'first@example.com' },
    workspaceId: 'studio',
    pages: [page],
  });
  const writing = useWorkspace.getState().updatePage(page.id, { title: 'Local commit' });
  await requested;
  useWorkspace.setState({ pages: [{ ...page, title: 'Later remote commit', revision: 3 }] });
  finish(Response.json({ ...page, title: 'Local commit', revision: 2 }));
  await writing;
  expect(useWorkspace.getState().pages[0]).toMatchObject({
    title: 'Later remote commit',
    revision: 3,
  });
});

test('an older navigation refresh cannot restore a page removed by a later access refresh', async () => {
  const requests: ((response: Response) => void)[] = [];
  vi.stubGlobal('fetch', (url: string) =>
    url === '/api/session'
      ? Promise.resolve(
          Response.json({ workspaces: [{ id: 'studio', name: 'Studio', role: 'owner' }] }),
        )
      : new Promise<Response>((resolve) => requests.push(resolve)),
  );
  const page: Page = {
      id: 'public',
      accessOwnerId: 'first',
      workspaceId: 'studio',
      parentId: null,
      title: 'Public page',
      description: '',
      kind: 'document',
      visibility: 'workspace',
      createdBy: 'first',
      position: 1,
      revision: 1,
      generation: 1,
      updatedAt: '2026-11-08T09:00:00Z',
      deletedAt: null,
    },
    privatePage = {
      ...page,
      id: 'private',
      title: 'Revoked private title',
      visibility: 'private' as const,
    };
  useWorkspace.setState({
    user: { id: 'first', name: 'First', email: 'first@example.com' },
    workspaceId: 'studio',
    pages: [page, privatePage],
    selectedId: page.id,
    tabs: [],
  });
  const older = useWorkspace.getState().reload(),
    newer = useWorkspace.getState().reload();
  requests[1](
    Response.json({ pages: [page], selectedId: page.id, expanded: [], cursors: {}, loaded: [] }),
  );
  await newer;
  requests[0](
    Response.json({
      pages: [page, privatePage],
      selectedId: page.id,
      expanded: [],
      cursors: {},
      loaded: [],
    }),
  );
  await older;
  expect(useWorkspace.getState().pages.map((page) => page.id)).toEqual(['public']);
});

test('a navigation read started before a metadata commit preserves the newer page properties', async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal('fetch', (url: string) =>
    url === '/api/session'
      ? Promise.resolve(Response.json({ workspaces: [] }))
      : new Promise<Response>((resolve) => {
          finish = resolve;
        }),
  );
  const page: Page = {
    id: 'page',
    accessOwnerId: 'first',
    workspaceId: 'studio',
    parentId: null,
    title: 'Original',
    description: '',
    kind: 'document',
    visibility: 'private',
    createdBy: 'first',
    position: 1,
    revision: 1,
    generation: 1,
    updatedAt: '2026-11-08T09:00:00Z',
    deletedAt: null,
  };
  useWorkspace.setState({
    user: { id: 'first', name: 'First', email: 'first@example.com' },
    workspaceId: 'studio',
    pages: [page],
    selectedId: page.id,
    tabs: [],
  });
  const loading = useWorkspace.getState().reload();
  useWorkspace.setState({
    pages: [
      {
        ...page,
        revision: 2,
        title: 'Committed new title',
        properties: { fields: [], values: {} },
      },
    ],
  });
  finish(
    Response.json({ pages: [page], selectedId: page.id, expanded: [], cursors: {}, loaded: [] }),
  );
  await loading;
  expect(useWorkspace.getState().pages[0]).toMatchObject({
    title: 'Committed new title',
    revision: 2,
    properties: { fields: [], values: {} },
  });
});
test('creation finishing in an earlier account scope cannot append a private title to the new scope', async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal('fetch', async (url: string, options: RequestInit) => {
    if (url === '/api/workspaces/studio/pages' && options.method === 'POST')
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    if (url === '/api/session') return Response.json({ workspaces: [] });
    return Response.json({ pages: [], selectedId: null, expanded: [], cursors: {}, loaded: [] });
  });
  useWorkspace.setState({
    user: { id: 'first', name: 'First', email: 'first@example.com' },
    workspaceId: 'studio',
    pages: [],
    selectedId: null,
  });
  const creating = useWorkspace
    .getState()
    .createPage({ title: 'Private first-account title' }, { navigate: false });
  useWorkspace.setState({
    user: { id: 'second', name: 'Second', email: 'second@example.com' },
    workspaceId: 'other',
    pages: [],
    selectedId: null,
  });
  finish(
    Response.json({
      id: 'created',
      workspaceId: 'studio',
      parentId: null,
      title: 'Private first-account title',
      kind: 'document',
      visibility: 'private',
    }),
  );
  await creating;
  expect(useWorkspace.getState().pages).toEqual([]);
  expect(useWorkspace.getState().selectedId).toBeNull();
});
