import { expect, test } from 'vitest';
import { availableCommands, shortcutCommand } from '../apps/web/src/workbench/commands.js';
import type { WorkspaceState } from '../apps/web/src/state/store.js';
const state = {
  user: { id: 'member' },
  workspaceId: 'studio',
  workspaces: [{ id: 'studio', role: 'editor' }],
  pages: [],
  tabs: [],
  closedTabs: [],
} as unknown as WorkspaceState;
const key = (key: string, altKey = false, shiftKey = false) => ({
  key,
  ctrlKey: true,
  metaKey: false,
  altKey,
  shiftKey,
});
test('browser tab shortcuts remain native while explicit application shortcuts dispatch the matching action', () => {
  expect(shortcutCommand(key('w'), state)).toBeUndefined();
  expect(shortcutCommand(key('t'), state)).toBeUndefined();
  expect(shortcutCommand(key('n', true), state)?.id).toBe('page.new');
  expect(shortcutCommand(key('p', false, true), state)?.id).toBe('workspace.commands');
});
test('viewers discover navigation commands without being offered editing commands', () => {
  const viewer = { ...state, workspaces: [{ id: 'studio', role: 'viewer' }] } as WorkspaceState;
  expect(availableCommands(viewer).some((command) => command.id === 'page.new')).toBe(false);
  expect(shortcutCommand(key('n', true), viewer)).toBeUndefined();
  expect(availableCommands(viewer, 'all pages').map((command) => command.id)).toContain(
    'workspace.all',
  );
  expect(availableCommands(state, 'np').map((command) => command.id)).toContain('page.new');
});
