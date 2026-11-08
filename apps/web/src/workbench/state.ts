import type { Page } from '../../../../packages/contracts/src/index.js';
import type { View, WorkspaceState } from '../state/store.js';
import { browserPreferences, type PreferenceStorage } from './preferences.js';
import { navigateHistory, type WorkbenchHistory } from './history.js';
export interface WorkbenchTab {
  id: string;
  pageId: string | null;
  view: View;
  pinned: boolean;
}
export const tabKey = (pageId: string | null, view: View) =>
  view === 'document' || (view === 'database' && pageId) ? `${view}:${pageId ?? ''}` : view;
export interface WorkbenchSlice {
  tableSelections: Record<string, string>;
  selectTableView(databaseId: string, viewId: string): void;
  tabs: WorkbenchTab[];
  closedTabs: WorkbenchTab[];
  recentPageIds: string[];
  focusTitleId: string | null;
  commandOpen: boolean;
  sidebarCollapsed: boolean;
  focusMode: boolean;
  toggleFocusMode(): void;
  editorRequest: { pageId: string; command: 'find' | 'templates'; serial: number } | null;
  requestEditor(command: 'find' | 'templates'): void;
  navigationHistory: WorkbenchHistory;
  goBack(): void;
  goForward(): void;
  showCommands(): void;
  toggleSidebar(): void;
  togglePageDetails(): void;
  focusPageTitle(): void;
  trackNavigation(pageId: string | null, view: View, mode?: 'push' | 'replace' | 'none'): void;
  openTab(pageId: string | null, view?: View): void;
  activateTab(id: string): void;
  closeTab(id: string): void;
  pinTab(id: string): void;
  reopenTab(): void;
  reorderTabs(source: string, target: string): void;
  restoreWorkbench(): void;
  clearWorkbench(): void;
  reconcileTabs(pages: Page[]): void;
  createQuickPage(parentId?: string | null, kind?: 'document' | 'database'): Promise<void>;
}
export function workbenchSlice(
  set: (partial: Partial<WorkspaceState>) => void,
  get: () => WorkspaceState,
  preferences: PreferenceStorage = browserPreferences,
): WorkbenchSlice {
  const scope = () =>
    get().user?.id && get().workspaceId
      ? `note:workbench:v1:${get().user!.id}:${get().workspaceId}`
      : null;
  const persist = () => {
    const key = scope();
    if (key)
      preferences.setItem(
        key,
        JSON.stringify({
          tabs: get().tabs,
          recentPageIds: get().recentPageIds,
          sidebarCollapsed: get().sidebarCollapsed,
          tableSelections: get().tableSelections,
        }),
      );
  };
  const activeKey = () => tabKey(get().selectedId, get().view);
  return {
    tableSelections: {},
    selectTableView(databaseId, viewId) {
      set({ tableSelections: { ...get().tableSelections, [databaseId]: viewId } });
      persist();
    },
    tabs: [],
    closedTabs: [],
    recentPageIds: [],
    focusTitleId: null,
    commandOpen: false,
    sidebarCollapsed: false,
    focusMode: false,
    toggleFocusMode() {
      set({ focusMode: !get().focusMode });
    },
    editorRequest: null,
    requestEditor(command) {
      if (get().selectedId && get().view === 'document')
        set({
          editorRequest: {
            pageId: get().selectedId!,
            command,
            serial: (get().editorRequest?.serial ?? 0) + 1,
          },
        });
    },
    navigationHistory: { entries: [], index: -1 },
    goBack() {
      if (get().navigationHistory.index > 0) globalThis.history?.back();
    },
    goForward() {
      const history = get().navigationHistory;
      if (history.index < history.entries.length - 1) globalThis.history?.forward();
    },
    showCommands() {
      set({ commandOpen: true, dialog: null });
    },
    toggleSidebar() {
      set({ sidebarCollapsed: !get().sidebarCollapsed });
      persist();
    },
    togglePageDetails() {
      set({ contextOpen: !get().contextOpen, pagePanelTab: 'details' });
    },
    focusPageTitle() {
      set({ focusTitleId: get().selectedId });
    },
    trackNavigation(pageId, view, mode = 'push') {
      const id = tabKey(pageId, view),
        tabs = [...get().tabs],
        existing = tabs.findIndex((tab) => tab.id === id);
      if (existing < 0) {
        const preview = tabs.findIndex((tab) => tab.id === activeKey() && !tab.pinned);
        const next = { id, pageId, view, pinned: false };
        if (preview >= 0) tabs.splice(preview, 1, next);
        else tabs.push(next);
      } else if (tabs[existing].pageId !== pageId) tabs[existing] = { ...tabs[existing], pageId };
      set({
        tabs,
        navigationHistory: navigateHistory(
          get().navigationHistory,
          { pageId, view },
          mode,
          globalThis.history?.state?.noteWorkbench?.workspaceId === get().workspaceId
            ? globalThis.history.state.noteWorkbench.index
            : undefined,
        ),
        recentPageIds: pageId
          ? [pageId, ...get().recentPageIds.filter((id) => id !== pageId)].slice(0, 30)
          : get().recentPageIds,
      });
      persist();
    },
    openTab(pageId, view) {
      view ??=
        get().pages.find((page) => page.id === pageId)?.kind === 'database'
          ? 'database'
          : 'document';
      const id = tabKey(pageId, view),
        tabs = get().tabs.map((tab) =>
          tab.id === activeKey() || tab.id === id ? { ...tab, pinned: true } : tab,
        );
      if (!tabs.some((tab) => tab.id === id)) tabs.push({ id, pageId, view, pinned: true });
      set({ tabs });
      get().navigate(pageId, view);
      persist();
    },
    activateTab(id) {
      const tab = get().tabs.find((tab) => tab.id === id);
      if (tab) get().navigate(tab.pageId, tab.view);
    },
    closeTab(id) {
      const before = get().tabs,
        index = before.findIndex((tab) => tab.id === id),
        tab = before[index];
      if (!tab) return;
      const wasActive = activeKey() === id,
        tabs = before.filter((tab) => tab.id !== id);
      set({
        tabs,
        closedTabs: [tab, ...get().closedTabs.filter((item) => item.id !== id)].slice(0, 20),
      });
      if (wasActive) {
        const next = tabs[Math.min(index, tabs.length - 1)];
        get().navigate(next?.pageId ?? null, next?.view ?? 'all');
      }
      persist();
    },
    pinTab(id) {
      set({ tabs: get().tabs.map((tab) => (tab.id === id ? { ...tab, pinned: true } : tab)) });
      persist();
    },
    reopenTab() {
      const [tab, ...rest] = get().closedTabs;
      if (tab) {
        set({ closedTabs: rest });
        get().openTab(tab.pageId, tab.view);
      }
    },
    reorderTabs(source, target) {
      const tabs = [...get().tabs],
        from = tabs.findIndex((tab) => tab.id === source),
        to = tabs.findIndex((tab) => tab.id === target);
      if (from < 0 || to < 0 || from === to) return;
      const [tab] = tabs.splice(from, 1);
      tabs.splice(to, 0, tab);
      set({ tabs });
      persist();
    },
    restoreWorkbench() {
      let tableSelections: Record<string, string> = {};
      let tabs: WorkbenchTab[] = [],
        recentPageIds: string[] = [],
        sidebarCollapsed = false;
      try {
        const key = scope(),
          saved = key ? preferences.getItem(key) : null,
          value = saved ? JSON.parse(saved) : {};
        if (Array.isArray(value.tabs))
          tabs = value.tabs
            .filter(
              (tab: WorkbenchTab) =>
                tab &&
                ['document', 'database', 'graph', 'all'].includes(tab.view) &&
                (tab.pageId === null || typeof tab.pageId === 'string') &&
                tab.id === tabKey(tab.pageId, tab.view),
            )
            .slice(0, 200)
            .map((tab: WorkbenchTab) => ({
              id: tab.id,
              pageId: tab.pageId,
              view: tab.view,
              pinned: Boolean(tab.pinned),
            }));
        tabs = [...new Map(tabs.map((tab) => [tab.id, tab])).values()];
        if (Array.isArray(value.recentPageIds))
          recentPageIds = value.recentPageIds
            .filter((id: unknown) => typeof id === 'string')
            .slice(0, 30);
        sidebarCollapsed = Boolean(value.sidebarCollapsed);
        if (
          value.tableSelections &&
          typeof value.tableSelections === 'object' &&
          !Array.isArray(value.tableSelections)
        )
          tableSelections = Object.fromEntries(
            Object.entries(value.tableSelections)
              .filter(
                ([id, view]) =>
                  /^[\w-]{1,128}$/u.test(id) &&
                  typeof view === 'string' &&
                  /^[\w-]{1,128}$/u.test(view),
              )
              .slice(0, 200),
          ) as Record<string, string>;
      } catch {
        /* Corrupt optional working context never blocks the workspace. */
      }
      set({
        tabs,
        tableSelections,
        recentPageIds,
        sidebarCollapsed,
        closedTabs: [],
        commandOpen: false,
        focusTitleId: null,
        editorRequest: null,
        focusMode: false,
        navigationHistory: { entries: [], index: -1 },
      });
    },
    clearWorkbench() {
      const key = scope();
      if (key) preferences.removeItem(key);
      set({
        tableSelections: {},
        tabs: [],
        closedTabs: [],
        recentPageIds: [],
        focusTitleId: null,
        commandOpen: false,
        sidebarCollapsed: false,
        focusMode: false,
        editorRequest: null,
        navigationHistory: { entries: [], index: -1 },
      });
    },
    reconcileTabs(pages) {
      const ids = new Set(pages.map((page) => page.id));
      const visible = (tab: WorkbenchTab) =>
        !tab.pageId || ids.has(tab.pageId) || ['graph', 'all'].includes(tab.view);
      const normalize = (tab: WorkbenchTab): WorkbenchTab => {
        if (tab.pageId && !ids.has(tab.pageId)) return { ...tab, pageId: null };
        if (
          tab.view === 'document' &&
          pages.find((page) => page.id === tab.pageId)?.kind === 'database'
        )
          return { ...tab, id: tabKey(tab.pageId, 'database'), view: 'database' };
        return tab;
      };
      set({
        tabs: [
          ...new Map(
            get()
              .tabs.filter(visible)
              .map(normalize)
              .map((tab) => [tab.id, tab]),
          ).values(),
        ],
        closedTabs: get().closedTabs.filter(visible).map(normalize),
        recentPageIds: get().recentPageIds.filter((id) => ids.has(id)),
      });
      persist();
    },
    async createQuickPage(parentId = null, kind = 'document') {
      const user = get().user?.id,
        workspace = get().workspaceId;
      const page = await get().createPage(
        {
          title: kind === 'database' ? 'Untitled database' : 'Untitled',
          parentId: parentId ?? undefined,
          kind,
        },
        { navigate: false },
      );
      if (get().user?.id !== user || get().workspaceId !== workspace) return;
      get().openTab(page.id, kind === 'database' ? 'database' : 'document');
      set({ focusTitleId: page.id });
    },
  };
}
