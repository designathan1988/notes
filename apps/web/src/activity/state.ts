import type { DiscussionMessage, DiscussionThread, HistoryEntry } from '@note/contracts';
import type { JSONContent } from '@tiptap/core';
import type { WorkspaceState } from '../state/store.js';
import { api, json } from '../state/api.js';
import { ACTIVITY_PAGE_SIZE } from '@note/contracts';

export type PagePanelTab = 'details' | 'discussion' | 'history';
type DiscussionPage = {
  threads: DiscussionThread[];
  hasMore: boolean;
  resolved: boolean;
  offset: number;
};
type ThreadState = Pick<DiscussionThread, 'id' | 'pageId' | 'quote' | 'resolved' | 'revision'>;
type MessagePage = {
  messages: DiscussionMessage[];
  hasMore: boolean;
  pageId: string;
  thread: ThreadState;
};
type HistoryPage = { entries: HistoryEntry[]; hasMore: boolean; version: number; offset: number };
type PageMove = 'next' | 'previous' | 'first';
export type VersionPreview = { entry: HistoryEntry; content: JSONContent; version: number };
export interface ActivitySlice {
  clearDiscussionQuote(): void;
  closeVersionPreview(): void;
  pagePanelTab: PagePanelTab;
  discussionQuote: { pageId: string; text: string } | null;
  discussionDrafts: Record<string, { pageId: string; body: string }>;
  writeDiscussionDraft(key: string, pageId: string, body: string): void;
  discussions: Record<string, DiscussionPage>;
  discussionMessages: Record<string, MessagePage>;
  histories: Record<string, HistoryPage>;
  versionPreview: VersionPreview | null;
  openPagePanel(tab: PagePanelTab, quote?: string): void;
  clearActivity(): void;
  pruneActivity(ids: string[]): void;
  loadDiscussions(page: string, resolved: boolean, move?: PageMove): Promise<void>;
  loadDiscussionMessages(page: string, thread: string, more?: boolean): Promise<void>;
  postDiscussion(page: string, body: string, quote: string): Promise<void>;
  replyDiscussion(page: string, thread: string, body: string): Promise<void>;
  resolveDiscussion(
    page: string,
    thread: Pick<DiscussionThread, 'id' | 'resolved' | 'revision'>,
  ): Promise<void>;
  loadHistory(page: string, move?: PageMove): Promise<void>;
  previewVersion(page: string, id: string): Promise<void>;
  saveVersion(page: string, label: string): Promise<void>;
  restoreVersion(page: string, preview: VersionPreview): Promise<void>;
}
export function activitySlice(
  set: (patch: Partial<WorkspaceState>) => void,
  get: () => WorkspaceState,
): ActivitySlice {
  let epoch = 0,
    previewSequence = 0;
  const sequences = new Map<string, number>();
  const pageOffset = (current = 0, move?: PageMove) =>
    move === 'first'
      ? 0
      : move === 'next'
        ? current + ACTIVITY_PAGE_SIZE
        : move === 'previous'
          ? Math.max(0, current - ACTIVITY_PAGE_SIZE)
          : current;
  const guard = (key: string, page: string) => {
    const identity = get().user?.id,
      workspace = get().workspaceId,
      generation = epoch;
    const sequence = (sequences.get(key) ?? 0) + 1;
    sequences.set(key, sequence);
    return () =>
      epoch === generation &&
      identity === get().user?.id &&
      workspace === get().workspaceId &&
      get().pages.some((item) => item.id === page) &&
      sequences.get(key) === sequence;
  };
  const refreshAfterCommit = async (
    operation: () => Promise<unknown>,
    message: string,
    valid: () => boolean,
  ) => {
    try {
      await operation();
    } catch {
      if (valid()) get().setError(message);
    }
  };
  const clearSubmittedDraft = (key: string, body: string) => {
    if (get().discussionDrafts[key]?.body === body) {
      const drafts = { ...get().discussionDrafts };
      delete drafts[key];
      set({ discussionDrafts: drafts });
    }
  };
  return {
    clearDiscussionQuote() {
      set({ discussionQuote: null });
    },
    closeVersionPreview() {
      set({ versionPreview: null });
    },
    pagePanelTab: 'details',
    discussionQuote: null,
    discussionDrafts: {},
    writeDiscussionDraft(key, pageId, body) {
      set({ discussionDrafts: { ...get().discussionDrafts, [key]: { pageId, body } } });
    },
    discussions: {},
    discussionMessages: {},
    histories: {},
    versionPreview: null,
    openPagePanel(tab, quote) {
      set({
        contextOpen: true,
        pagePanelTab: tab,
        ...(quote !== undefined && get().selectedId
          ? { discussionQuote: { pageId: get().selectedId!, text: quote.slice(0, 1000) } }
          : {}),
      });
    },
    clearActivity() {
      epoch++;
      previewSequence++;
      sequences.clear();
      set({
        discussions: {},
        discussionMessages: {},
        histories: {},
        versionPreview: null,
        discussionQuote: null,
        discussionDrafts: {},
      });
    },
    pruneActivity(ids) {
      const allowed = new Set(ids);
      set({
        discussionDrafts: Object.fromEntries(
          Object.entries(get().discussionDrafts).filter(([, draft]) => allowed.has(draft.pageId)),
        ),
        discussions: Object.fromEntries(
          Object.entries(get().discussions).filter(([id]) => allowed.has(id)),
        ),
        histories: Object.fromEntries(
          Object.entries(get().histories).filter(([id]) => allowed.has(id)),
        ),
        discussionMessages: Object.fromEntries(
          Object.entries(get().discussionMessages).filter(([, value]) => allowed.has(value.pageId)),
        ),
        versionPreview: allowed.has(get().versionPreview?.entry.pageId ?? '')
          ? get().versionPreview
          : null,
        discussionQuote: allowed.has(get().discussionQuote?.pageId ?? '')
          ? get().discussionQuote
          : null,
      });
    },
    async loadDiscussions(page, resolved, move) {
      const valid = guard(`discussions:${page}`, page),
        old = get().discussions[page];
      const offset = pageOffset(old?.resolved === resolved ? old.offset : 0, move);
      const result = await api<DiscussionPage>(
        `/pages/${page}/discussions?resolved=${resolved}&offset=${offset}`,
      );
      if (valid()) {
        set({
          discussions: {
            ...get().discussions,
            [page]: { ...result, resolved, offset },
          },
        });
      }
    },
    async loadDiscussionMessages(page, thread, more = false) {
      const valid = guard(`messages:${thread}`, page),
        old = get().discussionMessages[thread];
      const before = more ? old?.messages[0]?.id : undefined;
      const result = await api<MessagePage>(
        `/pages/${page}/discussions/${thread}/messages${before ? '?before=' + encodeURIComponent(before) : ''}`,
      );
      if (valid()) {
        const combined = more
          ? [...result.messages, ...(old?.messages ?? [])]
          : [...(old?.messages ?? []), ...result.messages];
        const messages = [...new Map(combined.map((message) => [message.id, message])).values()];
        set({
          discussionMessages: {
            ...get().discussionMessages,
            [thread]: {
              ...result,
              pageId: page,
              messages,
              hasMore: more ? result.hasMore : old?.hasMore === false ? false : result.hasMore,
            },
          },
        });
      }
    },
    async postDiscussion(page, body, quote) {
      const valid = guard(`post:${page}`, page);
      await api(`/pages/${page}/discussions`, { method: 'POST', body: json({ body, quote }) });
      if (valid()) {
        clearSubmittedDraft(`page:${page}`, body);
        if (get().discussionQuote?.pageId === page && get().discussionQuote?.text === quote)
          set({ discussionQuote: null });
        await refreshAfterCommit(
          () => get().loadDiscussions(page, false, 'first'),
          'Your comment was posted. Reopen comments to refresh the discussion.',
          valid,
        );
      }
    },
    async replyDiscussion(page, thread, body) {
      const valid = guard(`reply:${thread}`, page);
      await api(`/pages/${page}/discussions/${thread}/messages`, {
        method: 'POST',
        body: json({ body }),
      });
      if (valid()) {
        clearSubmittedDraft(`thread:${thread}`, body);
        await refreshAfterCommit(
          () =>
            Promise.all([
              get().loadDiscussionMessages(page, thread),
              get().loadDiscussions(page, false),
            ]),
          'Your reply was posted. Reopen comments to refresh the discussion.',
          valid,
        );
      }
    },
    async resolveDiscussion(page, thread) {
      const valid = guard(`resolve:${thread.id}`, page);
      await api(`/pages/${page}/discussions/${thread.id}`, {
        method: 'PATCH',
        body: json({ resolved: !thread.resolved, revision: thread.revision }),
      });
      if (valid())
        await refreshAfterCommit(
          () => get().loadDiscussions(page, get().discussions[page]?.resolved ?? false),
          'The discussion was updated. Reopen comments to refresh it.',
          valid,
        );
    },
    async loadHistory(page, move) {
      const valid = guard(`history:${page}`, page),
        old = get().histories[page],
        offset = pageOffset(old?.offset, move);
      const result = await api<HistoryPage>(`/pages/${page}/history?offset=${offset}`);
      if (valid())
        set({
          histories: {
            ...get().histories,
            [page]: { ...result, offset },
          },
        });
    },
    async previewVersion(page, id) {
      const valid = guard('preview', page),
        sequence = ++previewSequence;
      set({ versionPreview: null });
      const preview = await api<VersionPreview>(`/pages/${page}/history/${id}`);
      if (valid() && sequence === previewSequence && get().selectedId === page)
        set({ versionPreview: preview });
    },
    async saveVersion(page, label) {
      const valid = guard(`save-version:${page}`, page);
      await api(`/pages/${page}/history`, { method: 'POST', body: json({ label }) });
      if (valid())
        await refreshAfterCommit(
          () => get().loadHistory(page, 'first'),
          'Your version was saved. Reopen history to refresh the list.',
          valid,
        );
    },
    async restoreVersion(page, preview) {
      const valid = guard(`restore-version:${page}`, page);
      await api(`/pages/${page}/history/${preview.entry.id}/restore`, {
        method: 'POST',
        body: json({ version: preview.version }),
      });
      if (valid()) {
        set({ versionPreview: null });
        await get().reload();
        await refreshAfterCommit(
          () => get().loadHistory(page, 'first'),
          'The version was restored. Reopen history to refresh the list.',
          valid,
        );
      }
    },
  };
}
