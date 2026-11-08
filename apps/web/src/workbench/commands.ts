import type { WorkspaceState } from '../state/store.js';
import { tabKey } from './state.js';
export interface AppCommand {
  id: string;
  title: string;
  group: 'Create' | 'Navigate' | 'Workspace' | 'Page';
  keywords?: string;
  shortcut?: { key: string; alt?: boolean; shift?: boolean; label: string };
  available?(state: WorkspaceState): boolean;
  run(state: WorkspaceState): void | Promise<void>;
}
const page = (state: WorkspaceState) => state.pages.find((page) => page.id === state.selectedId);
const canWrite = (state: WorkspaceState) => {
  const role = state.workspaces.find((workspace) => workspace.id === state.workspaceId)?.role;
  return !!role && role !== 'viewer';
};
export const commands: AppCommand[] = [
  {
    id: 'appearance.app',
    title: 'Customize app appearance',
    group: 'Workspace',
    keywords: 'theme fonts colors styles CSS density',
    run: (state) => state.openAppearance('app'),
  },
  {
    id: 'appearance.page',
    title: 'Customize page style',
    group: 'Page',
    keywords: 'fonts colors CSS typography',
    available: (state) => !!page(state),
    run: (state) => state.openAppearance('page'),
  },
  {
    id: 'appearance.reset',
    title: 'Reset app appearance',
    group: 'Workspace',
    keywords: 'restore default theme CSS',
    run: (state) => state.resetAppearance(),
  },
  {
    id: 'page.canvas',
    title: 'New canvas',
    group: 'Create',
    keywords: 'spatial board whiteboard notes',
    available: canWrite,
    run: (state) => state.createQuickPage(null, 'canvas'),
  },
  {
    id: 'workspace.templates',
    title: 'Open templates',
    group: 'Navigate',
    keywords: 'library reusable starting points',
    run: (state) => state.navigate(null, 'templates'),
  },
  {
    id: 'page.template',
    title: 'Save as template',
    group: 'Page',
    available: (state) => canWrite(state) && !!page(state),
    run: (state) => {
      if (state.selectedId) return state.openSaveTemplate(state.selectedId);
    },
  },
  {
    id: 'editor.focus',
    title: 'Toggle focus mode',
    group: 'Page',
    keywords: 'writing distraction sidebar',
    available: (state) => state.view === 'document' && !!page(state),
    run: (state) => state.toggleFocusMode(),
  },
  {
    id: 'editor.find',
    title: 'Find in current page',
    group: 'Page',
    keywords: 'search replace document text',
    shortcut: { key: 'f', alt: true, label: 'Ctrl Alt F' },
    available: (state) =>
      state.view === 'document' && !!page(state) && page(state)?.kind !== 'database',
    run: (state) => state.requestEditor('find'),
  },
  {
    id: 'editor.templates',
    title: 'Insert document template',
    group: 'Page',
    keywords: 'meeting project decision research',
    available: (state) =>
      canWrite(state) &&
      state.view === 'document' &&
      !!page(state) &&
      page(state)?.kind !== 'database',
    run: (state) => state.requestEditor('templates'),
  },
  {
    id: 'page.new',
    title: 'New page',
    group: 'Create',
    keywords: 'create note document capture',
    shortcut: { key: 'n', alt: true, label: 'Ctrl Alt N' },
    available: canWrite,
    run: (state) => state.createQuickPage(),
  },
  {
    id: 'page.subpage',
    title: 'New subpage',
    group: 'Create',
    keywords: 'create child nested',
    shortcut: { key: 'n', alt: true, shift: true, label: 'Ctrl Alt Shift N' },
    available: (state) => canWrite(state) && page(state)?.kind === 'document',
    run: (state) => state.createQuickPage(state.selectedId),
  },
  {
    id: 'database.new',
    title: 'New database',
    group: 'Create',
    keywords: 'table data records',
    shortcut: { key: 'b', alt: true, label: 'Ctrl Alt B' },
    available: canWrite,
    run: (state) => state.createQuickPage(null, 'database'),
  },
  {
    id: 'page.options',
    title: 'New page with options',
    group: 'Create',
    keywords: 'private location advanced',
    available: canWrite,
    run: (state) => state.openCreatePage(),
  },
  {
    id: 'workspace.search',
    title: 'Search workspace',
    group: 'Navigate',
    keywords: 'find open page quick switcher',
    shortcut: { key: 'k', label: 'Ctrl K' },
    run: (state) => state.openDialog('search'),
  },
  {
    id: 'workspace.all',
    title: 'Open all pages',
    group: 'Navigate',
    keywords: 'browse explorer',
    run: (state) => state.navigate(null, 'all'),
  },
  {
    id: 'workspace.graph',
    title: 'Open knowledge graph',
    group: 'Navigate',
    keywords: 'connections backlinks',
    run: (state) => state.navigate(state.selectedId, 'graph'),
  },
  {
    id: 'workspace.databases',
    title: 'Open databases',
    group: 'Navigate',
    keywords: 'tables collections',
    run: (state) => state.navigate(null, 'database'),
  },
  {
    id: 'tab.close',
    title: 'Close current tab',
    group: 'Workspace',
    shortcut: { key: 'w', alt: true, label: 'Ctrl Alt W' },
    available: (state) => state.tabs.length > 0,
    run: (state) => state.closeTab(tabKey(state.selectedId, state.view)),
  },
  {
    id: 'tab.reopen',
    title: 'Reopen closed tab',
    group: 'Workspace',
    shortcut: { key: 't', alt: true, shift: true, label: 'Ctrl Alt Shift T' },
    available: (state) => state.closedTabs.length > 0,
    run: (state) => state.reopenTab(),
  },
  {
    id: 'tab.keep',
    title: 'Keep current tab open',
    group: 'Workspace',
    keywords: 'pin preview',
    run: (state) => state.pinTab(tabKey(state.selectedId, state.view)),
  },
  {
    id: 'page.details',
    title: 'Toggle page details',
    group: 'Page',
    keywords: 'outline linked mentions inspector',
    available: (state) => !!page(state),
    run: (state) => state.togglePageDetails(),
  },
  {
    id: 'page.rename',
    title: 'Rename current page',
    group: 'Page',
    keywords: 'title edit',
    available: (state) => canWrite(state) && !!page(state),
    run: (state) => state.focusPageTitle(),
  },
  {
    id: 'page.comments',
    title: 'Open page comments',
    group: 'Page',
    keywords: 'discussion reply resolve',
    available: (state) => !!page(state),
    run: (state) => state.openPagePanel('discussion'),
  },
  {
    id: 'page.history',
    title: 'Open version history',
    group: 'Page',
    keywords: 'restore revision snapshot',
    available: (state) => !!page(state),
    run: (state) => state.openPagePanel('history'),
  },
  {
    id: 'workspace.sidebar',
    title: 'Toggle sidebar',
    group: 'Workspace',
    shortcut: { key: '\\', label: 'Ctrl \\' },
    run: (state) => state.toggleSidebar(),
  },
  {
    id: 'workspace.settings',
    title: 'Open settings',
    group: 'Workspace',
    keywords: 'members trash data account export import recovery',
    run: (state) => state.openDialog('settings'),
  },
  {
    id: 'workspace.commands',
    title: 'Show command palette',
    group: 'Workspace',
    shortcut: { key: 'p', shift: true, label: 'Ctrl Shift P' },
    run: (state) => state.showCommands(),
  },
];
export function availableCommands(state: WorkspaceState, query = '') {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return commands
    .filter((command) => !command.available || command.available(state))
    .map((command) => {
      const haystack = `${command.title} ${command.keywords ?? ''}`.toLowerCase();
      let score = 0;
      for (const word of words) {
        const index = haystack.indexOf(word);
        if (index >= 0) {
          score += index;
          continue;
        }
        let cursor = 0;
        for (const letter of word) {
          cursor = haystack.indexOf(letter, cursor);
          if (cursor < 0) return { command, score: Infinity };
          cursor++;
        }
        score += 100 + cursor;
      }
      return { command, score };
    })
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => a.score - b.score)
    .map((item) => item.command);
}
export function shortcutCommand(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
  state: WorkspaceState,
) {
  if (!(event.ctrlKey || event.metaKey) || !state.user) return;
  return commands.find(
    (command) =>
      command.shortcut &&
      command.shortcut.key === event.key.toLowerCase() &&
      Boolean(command.shortcut.alt) === event.altKey &&
      Boolean(command.shortcut.shift) === event.shiftKey &&
      (!command.available || command.available(state)),
  );
}
