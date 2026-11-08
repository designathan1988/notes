import type { Page, PageCursor } from '@note/contracts';
import type { WorkspaceState } from '../state/store.js';
import { api, ApiError, json } from '../state/api.js';
export interface NavigationSlice {
  navigationCursors: Record<string, PageCursor | null>;
  childrenLoaded: string[];
  pendingMove: { id: string; parentId: string | null; beforeId?: string | null } | null;
  movePage(
    id: string,
    parentId: string | null,
    beforeId?: string | null,
    confirmed?: boolean,
  ): Promise<boolean>;
  loadChildren(parentId: string | null, more?: boolean): Promise<void>;
}
export function navigationSlice(
  set: (partial: Partial<WorkspaceState>) => void,
  get: () => WorkspaceState,
): NavigationSlice {
  return {
    navigationCursors: {},
    childrenLoaded: [],
    pendingMove: null,
    async movePage(id, parentId, beforeId, confirmed = false) {
      const page = get().pages.find((page) => page.id === id);
      if (!page) throw new Error('Reload the page before moving it.');
      try {
        await api(`/pages/${id}/move`, {
          method: 'POST',
          body: json({ parentId, beforeId, confirmed, revision: page.revision }),
        });
        await get().reload();
        set({
          expanded: [...new Set([...get().expanded, ...(parentId ? [parentId] : [])])],
          pendingMove: null,
        });
        return true;
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.code === 'CONFLICT' &&
          error.message.includes('Confirm the visibility change')
        ) {
          set({ pendingMove: { id, parentId, beforeId }, dialog: 'move' });
          return false;
        }
        throw error;
      }
    },
    async loadChildren(parentId, more = false) {
      const workspace = get().workspaceId;
      const user = get().user?.id;
      if (!workspace) return;
      const key = parentId ?? 'root';
      const cursor = more ? get().navigationCursors[key] : null;
      const query = new URLSearchParams();
      if (parentId) query.set('parent', parentId);
      if (cursor) {
        query.set('after', String(cursor.position));
        query.set('id', cursor.id);
      }
      const result = await api<{ pages: Page[]; nextCursor: PageCursor | null }>(
        `/workspaces/${workspace}/children?${query}`,
      );
      if (workspace !== get().workspaceId || user !== get().user?.id) return;
      const pages = new Map(get().pages.map((page) => [page.id, page]));
      for (const page of result.pages) pages.set(page.id, page);
      set({
        pages: [...pages.values()],
        childrenLoaded: [...new Set([...get().childrenLoaded, key])],
        navigationCursors: { ...get().navigationCursors, [key]: result.nextCursor },
      });
    },
  };
}
