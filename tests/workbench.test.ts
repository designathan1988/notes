import { expect, test } from 'vitest';
import { workbenchSlice, tabKey } from '../apps/web/src/workbench/state.js';
import type { WorkspaceState, View } from '../apps/web/src/state/store.js';

function fixture() {
  const saved = new Map<string, string>();
  let state: WorkspaceState;
  const preferences = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value);
    },
    removeItem: (key: string) => {
      saved.delete(key);
    },
  };
  const set = (partial: Partial<WorkspaceState>) => Object.assign(state, partial);
  state = {
    user: { id: 'alice' },
    workspaceId: 'studio',
    selectedId: null,
    view: 'document',
    pages: [],
    ...workbenchSlice(set, () => state, preferences),
    navigate(id: string | null, view: View = 'document') {
      state.trackNavigation(id, view);
      set({ selectedId: id, view });
    },
  } as unknown as WorkspaceState;
  return { get: () => state, set, saved };
}
test('modifier-open preserves the current page and opens a canonical reference instead of a copied document', () => {
  const { get } = fixture();
  const state = get();
  state.navigate('first');
  state.openTab('second');
  expect(state.tabs.map((tab) => tab.pageId)).toEqual(['first', 'second']);
  expect(state.selectedId).toBe('second');
  expect(Object.keys(state.tabs[0]).sort()).toEqual(['id', 'pageId', 'pinned', 'view']);
  state.navigate('first');
  expect(state.tabs).toHaveLength(2);
});
test('ordinary navigation replaces only an unpinned preview, while close and reopen restore the working context', () => {
  const { get } = fixture();
  const state = get();
  state.navigate('first');
  state.navigate('second');
  expect(state.tabs.map((tab) => tab.pageId)).toEqual(['second']);
  state.openTab('third');
  state.closeTab(tabKey('third', 'document'));
  expect(state.selectedId).toBe('second');
  state.reopenTab();
  expect(state.selectedId).toBe('third');
  state.reorderTabs(tabKey('third', 'document'), tabKey('second', 'document'));
  expect(state.tabs.map((tab) => tab.pageId)).toEqual(['third', 'second']);
});
test('restored working sets are isolated by identity and workspace and invalid references disappear', () => {
  const { get, set, saved } = fixture();
  const state = get();
  state.openTab('confidential');
  state.openTab('shared');
  expect([...saved.values()].join('')).not.toContain('title');
  set({ user: { id: 'bob' } as WorkspaceState['user'] });
  state.restoreWorkbench();
  expect(state.tabs).toEqual([]);
  set({ user: { id: 'alice' } as WorkspaceState['user'], workspaceId: 'other' });
  state.restoreWorkbench();
  expect(state.tabs).toEqual([]);
  set({ workspaceId: 'studio' });
  state.restoreWorkbench();
  expect(state.tabs.map((tab) => tab.pageId)).toEqual(['confidential', 'shared']);
  state.reconcileTabs([{ id: 'shared' }] as WorkspaceState['pages']);
  expect(state.tabs.map((tab) => tab.pageId)).toEqual(['shared']);
  state.clearWorkbench();
  expect(state.tabs).toEqual([]);
});
test('an unloaded database reference becomes one canonical database tab when metadata arrives', () => {
  const { get } = fixture();
  const state = get();
  state.openTab('collection');
  state.reconcileTabs([{ id: 'collection', kind: 'database' }] as WorkspaceState['pages']);
  expect(state.tabs.map((tab) => [tab.id, tab.view])).toEqual([
    ['database:collection', 'database'],
  ]);
});

test('preferred saved database views persist as scoped references and clear on identity changes', () => {
  const { get, set } = fixture(),
    state = get();
  state.selectTableView('database', 'calendar-view');
  set({ user: { id: 'bob' } as WorkspaceState['user'] });
  state.restoreWorkbench();
  expect(state.tableSelections).toEqual({});
  set({ user: { id: 'alice' } as WorkspaceState['user'] });
  state.restoreWorkbench();
  expect(state.tableSelections).toEqual({ database: 'calendar-view' });
  state.clearWorkbench();
  expect(state.tableSelections).toEqual({});
});
