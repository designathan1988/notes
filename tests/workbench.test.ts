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

test('graph positions and cameras are scoped visual preferences, never page mutations or copied titles', () => {
  const { get, set, saved } = fixture(),
    state = get();
  state.placeGraphNode('shared', { x: 125, y: -80 });
  state.setGraphCamera('all', { x: 12, y: 24, zoom: 1.4 });
  expect(state.pages).toEqual([]);
  expect(state.graphPlacements).toEqual({ shared: { x: 125, y: -80 } });
  expect([...saved.values()].join('')).not.toContain('title');
  set({ user: { id: 'bob' } as WorkspaceState['user'] });
  state.restoreWorkbench();
  expect(state.graphPlacements).toEqual({});
  expect(state.graphCameras).toEqual({});
  set({ user: { id: 'alice' } as WorkspaceState['user'] });
  state.restoreWorkbench();
  expect(state.graphPlacements.shared).toEqual({ x: 125, y: -80 });
  expect(state.graphCameras.all).toEqual({ x: 12, y: 24, zoom: 1.4 });
  state.placeGraphNode('shared', null);
  expect(state.graphPlacements).toEqual({});
  state.placeGraphNode('another', { x: 4, y: 5 });
  state.resetGraphPositions();
  expect(state.graphPlacements).toEqual({});
  state.clearWorkbench();
  expect(state.graphCameras).toEqual({});
});

test('corrupt spatial preferences cannot introduce nonfinite coordinates or unbounded zoom', () => {
  const { get, saved } = fixture(),
    state = get();
  saved.set(
    'note:workbench:v1:alice:studio',
    JSON.stringify({
      graphPlacements: {
        valid: { x: 2, y: 3 },
        broken: { x: null, y: 2 },
        huge: { x: 1e30, y: 1 },
        'bad/key': { x: 1, y: 1 },
      },
      graphCameras: { all: { x: 0, y: 0, zoom: -1 }, valid: { x: 1, y: 2, zoom: 1 } },
    }),
  );
  state.restoreWorkbench();
  expect(state.graphPlacements).toEqual({ valid: { x: 2, y: 3 } });
  expect(state.graphCameras).toEqual({ valid: { x: 1, y: 2, zoom: 1 } });
});

test('canvas tabs resolve their actual kind and camera preferences stay scoped with the workbench owner', () => {
  const { get, set } = fixture(),
    state = get();
  set({ pages: [{ id: 'board', kind: 'canvas' }] as WorkspaceState['pages'] });
  state.openTab('board');
  expect(state.tabs[0]).toMatchObject({ id: 'canvas:board', view: 'canvas' });
  state.setCanvasCamera('board', { x: 10, y: 20, zoom: 1.2 });
  set({ user: { id: 'bob' } as WorkspaceState['user'] });
  state.restoreWorkbench();
  expect(state.canvasCameras).toEqual({});
  set({ user: { id: 'alice' } as WorkspaceState['user'] });
  state.restoreWorkbench();
  expect(state.canvasCameras.board).toEqual({ x: 10, y: 20, zoom: 1.2 });
  state.clearWorkbench();
  expect(state.canvasCameras).toEqual({});
});
