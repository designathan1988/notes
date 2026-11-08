import { afterEach, expect, test, vi } from 'vitest';
import { templateSlice } from '../apps/web/src/templates/state.js';
import type { WorkspaceState } from '../apps/web/src/state/store.js';
import { api, ApiError } from '../apps/web/src/state/api.js';
vi.mock('../apps/web/src/state/api.js', async () => {
  const actual = await vi.importActual<typeof import('../apps/web/src/state/api.js')>(
    '../apps/web/src/state/api.js',
  );
  return { ...actual, api: vi.fn() };
});
const request = vi.mocked(api);
afterEach(() => vi.resetAllMocks());
function fixture() {
  const saved = new Map<string, string>();
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value);
    },
    removeItem: (key: string) => {
      saved.delete(key);
    },
  };
  let state: WorkspaceState;
  const set = (patch: Partial<WorkspaceState>) => Object.assign(state, patch);
  const prepare = vi.fn(async () => {});
  state = {
    user: { id: 'alice' },
    workspaceId: 'studio',
    workspaces: [{ id: 'studio', name: 'Studio', role: 'owner' }],
    online: true,
    knowledgeVersion: 0,
    pages: [],
    tables: {},
    reload: vi.fn(async () => {}),
    navigate: vi.fn((id: string) => {
      set({ selectedId: id });
    }),
    focusPageTitle: vi.fn(),
    settlePageWrites: vi.fn(async () => {}),
    settleRecordWrites: vi.fn(async () => {}),
    setError: vi.fn(),
    ...templateSlice(set, () => state, storage, { prepareSource: prepare }),
  } as unknown as WorkspaceState;
  return { get: () => state, set, saved, storage, prepare };
}
const page = {
  id: 'copy',
  workspaceId: 'studio',
  title: 'Private copied title',
  revision: 1,
  kind: 'document',
  templateRootId: 'copy',
};
test('using a page template creates a private copy directly and focuses its title', async () => {
  const { get, set } = fixture(),
    instance = { ...page, id: 'instance', templateRootId: null };
  set({ pages: [page] as WorkspaceState['pages'] });
  request.mockResolvedValueOnce(instance).mockResolvedValueOnce(instance);
  await get().useTemplate('copy');
  expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toMatchObject({
    visibility: 'private',
    expectedUserId: 'alice',
  });
  expect(get().navigate).toHaveBeenCalledWith('instance', 'document');
  expect(get().focusPageTitle).toHaveBeenCalledOnce();
  expect(get().templateDialog).toBeNull();
});
test('saving a template waits for source metadata writes before naming the definition', async () => {
  const { get, set } = fixture();
  set({ pages: [page] as WorkspaceState['pages'] });
  let finish!: () => void;
  vi.mocked(get().settlePageWrites).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  request.mockResolvedValueOnce({ ...page, title: 'The latest source title', revision: 2 });
  const opening = get().openSaveTemplate('copy');
  expect(get().templateDialog).toBeNull();
  expect(request).not.toHaveBeenCalled();
  finish();
  await opening;
  expect(get().pages[0].title).toBe('The latest source title');
  expect(get().templateDialog).toEqual({ sourceId: 'copy' });
});
test('record templates require a current valid default review before direct use', async () => {
  const { get, set } = fixture();
  set({
    pages: [{ ...page, templateDatabaseId: 'database' }] as WorkspaceState['pages'],
    tables: { database: { fieldsRevision: 2 } as WorkspaceState['tables'][string] },
  });
  expect(get().canUseTemplate('copy')).toBe(false);
  set({
    templateReviews: {
      copy: {
        databaseId: 'database',
        fieldsRevision: 2,
        templateRevision: 1,
        issues: [{ fieldId: 'old', name: 'Old', message: 'Review' }],
      },
    },
  });
  expect(get().canUseTemplate('copy')).toBe(false);
  set({
    templateReviews: {
      copy: { databaseId: 'database', fieldsRevision: 2, templateRevision: 1, issues: [] },
    },
  });
  expect(get().canUseTemplate('copy')).toBe(true);
  set({
    pages: [{ ...page, revision: 2, templateDatabaseId: 'database' }] as WorkspaceState['pages'],
  });
  expect(get().canUseTemplate('copy')).toBe(false);
});
test('library metadata retains the canonical navigation projection for owned subpages', async () => {
  const { get, set } = fixture();
  set({ pages: [{ ...page, hasChildren: true }] as WorkspaceState['pages'] });
  request.mockResolvedValueOnce({ items: [page], databases: [], nextCursor: null });
  await get().loadTemplates();
  expect(get().pages[0].hasChildren).toBe(true);
});
test('unconfirmed copies survive restore and retry the same intent; confirmed copies get fresh commands', async () => {
  const { get, prepare } = fixture();
  request.mockRejectedValueOnce(new ApiError('UNAVAILABLE', 'Unknown result', 503));
  await expect(
    get().copyPage({ operation: 'save', sourceId: 'source', title: 'My template' }),
  ).rejects.toThrow('Unknown result');
  expect(prepare).toHaveBeenCalledWith('alice', 'studio', 'source');
  const first = get().pendingCopies[0];
  expect(first.title).toBe('My template');
  get().restoreTemplateCommands();
  expect(get().pendingCopies).toEqual([first]);
  request.mockResolvedValueOnce(page).mockResolvedValueOnce(page);
  await get().copyPage(first, { navigate: false });
  const posts = request.mock.calls.filter(([, init]) => init?.method === 'POST');
  expect(JSON.parse(posts[0][1]!.body as string).requestId).toBe(
    JSON.parse(posts[1][1]!.body as string).requestId,
  );
  expect(get().pendingCopies).toEqual([]);
  expect(get().pages).toEqual([page]);
  request.mockResolvedValueOnce(page).mockResolvedValueOnce(page);
  await get().copyPage(
    { operation: 'save', sourceId: 'source', title: 'My template' },
    { navigate: false },
  );
  expect(
    JSON.parse(
      request.mock.calls.filter(([, init]) => init?.method === 'POST')[2][1]!.body as string,
    ).requestId,
  ).not.toBe(first.requestId);
});
test('a late successful mutation cannot expose private titles or navigate in another account', async () => {
  const { get, set, saved } = fixture();
  let complete!: (page: unknown) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }) as never,
  );
  const operation = get().copyPage({ operation: 'blank', title: 'Private copied title' });
  await vi.waitFor(() => expect(get().pendingCopies).toHaveLength(1));
  set({ user: { id: 'bob' } as WorkspaceState['user'] });
  get().restoreTemplateCommands();
  complete(page);
  await operation;
  expect(get().pages).toEqual([]);
  expect(get().pendingCopies).toEqual([]);
  expect(get().navigate).not.toHaveBeenCalled();
  expect([...saved.values()].join('')).not.toContain('Private copied title');
});
test('a confirmed copy with a failing follow-up read is not offered as an unconfirmed retry', async () => {
  const { get } = fixture();
  request
    .mockResolvedValueOnce(page)
    .mockRejectedValueOnce(new ApiError('FORBIDDEN', 'Unavailable', 403));
  await expect(get().copyPage({ operation: 'blank' })).rejects.toThrow('created');
  expect(get().pendingCopies).toEqual([]);
  expect(get().pages).toEqual([]);
});
test('a fresh permission refresh cannot be undone by the earlier copied-page response', async () => {
  const { get, set } = fixture();
  request.mockResolvedValueOnce(page).mockResolvedValueOnce(page);
  vi.mocked(get().reload).mockImplementationOnce(async () => {
    set({ pages: [] });
  });
  await expect(get().copyPage({ operation: 'blank' })).rejects.toThrow('created');
  expect(get().pages).toEqual([]);
  expect(get().navigate).not.toHaveBeenCalled();
  expect(get().pendingCopies).toEqual([]);
});
test('preflight failures keep the source content and do not dispatch or retain a new command', async () => {
  const { get, prepare } = fixture();
  prepare.mockRejectedValueOnce(new Error('Local draft pending'));
  await expect(get().copyPage({ operation: 'duplicate', sourceId: 'source' })).rejects.toThrow(
    'Local draft pending',
  );
  expect(request).not.toHaveBeenCalled();
  expect(get().pendingCopies).toEqual([]);
});
test('superseded library and preview replies cannot restore private metadata', async () => {
  const { get, set } = fixture();
  let finish!: (value: unknown) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }) as never,
  );
  const listing = get().loadTemplates({ q: 'private' });
  set({ knowledgeVersion: 1 });
  get().invalidateTemplateReads();
  finish({ items: [page], databases: [], nextCursor: null });
  await listing;
  expect(get().pages).toEqual([]);
  expect(get().templateIds).toEqual([]);
  request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }) as never,
  );
  set({ pages: [page] as WorkspaceState['pages'] });
  const preview = get().previewTemplate('copy');
  set({ workspaceId: 'other', pages: [] });
  get().restoreTemplateCommands();
  finish({ pageId: 'copy', state: 'private-content' });
  await preview;
  expect(get().templatePreview).toBeNull();
});
