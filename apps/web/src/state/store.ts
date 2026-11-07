import { create } from 'zustand';
import { api, ApiError, json } from './api.js';
import type {
  Page,
  SaveStatus,
  Workspace,
  NavigationSnapshot,
} from '../../../../packages/contracts/src/index.js';
import { databaseSlice, type DatabaseSlice } from '../databases/state.js';
import { knowledgeSlice, type KnowledgeSlice } from '../knowledge/state.js';
import { navigationSlice, type NavigationSlice } from '../navigation/state.js';
type User = { id: string; name: string; email: string };
export type View = 'document' | 'database' | 'graph' | 'all';
export type Dialog = 'search' | 'new-page' | 'page-menu' | 'settings' | 'invite' | 'move' | null;
export interface WorkspaceState extends DatabaseSlice, KnowledgeSlice, NavigationSlice {
  user: User | null;
  workspaces: Workspace[];
  workspaceId: string | null;
  pages: Page[];
  selectedId: string | null;
  view: View;
  loading: boolean;
  error: string | null;
  dialog: Dialog;
  sidebarOpen: boolean;
  contextOpen: boolean;
  saveStatus: SaveStatus;
  expanded: string[];
  favorites: string[];
  online: boolean;
  outline: { level: number; text: string }[];
  linkedPageIds: string[];
  initialize(): Promise<void>;
  reload(): Promise<void>;
  chooseWorkspace(id: string): Promise<void>;
  navigate(id: string | null, view?: View, mode?: 'push' | 'replace' | 'none'): void;
  openDialog(dialog: Dialog): void;
  setError(error: unknown): void;
  createPage(input: {
    title: string;
    parentId?: string;
    kind?: 'document' | 'database';
    visibility?: 'workspace' | 'private';
  }): Promise<void>;
  updatePage(id: string, patch: { title?: string; description?: string }): Promise<void>;
  trashPage(id: string): Promise<void>;
  toggleExpanded(id: string): void;
  toggleFavorite(id: string): void;
  signOut(): Promise<void>;
}
export const useWorkspace = create<WorkspaceState>((set, get) => ({
  ...databaseSlice(set, get),
  ...knowledgeSlice(set, get),
  ...navigationSlice(set, get),
  user: null,
  workspaces: [],
  workspaceId: null,
  pages: [],
  selectedId: null,
  view: 'document',
  loading: true,
  error: null,
  dialog: null,
  sidebarOpen: false,
  contextOpen: false,
  saveStatus: 'connecting',
  expanded: [],
  favorites: [],
  online: true,
  outline: [],
  linkedPageIds: [],
  async initialize() {
    try {
      const session = await api<{ user: User; workspaces: Workspace[] }>('/session');
      set({ user: session.user, workspaces: session.workspaces });
      if (session.workspaces.length) await get().chooseWorkspace(session.workspaces[0].id);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) get().setError(error);
    } finally {
      set({ loading: false });
    }
  },
  async chooseWorkspace(workspaceId) {
    set({
      workspaceId,
      pages: [],
      selectedId: null,
      loading: true,
      tables: {},
      graphs: {},
      mentions: {},
      searchResults: [],
    });
    try {
      const fromHash = location.hash.slice(1).split('/');
      const snapshot = await api<NavigationSnapshot>(
        `/workspaces/${workspaceId}/navigation${fromHash[0] ? '?selected=' + encodeURIComponent(fromHash[0]) : ''}`,
      );
      const favorites = await api<string[]>(`/workspaces/${workspaceId}/favorites`);
      set({
        pages: snapshot.pages,
        expanded: snapshot.expanded,
        navigationCursors: snapshot.cursors,
        childrenLoaded: snapshot.loaded,
        favorites,
      });
      get().navigate(
        snapshot.selectedId,
        (['document', 'database', 'graph', 'all'].includes(fromHash[1])
          ? fromHash[1]
          : 'document') as View,
        'replace',
      );
    } catch (error) {
      get().setError(error);
    } finally {
      set({ loading: false });
    }
  },
  async reload() {
    const id = get().workspaceId;
    if (!id) return;
    try {
      const user = get().user?.id;
      const selected = get().selectedId;
      const [snapshot, session] = await Promise.all([
        api<NavigationSnapshot>(`/workspaces/${id}/navigation`, {
          method: 'POST',
          body: json({
            loaded: get()
              .pages.map((page) => page.id)
              .slice(0, 5000),
            selected,
            expanded: get().expanded,
          }),
        }),
        api<{ workspaces: Workspace[] }>('/session'),
      ]);
      if (get().workspaceId === id && get().user?.id === user && get().selectedId === selected) {
        const cursors = { ...get().navigationCursors };
        for (const [key, cursor] of Object.entries(snapshot.cursors))
          if (!cursors[key] || !cursor) cursors[key] = cursor;
        set({
          pages: snapshot.pages,
          selectedId: snapshot.selectedId,
          expanded: [...new Set([...get().expanded, ...snapshot.expanded])].filter((id) =>
            snapshot.pages.some((page) => page.id === id),
          ),
          navigationCursors: cursors,
          childrenLoaded: [...new Set([...get().childrenLoaded, ...snapshot.loaded])],
          workspaces: session.workspaces,
        });
      }
    } catch (error) {
      if (error instanceof ApiError && [401, 403].includes(error.status))
        set({ pages: [], selectedId: null });
      get().setError(error);
    }
  },
  navigate(id, view = 'document', mode = 'push') {
    set({ selectedId: id, view, sidebarOpen: false, dialog: null });
    if (mode !== 'none')
      history[mode === 'replace' ? 'replaceState' : 'pushState'](null, '', `#${id ?? ''}/${view}`);
    if (id && !get().pages.some((page) => page.id === id)) {
      void get().reload();
    }
  },
  openDialog(dialog) {
    set({ dialog });
  },
  setError(error) {
    set({ error: error instanceof Error ? error.message : String(error) });
  },
  async createPage(input) {
    const id = get().workspaceId;
    if (!id) return;
    const page = await api<Page>(`/workspaces/${id}/pages`, { method: 'POST', body: json(input) });
    await get().reload();
    set({ expanded: [...new Set([...get().expanded, ...(page.parentId ? [page.parentId] : [])])] });
    get().navigate(page.id, page.kind === 'database' ? 'database' : 'document');
  },
  async updatePage(id, patch) {
    const current = get().pages.find((page) => page.id === id);
    if (!current) return;
    const page = await api<Page>(`/pages/${id}`, {
      method: 'PATCH',
      body: json({ ...patch, revision: current.revision }),
    });
    set({ pages: get().pages.map((item) => (item.id === id ? page : item)) });
  },
  async trashPage(id) {
    await api(`/pages/${id}`, { method: 'DELETE' });
    await get().reload();
    get().navigate(get().pages[0]?.id ?? null);
  },
  toggleExpanded(id) {
    if (!get().expanded.includes(id)) void get().loadChildren(id).catch(get().setError);
    set({
      expanded: get().expanded.includes(id)
        ? get().expanded.filter((item) => item !== id)
        : [...get().expanded, id],
    });
  },
  toggleFavorite(id) {
    const favorite = !get().favorites.includes(id);
    void api(`/pages/${id}/favorite`, { method: 'PUT', body: json({ favorite }) })
      .then(() =>
        set({
          favorites: favorite
            ? [...get().favorites, id]
            : get().favorites.filter((item) => item !== id),
        }),
      )
      .catch(get().setError);
  },
  async signOut() {
    await api('/auth/sign-out', { method: 'POST', body: '{}' });
    // Recovery sessions clear their IndexedDB cache when the identity disappears.
    set({
      user: null,
      pages: [],
      workspaceId: null,
      selectedId: null,
      dialog: null,
      workspaces: [],
      favorites: [],
      expanded: [],
      tables: {},
      graphs: {},
      mentions: {},
      searchResults: [],
      outline: [],
      linkedPageIds: [],
    });
  },
}));
