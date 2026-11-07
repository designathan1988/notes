import type {
  SearchResult,
  GraphData,
  KnowledgeLink,
} from '../../../../packages/contracts/src/index.js';
import { api } from '../state/api.js';
import type { WorkspaceState } from '../state/store.js';
export interface KnowledgeSlice {
  searchResults: SearchResult[];
  searchLoading: boolean;
  indexing: boolean;
  graphs: Record<string, GraphData>;
  mentions: Record<string, KnowledgeLink[]>;
  search(query: string, filters?: { kind?: string; after?: string }): Promise<void>;
  loadGraph(center?: string): Promise<void>;
  loadMentions(id: string): Promise<void>;
}
export function knowledgeSlice(
  set: (partial: Partial<WorkspaceState>) => void,
  get: () => WorkspaceState,
): KnowledgeSlice {
  let searchSequence = 0;
  return {
    searchResults: [],
    searchLoading: false,
    indexing: false,
    graphs: {},
    mentions: {},
    async search(query, filters = {}) {
      const workspace = get().workspaceId;
      if (!workspace) return;
      const sequence = ++searchSequence;
      set({ searchLoading: true });
      try {
        const params = new URLSearchParams({ q: query, ...filters });
        const result = await api<{ results: SearchResult[]; indexing: boolean }>(
          `/workspaces/${workspace}/search?${params}`,
        );
        if (sequence === searchSequence && workspace === get().workspaceId)
          set({ searchResults: result.results, indexing: result.indexing });
      } finally {
        if (sequence === searchSequence) set({ searchLoading: false });
      }
    },
    async loadGraph(center) {
      const workspace = get().workspaceId;
      if (!workspace) return;
      const graph = await api<GraphData>(
        `/workspaces/${workspace}/graph${center ? '?center=' + encodeURIComponent(center) : ''}`,
      );
      if (workspace === get().workspaceId)
        set({ graphs: { ...get().graphs, [`${workspace}:${center ?? 'all'}`]: graph } });
    },
    async loadMentions(id) {
      const user = get().user?.id;
      const mentions = await api<KnowledgeLink[]>(`/pages/${id}/backlinks`);
      if (user === get().user?.id) set({ mentions: { ...get().mentions, [id]: mentions } });
    },
  };
}
