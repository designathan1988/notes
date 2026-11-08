import type {
  SearchResult,
  GraphData,
  KnowledgeLink,
} from '../../../../packages/contracts/src/index.js';
import { api, json } from '../state/api.js';
import type { WorkspaceState } from '../state/store.js';
export interface KnowledgeSlice {
  references: Record<
    string,
    { status: 'ready'; page: GraphData['nodes'][number] } | { status: 'unavailable' | 'error' }
  >;
  loadPageReference(id: string): Promise<void>;
  knowledgeVersion: number;
  invalidateKnowledge(): void;
  searchResults: SearchResult[];
  searchTag: string;
  openTagSearch(tag: string): void;
  searchLoading: boolean;
  indexing: boolean;
  graphs: Record<string, GraphData>;
  mentions: Record<string, KnowledgeLink[]>;
  search(query: string, filters?: { kind?: string; after?: string; tag?: string }): Promise<void>;
  loadGraph(center?: string): Promise<void>;
  loadMentions(id: string): Promise<void>;
}
export function knowledgeSlice(
  set: (partial: Partial<WorkspaceState>) => void,
  get: () => WorkspaceState,
): KnowledgeSlice {
  let searchSequence = 0;
  const referenceReads = new Map<string, Promise<void>>();
  type Read = {
    id: string;
    key: string;
    requestKey: string;
    identity: string;
    workspace: string;
    version: number;
    done(): void;
  };
  let referenceQueue: Read[] = [],
    scheduled = false;
  const current = (read: Read) =>
    read.identity === get().user?.id &&
    read.workspace === get().workspaceId &&
    read.version === get().knowledgeVersion;
  const finish = (read: Read) => {
    referenceReads.delete(read.requestKey);
    read.done();
  };
  function flushReferences() {
    scheduled = false;
    const queue = referenceQueue;
    referenceQueue = [];
    const active = queue.filter((read) => {
      if (current(read)) return true;
      finish(read);
      return false;
    });
    while (active.length) {
      const batch = active.splice(0, 100),
        first = batch[0];
      void api<GraphData['nodes']>(`/workspaces/${first.workspace}/references`, {
        method: 'POST',
        body: json({ ids: batch.map((read) => read.id) }),
      })
        .then((pages) => {
          const byId = new Map(pages.map((page) => [page.id, page]));
          const next = { ...get().references };
          for (const read of batch)
            if (current(read)) {
              const page = byId.get(read.id);
              next[read.key] = page ? { status: 'ready', page } : { status: 'unavailable' };
            }
          if (batch.some(current)) set({ references: next });
        })
        .catch(() => {
          const next = { ...get().references };
          for (const read of batch) if (current(read)) next[read.key] = { status: 'error' };
          if (batch.some(current)) set({ references: next });
        })
        .finally(() => batch.forEach(finish));
    }
  }
  return {
    references: {},
    loadPageReference(id) {
      const identity = get().user?.id,
        workspace = get().workspaceId,
        version = get().knowledgeVersion;
      if (!identity || !workspace) return Promise.resolve();
      const key = `${identity}:${workspace}:${id}`,
        requestKey = `${key}:${version}`;
      if (!/^[\w-]{1,128}$/u.test(id)) {
        set({ references: { ...get().references, [key]: { status: 'unavailable' } } });
        return Promise.resolve();
      }
      const stored = get().references[key];
      if (stored && stored.status !== 'error') return Promise.resolve();
      const pending = referenceReads.get(requestKey);
      if (pending) return pending;
      if (stored) {
        const next = { ...get().references };
        delete next[key];
        set({ references: next });
      }
      let done!: () => void;
      const promise = new Promise<void>((resolve) => {
        done = resolve;
      });
      referenceReads.set(requestKey, promise);
      referenceQueue.push({ id, key, requestKey, identity, workspace, version, done });
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(flushReferences);
      }
      return promise;
    },
    knowledgeVersion: 0,
    invalidateKnowledge() {
      searchSequence++;
      get().invalidateTemplateReads?.();
      set({
        knowledgeVersion: get().knowledgeVersion + 1,
        graphs: {},
        references: {},
        mentions: {},
        searchResults: [],
        searchLoading: false,
      });
    },
    searchResults: [],
    searchTag: '',
    openTagSearch(tag) {
      set({ searchTag: tag, dialog: 'search' });
    },
    searchLoading: false,
    indexing: false,
    graphs: {},
    mentions: {},
    async search(query, filters = {}) {
      const workspace = get().workspaceId;
      const identity = get().user?.id,
        version = get().knowledgeVersion;
      if (!workspace) return;
      const sequence = ++searchSequence;
      set({ searchLoading: true });
      try {
        const params = new URLSearchParams({ q: query, ...filters });
        const result = await api<{ results: SearchResult[]; indexing: boolean }>(
          `/workspaces/${workspace}/search?${params}`,
        );
        if (
          sequence === searchSequence &&
          workspace === get().workspaceId &&
          identity === get().user?.id &&
          version === get().knowledgeVersion
        )
          set({ searchResults: result.results, indexing: result.indexing });
      } finally {
        if (sequence === searchSequence) set({ searchLoading: false });
      }
    },
    async loadGraph(center) {
      const workspace = get().workspaceId;
      const identity = get().user?.id,
        version = get().knowledgeVersion;
      if (!workspace) return;
      const graph = await api<GraphData>(
        `/workspaces/${workspace}/graph${center ? '?center=' + encodeURIComponent(center) : ''}`,
      );
      if (
        workspace === get().workspaceId &&
        identity === get().user?.id &&
        version === get().knowledgeVersion
      )
        set({ graphs: { ...get().graphs, [`${workspace}:${center ?? 'all'}`]: graph } });
    },
    async loadMentions(id) {
      const user = get().user?.id;
      const version = get().knowledgeVersion;
      const mentions = await api<KnowledgeLink[]>(`/pages/${id}/backlinks`);
      if (user === get().user?.id && version === get().knowledgeVersion)
        set({ mentions: { ...get().mentions, [id]: mentions } });
    },
  };
}
