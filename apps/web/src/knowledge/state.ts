import type {
  SearchResult,
  GraphData,
  KnowledgeLink,
} from '../../../../packages/contracts/src/index.js';
import { api } from '../state/api.js';
import type { WorkspaceState } from '../state/store.js';
export interface KnowledgeSlice {
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
  return {
    knowledgeVersion: 0,
    invalidateKnowledge() {
      searchSequence++;
      get().invalidateTemplateReads?.();
      set({
        knowledgeVersion: get().knowledgeVersion + 1,
        graphs: {},
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
