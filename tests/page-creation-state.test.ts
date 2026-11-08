import { afterEach, expect, test, vi } from 'vitest';
import { useWorkspace } from '../apps/web/src/state/store.js';
const initial = useWorkspace.getState();
afterEach(() => {
  useWorkspace.setState(initial, true);
  vi.unstubAllGlobals();
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
