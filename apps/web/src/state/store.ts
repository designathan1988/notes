import { create } from 'zustand';
import type { JSONContent } from '@tiptap/core';
import { api, ApiError, json } from './api.js';
import type { Page, PageUpdate, SaveStatus, Workspace, NavigationSnapshot } from '@note/contracts';
import { databaseSlice, type DatabaseSlice } from '../databases/state.js';
import { knowledgeSlice, type KnowledgeSlice } from '../knowledge/state.js';
import { navigationSlice, type NavigationSlice } from '../navigation/state.js';
import { openRecovery } from '../documents/recovery.js';
import { workbenchSlice, type WorkbenchSlice } from '../workbench/state.js';
import { activitySlice, type ActivitySlice } from '../activity/state.js';
import { templateSlice, type TemplateSlice } from '../templates/state.js';
import { pageView } from '../workbench/route.js';
import { appearanceSlice, type AppearanceSlice } from '../appearance/state.js';
type User = { id: string; name: string; email: string };
const pageWrites = new Map<string, Promise<void>>();
async function settlePageWrites(ids: string[]) {
  await Promise.all(ids.flatMap((id) => (pageWrites.get(id) ? [pageWrites.get(id)!] : [])));
}
let navigationSequence = 0;
let workspaceSequence = 0;
import { isView, type View } from './views.js';
export * from './views.js';
export type Dialog = 'search' | 'new-page' | 'page-menu' | 'settings' | 'invite' | 'move' | null;
export interface WorkspaceState
  extends
    DatabaseSlice,
    KnowledgeSlice,
    NavigationSlice,
    WorkbenchSlice,
    ActivitySlice,
    AppearanceSlice,
    TemplateSlice {
  user: User | null;
  workspaces: Workspace[];
  workspaceId: string | null;
  pages: Page[];
  selectedId: string | null;
  view: View;
  loading: boolean;
  error: string | null;
  errorPageId: string | null;
  connectionError: boolean;
  dialog: Dialog;
  newPageParentId: string | null;
  newPageKind: 'document' | 'database' | 'canvas';
  openCreatePage(parentId?: string | null, kind?: 'document' | 'database' | 'canvas'): void;
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
  setPageError(pageId: string, error: unknown): void;
  createPage(
    input: {
      title: string;
      parentId?: string;
      kind?: 'document' | 'database' | 'canvas';
      visibility?: 'workspace' | 'private';
      description?: string;
      content?: JSONContent;
      requestId?: string;
      purpose?: 'copy' | 'recovery';
      expectedUserId?: string;
    },
    options?: { navigate?: boolean },
  ): Promise<Page>;
  updatePage(id: string, patch: PageUpdate, expectedRevision?: number): Promise<void>;
  settlePageWrites(ids: string[]): Promise<void>;
  trashPage(id: string): Promise<void>;
  toggleExpanded(id: string): void;
  toggleFavorite(id: string): void;
  signOut(): Promise<void>;
  setSidebarOpen(open: boolean): void;
  setContextOpen(open: boolean): void;
  setOnline(online: boolean): void;
  clearError(): void;
  setSaveStatus(status: SaveStatus): void;
  setDocumentProjection(outline: { level: number; text: string }[], links: string[]): void;
  receivePage(page: Page): void;
}
export const useWorkspace = create<WorkspaceState>((set, get) => ({
  ...databaseSlice(set, get),
  ...knowledgeSlice(set, get),
  ...navigationSlice(set, get),
  ...workbenchSlice(set, get),
  ...activitySlice(set, get),
  ...templateSlice(set, get),
  ...appearanceSlice(set, get),
  settlePageWrites,
  user: null,
  workspaces: [],
  workspaceId: null,
  pages: [],
  selectedId: null,
  view: 'document',
  loading: true,
  error: null,
  errorPageId: null,
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
  setSidebarOpen(open) {
    set({ sidebarOpen: open });
  },
  setContextOpen(open) {
    set({ contextOpen: open });
  },
  setOnline(online) {
    set({ online });
  },
  clearError() {
    set({ error: null, errorPageId: null });
  },
  setSaveStatus(status) {
    set({ saveStatus: status });
  },
  setDocumentProjection(outline, links) {
    set({ outline, linkedPageIds: links });
  },
  receivePage(page) {
    set({ pages: [...get().pages.filter((item) => item.id !== page.id), page] });
  },
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
      void get().loadAppearance(session.user.id);
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
    navigationSequence++;
    const sequence = ++workspaceSequence,
      identity = get().user?.id;
    const current = () =>
      sequence === workspaceSequence &&
      get().workspaceId === workspaceId &&
      get().user?.id === identity;
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
      searchTag: '',
      knowledgeVersion: get().knowledgeVersion + 1,
    });
    get().restoreWorkbench();
    get().restoreTemplateCommands();
    try {
      const fromHash = location.hash.slice(1).split('/');
      const [snapshot, favorites] = await Promise.all([
        api<NavigationSnapshot>(
          `/workspaces/${workspaceId}/navigation${fromHash[0] ? '?selected=' + encodeURIComponent(fromHash[0]) : ''}`,
        ),
        api<string[]>(`/workspaces/${workspaceId}/favorites`),
      ]);
      if (!current()) return;
      set({
        pages: snapshot.pages,
        expanded: snapshot.expanded,
        navigationCursors: snapshot.cursors,
        childrenLoaded: snapshot.loaded,
        favorites,
        ...(get().connectionError ? { error: null, connectionError: false } : {}),
      });
      get().navigate(
        fromHash[1] === 'templates' ||
          (!fromHash[0] && ['canvas', 'database'].includes(fromHash[1]))
          ? null
          : snapshot.selectedId,
        isView(fromHash[1]) ? fromHash[1] : 'document',
        'replace',
      );
      // The authorized bootstrap can render now; tab reconciliation refreshes in the background.
      void get().reload();
    } catch (error) {
      if (current()) get().setError(error);
    } finally {
      if (current()) set({ loading: false });
    }
  },
  async reload() {
    const id = get().workspaceId;
    if (!id) return;
    const user = get().user?.id,
      selected = get().selectedId,
      sequence = ++navigationSequence;
    const current = () =>
      sequence === navigationSequence && get().workspaceId === id && get().user?.id === user;
    try {
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
      if (current() && get().selectedId === selected) {
        const known = new Map(get().pages.map((page) => [page.id, page]));
        snapshot.pages = snapshot.pages.map((page) => {
          const previous = known.get(page.id);
          return previous && previous.revision > page.revision
            ? {
                ...previous,
                visibility: page.visibility,
                accessOwnerId: page.accessOwnerId,
                ...(page.hasChildren !== undefined ? { hasChildren: page.hasChildren } : {}),
              }
            : page;
        });
        const cursors = { ...get().navigationCursors };
        for (const [key, cursor] of Object.entries(snapshot.cursors))
          if (!cursors[key] || !cursor) cursors[key] = cursor;
        const nextSelected = selected === null ? null : snapshot.selectedId;
        set({
          pages: snapshot.pages,
          selectedId: nextSelected,
          ...(get().errorPageId && get().errorPageId !== nextSelected
            ? { error: null, errorPageId: null, connectionError: false }
            : {}),
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
            ['all', 'graph', 'home'].includes(get().view) ? get().view : next?.view,
            'replace',
            { preserveOverlays: true },
          );
        }
        const selectedPage = snapshot.pages.find((page) => page.id === get().selectedId);
        if (
          get().view === 'document' &&
          selectedPage &&
          ['database', 'canvas'].includes(selectedPage.kind)
        )
          get().navigate(selectedPage.id, pageView(selectedPage.kind), 'replace', {
            preserveOverlays: true,
          });
      }
    } catch (error) {
      if (!current() || get().selectedId !== selected) return;
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
    view ??= pageView(kind);
    if (view === 'document' && kind && ['database', 'canvas'].includes(kind)) {
      view = pageView(kind);
      if (mode === 'none') mode = 'replace';
    }
    if (mode === 'push' && get().selectedId === id && get().view === view) mode = 'replace';
    get().trackNavigation(id, view, mode);
    set({
      selectedId: id,
      view,
      ...(options.preserveOverlays ? {} : { sidebarOpen: false, dialog: null, commandOpen: false }),
      ...(get().selectedId !== id ? { outline: [], linkedPageIds: [], editorRequest: null } : {}),
      ...(get().errorPageId && get().errorPageId !== id
        ? { error: null, errorPageId: null, connectionError: false }
        : {}),
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
      errorPageId: null,
      connectionError: error instanceof ApiError && error.readFailure,
    });
  },
  setPageError(pageId, error) {
    if (get().selectedId !== pageId) return;
    set({
      error: error instanceof Error ? error.message : String(error),
      errorPageId: pageId,
      connectionError: error instanceof ApiError && error.readFailure,
    });
  },
  async createPage(input, options = {}) {
    const id = get().workspaceId;
    const identity = get().user?.id;
    if (!id) throw new Error('Choose a workspace first.');
    const page = await api<Page>(`/workspaces/${id}/pages`, { method: 'POST', body: json(input) });
    if (identity !== get().user?.id || id !== get().workspaceId) return page;
    await get().reload();
    if (identity !== get().user?.id || id !== get().workspaceId) return page;
    set({
      pages: [
        ...get()
          .pages.filter((item) => item.id !== page.id)
          .map((item) => (item.id === page.parentId ? { ...item, hasChildren: true } : item)),
        page,
      ],
      expanded: [...new Set([...get().expanded, ...(page.parentId ? [page.parentId] : [])])],
    });
    if (options.navigate !== false) get().navigate(page.id, pageView(page.kind));
    return page;
  },
  async updatePage(id, patch, expectedRevision) {
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
          body: json({ ...patch, revision: expectedRevision ?? current.revision }),
        });
        if (user === get().user?.id && workspace === get().workspaceId)
          set({
            pages: get().pages.map((item) =>
              item.id === id && item.revision <= page.revision ? { ...item, ...page } : item,
            ),
          });
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
    await settlePageWrites([id]);
    if (user !== get().user?.id || workspace !== get().workspaceId) return;
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
    get().clearAppearance();
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
      searchTag: '',
      outline: [],
      linkedPageIds: [],
    });
    get().restoreTemplateCommands();
  },
}));
