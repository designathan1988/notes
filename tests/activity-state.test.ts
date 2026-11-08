import { afterEach, expect, test, vi } from 'vitest';
import { activitySlice } from '../apps/web/src/activity/state.js';
import type { WorkspaceState } from '../apps/web/src/state/store.js';
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  let state: WorkspaceState;
  state = {
    ...activitySlice(
      (patch) => Object.assign(state, patch),
      () => state,
    ),
    user: { id: 'owner' },
    workspaceId: 'studio',
    selectedId: 'page',
    pages: [{ id: 'page' }, { id: 'private' }],
  } as WorkspaceState;
  return state;
}

test('late private activity responses cannot repopulate a cleared or changed account scope', async () => {
  const state = fixture();
  let release!: (response: Response) => void;
  vi.stubGlobal(
    'fetch',
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  const loading = state.loadDiscussions('private', false);
  state.clearActivity();
  state.user = { id: 'other', name: 'Other', email: 'other@example.com' };
  release(Response.json({ threads: [{ id: 'secret' }], hasMore: false }));
  await loading;
  expect(state.discussions).toEqual({});
});
test('preview refreshes never silently advance the restore comparison version', async () => {
  const state = fixture();
  vi.stubGlobal('fetch', async (url: string) =>
    Response.json(
      url.includes('/history/checkpoint')
        ? { entry: { id: 'checkpoint', pageId: 'page' }, content: { type: 'doc' }, version: 2 }
        : { entries: [], hasMore: false, version: 3 },
    ),
  );
  await state.previewVersion('page', 'checkpoint');
  await state.loadHistory('page');
  expect(state.versionPreview?.version).toBe(2);
  expect(state.histories.page.version).toBe(3);
});
test('loading older replies prepends them and refreshing retains the expanded conversation', async () => {
  const state = fixture();
  let count = 0;
  vi.stubGlobal('fetch', async () =>
    Response.json(
      ++count === 1
        ? { messages: [{ id: 'new', body: 'New' }], hasMore: true }
        : count === 2
          ? { messages: [{ id: 'old', body: 'Old' }], hasMore: false }
          : {
              messages: [
                { id: 'old', body: 'Old' },
                { id: 'new', body: 'New' },
                { id: 'last', body: 'Last' },
              ],
              hasMore: false,
            },
    ),
  );
  await state.loadDiscussionMessages('page', 'thread');
  await state.loadDiscussionMessages('page', 'thread', true);
  expect(state.discussionMessages.thread.messages.map((message) => message.body)).toEqual([
    'Old',
    'New',
  ]);
  await state.loadDiscussionMessages('page', 'thread');
  expect(state.discussionMessages.thread.messages.map((message) => message.body)).toEqual([
    'Old',
    'New',
    'Last',
  ]);
});

test('metadata refresh retains in-flight activity for visible pages while removed pages stay cleared', async () => {
  const state = fixture();
  state.pages = [{ id: 'page' }, { id: 'private' }] as WorkspaceState['pages'];
  let release!: (response: Response) => void;
  vi.stubGlobal(
    'fetch',
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  const loading = state.loadHistory('page');
  state.pruneActivity(['page', 'private']);
  release(Response.json({ entries: [{ id: 'kept' }], hasMore: false, version: 2 }));
  await loading;
  expect(state.histories.page?.entries[0]?.id).toBe('kept');
  const hidden = state.loadDiscussions('private', false);
  state.pages = [{ id: 'page' }] as WorkspaceState['pages'];
  state.pruneActivity(['page']);
  release(Response.json({ threads: [{ id: 'secret' }], hasMore: false }));
  await hidden;
  expect(state.discussions.private).toBeUndefined();
});

test('refreshing an older history page keeps its paging context instead of discarding older versions', async () => {
  const state = fixture();
  vi.stubGlobal('fetch', async (url: string) =>
    Response.json(
      url.includes('offset=40')
        ? { entries: [{ id: 'older' }], version: 3, hasMore: false }
        : { entries: [{ id: 'newest' }], version: 3, hasMore: true },
    ),
  );
  await state.loadHistory('page');
  await state.loadHistory('page', 'next');
  await state.loadHistory('page');
  expect(state.histories.page.entries.map((entry) => entry.id)).toEqual(['older']);
});
test('refreshing an older discussion page keeps that page and changing the filter starts from the beginning', async () => {
  const state = fixture();
  vi.stubGlobal('fetch', async (url: string) =>
    Response.json({
      threads: [{ id: url.includes('offset=40') ? 'older' : 'newest' }],
      hasMore: !url.includes('offset=40'),
    }),
  );
  await state.loadDiscussions('page', false);
  await state.loadDiscussions('page', false, 'next');
  await state.loadDiscussions('page', false);
  expect(state.discussions.page.threads.map((thread) => thread.id)).toEqual(['older']);
  await state.loadDiscussions('page', true);
  expect(state.discussions.page.threads.map((thread) => thread.id)).toEqual(['newest']);
});

test('a confirmed comment is not reported as an uncommitted write when the following refresh fails', async () => {
  const state = fixture();
  state.setError = (error) => {
    state.error = String(error);
  };
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) =>
    options.method === 'POST'
      ? Response.json({ id: 'created' })
      : Response.json({ code: 'UNAVAILABLE', message: 'Refresh unavailable' }, { status: 503 }),
  );
  await expect(state.postDiscussion('page', 'Confirmed comment', '')).resolves.toBeUndefined();
  expect(state.error).toContain('posted');
});

test('discussion drafts survive panel changes and are removed when their page or account access ends', () => {
  const state = fixture();
  state.writeDiscussionDraft('page:page', 'page', 'Unposted feedback');
  state.writeDiscussionDraft('thread:private', 'private', 'Private reply');
  state.openPagePanel('history');
  state.openPagePanel('discussion');
  expect(state.discussionDrafts['page:page'].body).toBe('Unposted feedback');
  state.pruneActivity(['page']);
  expect(state.discussionDrafts['thread:private']).toBeUndefined();
  expect(state.discussionDrafts['page:page'].body).toBe('Unposted feedback');
  state.clearActivity();
  expect(state.discussionDrafts).toEqual({});
});
