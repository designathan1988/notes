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
import { openRecovery } from '../documents/recovery.js';
import { workbenchSlice, type WorkbenchSlice } from '../workbench/state.js';
import { activitySlice, type ActivitySlice } from '../activity/state.js';
type User = { id: string; name: string; email: string };
const pageWrites = new Map<string, Promise<void>>();
export type View = 'document' | 'database' | 'graph' | 'all';
export type Dialog = 'search' | 'new-page' | 'page-menu' | 'settings' | 'invite' | 'move' | null;
export interface WorkspaceState
  extends DatabaseSlice, KnowledgeSlice, NavigationSlice, WorkbenchSlice, ActivitySlice {
  user: User | null;
  workspaces: Workspace[];
  workspaceId: string | null;
  pages: Page[];
  selectedId: string | null;
  view: View;
  loading: boolean;
  error: string | null;
  connectionError: boolean;
  dialog: Dialog;
  newPageParentId: string | null;
  newPageKind: 'document' | 'database';
  openCreatePage(parentId?: string | null, kind?: 'document' | 'database'): void;
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
  navigate(
    id: string | null,
    view?: View,
    mode?: 'push' | 'replace' | 'none',
    options?: { preserveOverlays?: boolean },
  ): void;
  openDialog(dialog: Dialog): void;
  setError(error: unknown): void;
  createPage(
    input: {
      title: string;
      parentId?: string;
      kind?: 'document' | 'database';
      visibility?: 'workspace' | 'private';
    },
    options?: { navigate?: boolean },
  ): Promise<Page>;
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
  ...workbenchSlice(set, get),
  ...activitySlice(set, get),
  user: null,
  workspaces: [],
  workspaceId: null,
  pages: [],
  selectedId: null,
  view: 'document',
  loading: true,
  error: null,
  connectionError: false,
  dialog: null,
  newPageParentId: null,
  newPageKind: 'document',
  openCreatePage(parentId = null, kind = 'document') {
    set({ newPageParentId: parentId, newPageKind: kind, dialog: 'new-page' });
  },
  sidebarOpen: false,
  contextOpen: false,
  saveStatus: 'connecting',
  expanded: [],
  favorites: [],
  online: true,
  outline: [],
  linkedPageIds: [],
  async initialize() {
    set({ loading: true, error: null, connectionError: false });
    try {
      let session: { user: User; workspaces: Workspace[] } | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          session = await api<{ user: User; workspaces: Workspace[] }>('/session');
          break;
        } catch (error) {
          if (attempt === 2 || !(error instanceof ApiError && error.readFailure)) throw error;
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
      }
      if (!session) return;
      set({ user: session.user, workspaces: session.workspaces });
      if (session.workspaces.length) await get().chooseWorkspace(session.workspaces[0].id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) set({ user: null });
      else {
        get().setError(error);
        set({ connectionError: true });
      }
    } finally {
      set({ loading: false });
    }
  },
  async chooseWorkspace(workspaceId) {
    get().clearActivity();
    set({
      workspaceId,
      pages: [],
      selectedId: null,
      loading: true,
      tables: {},
      tableQueries: {},
      recordEntities: {},
      graphs: {},
      mentions: {},
      searchResults: [],
      knowledgeVersion: get().knowledgeVersion + 1,
    });
    get().restoreWorkbench();
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
        ...(get().connectionError ? { error: null, connectionError: false } : {}),
      });
      get().navigate(
        snapshot.selectedId,
        (['document', 'database', 'graph', 'all'].includes(fromHash[1])
          ? fromHash[1]
          : 'document') as View,
        'replace',
      );
      await get().reload();
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
              .concat(
                get().tabs.flatMap((tab) => (tab.pageId ? [tab.pageId] : [])),
                get().recentPageIds,
              )
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
          selectedId: selected === null ? null : snapshot.selectedId,
          expanded: [...new Set([...get().expanded, ...snapshot.expanded])].filter((id) =>
            snapshot.pages.some((page) => page.id === id),
          ),
          navigationCursors: cursors,
          childrenLoaded: [...new Set([...get().childrenLoaded, ...snapshot.loaded])],
          workspaces: session.workspaces,
          ...(get().connectionError ? { error: null, connectionError: false } : {}),
        });
        get().pruneActivity(snapshot.pages.map((page) => page.id));
        get().invalidateKnowledge();
        get().reconcileTabs(snapshot.pages);
        if (selected !== null && snapshot.selectedId !== selected) {
          const next = get().tabs.find((tab) => tab.pageId);
          get().navigate(
            next?.pageId ?? snapshot.selectedId,
            ['all', 'graph'].includes(get().view) ? get().view : next?.view,
            'replace',
            { preserveOverlays: true },
          );
        }
        const selectedPage = snapshot.pages.find((page) => page.id === get().selectedId);
        if (get().view === 'document' && selectedPage?.kind === 'database')
          get().navigate(selectedPage.id, 'database', 'replace', { preserveOverlays: true });
      }
    } catch (error) {
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        get().clearActivity();
        set({
          pages: [],
          selectedId: null,
          tables: {},
          tableQueries: {},
          recordEntities: {},
          outline: [],
          linkedPageIds: [],
        });
        get().invalidateKnowledge();
      }
      get().setError(error);
    }
  },
  navigate(id, view, mode = 'push', options = {}) {
    const kind = get().pages.find((page) => page.id === id)?.kind;
    view ??= kind === 'database' ? 'database' : 'document';
    if (view === 'document' && kind === 'database') {
      view = 'database';
      if (mode === 'none') mode = 'replace';
    }
    if (mode === 'push' && get().selectedId === id && get().view === view) mode = 'replace';
    get().trackNavigation(id, view, mode);
    set({
      selectedId: id,
      view,
      ...(options.preserveOverlays ? {} : { sidebarOpen: false, dialog: null, commandOpen: false }),
      ...(get().selectedId !== id ? { outline: [], linkedPageIds: [], editorRequest: null } : {}),
    });
    if (mode !== 'none')
      history[mode === 'replace' ? 'replaceState' : 'pushState'](
        { noteWorkbench: { workspaceId: get().workspaceId, index: get().navigationHistory.index } },
        '',
        `#${id ?? ''}/${view}`,
      );
    if (id && !get().pages.some((page) => page.id === id)) {
      void get().reload();
    }
  },
  openDialog(dialog) {
    set({ dialog, pendingMove: null });
  },
  setError(error) {
    set({
      error: error instanceof Error ? error.message : String(error),
      connectionError: error instanceof ApiError && error.readFailure,
    });
  },
  async createPage(input, options = {}) {
    const id = get().workspaceId;
    if (!id) throw new Error('Choose a workspace first.');
    const page = await api<Page>(`/workspaces/${id}/pages`, { method: 'POST', body: json(input) });
    await get().reload();
    set({
      pages: [
        ...get()
          .pages.filter((item) => item.id !== page.id)
          .map((item) => (item.id === page.parentId ? { ...item, hasChildren: true } : item)),
        page,
      ],
      expanded: [...new Set([...get().expanded, ...(page.parentId ? [page.parentId] : [])])],
    });
    if (options.navigate !== false)
      get().navigate(page.id, page.kind === 'database' ? 'database' : 'document');
    return page;
  },
  async updatePage(id, patch) {
    const user = get().user?.id,
      workspace = get().workspaceId;
    const operation = (pageWrites.get(id) ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        if (user !== get().user?.id || workspace !== get().workspaceId) return;
        const current = get().pages.find((page) => page.id === id);
        if (!current) throw new Error('Reload this page before editing its details.');
        const page = await api<Page>(`/pages/${id}`, {
          method: 'PATCH',
          body: json({ ...patch, revision: current.revision }),
        });
        if (user === get().user?.id && workspace === get().workspaceId)
          set({ pages: get().pages.map((item) => (item.id === id ? { ...item, ...page } : item)) });
      });
    pageWrites.set(id, operation);
    try {
      await operation;
    } finally {
      if (pageWrites.get(id) === operation) pageWrites.delete(id);
    }
  },
  async trashPage(id) {
    const user = get().user?.id,
      workspace = get().workspaceId;
    await api(`/pages/${id}`, { method: 'DELETE' });
    if (user !== get().user?.id || workspace !== get().workspaceId) return;
    await get().reload();
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
    const identity = get().user?.id;
    if (identity)
      await (await import('../documents/session.js')).assertIdentityCanSignOut(identity);
    await api('/auth/sign-out', { method: 'POST', body: '{}' });
    if (identity) {
      await (await import('../documents/session.js')).closeIdentitySessions(identity);
      if (globalThis.indexedDB) {
        const recovery = await openRecovery();
        try {
          await recovery.clearIdentity(identity);
        } finally {
          recovery.close();
        }
      }
    }
    get().clearWorkbench();
    get().clearActivity();
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
      tableQueries: {},
      recordEntities: {},
      graphs: {},
      mentions: {},
      searchResults: [],
      outline: [],
      linkedPageIds: [],
    });
  },
}));
