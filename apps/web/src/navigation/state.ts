import type { Page, PageCursor } from '../../../../packages/contracts/src/index.js';
import type { WorkspaceState } from '../state/store.js';
import { api } from '../state/api.js';
export interface NavigationSlice {
  navigationCursors: Record<string, PageCursor | null>;
  childrenLoaded: string[];
  loadChildren(parentId: string | null, more?: boolean): Promise<void>;
}
export function navigationSlice(
  set: (partial: Partial<WorkspaceState>) => void,
  get: () => WorkspaceState,
): NavigationSlice {
  return {
    navigationCursors: {},
    childrenLoaded: [],
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
