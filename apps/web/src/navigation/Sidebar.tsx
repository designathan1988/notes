import { t } from '../i18n/index.js';
import { Select } from '../ui/Select.js';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Files,
  Network,
  Database,
  Plus,
  UserPlus,
  Settings,
  FileText,
  AppWindow,
  Folder,
  LogOut,
  X,
  Command,
  SlidersHorizontal,
  MoreHorizontal,
  LayoutTemplate,
  Shapes,
  House,
  Monitor,
  Moon,
  Sun,
  Palette,
  SquarePen,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../state/store.js';
import { IconButton } from '../ui/IconButton.js';
import type { Page } from '@note/contracts';
import { useTreeDrag } from './useTreeDrag.js';
import { PageActions } from './PageActions.js';
import { Popover } from '../ui/Popover.js';
import { BrandMark } from '../ui/BrandMark.js';
import { GLOBAL_VIEWS } from '../state/views.js';
import { applyTheme, useTheme, type Theme } from '../ui/theme.js';
import { pageView } from '../workbench/route.js';
function PageRow({
  page,
  depth,
  drop,
}: {
  page: Page;
  depth: number;
  drop?: { id: string | null; edge: string } | null;
}) {
  const pages = useWorkspace((state) => state.pages);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const readOnly = useWorkspace(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === state.workspaceId)?.role === 'viewer',
  );
  // Highlight the open page only while a page is on screen, not on workspace-wide views.
  const selected = useWorkspace((state) =>
    GLOBAL_VIEWS.includes(state.view) ? null : state.selectedId,
  );
  const expanded = useWorkspace((state) => state.expanded.includes(page.id));
  const cursor = useWorkspace((state) => state.navigationCursors[page.id]);
  const children = pages
    .filter((item) => item.parentId === page.id && item.kind !== 'record')
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const hasChildren = page.hasChildren || children.length > 0;
  const Icon =
    page.kind === 'canvas'
      ? Shapes
      : page.kind === 'database'
        ? Database
        : page.format === 'web'
          ? AppWindow
          : hasChildren
            ? Folder
            : FileText;
  return (
    <>
      <div
        className={`tree-row ${selected === page.id ? 'selected' : ''} ${drop?.id === page.id ? 'tree-drop-' + drop.edge : ''}`}
        data-tree-page={page.id}
        data-kind={page.kind}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu(event.currentTarget);
        }}
        style={{ '--depth': Math.min(depth, 8) } as React.CSSProperties}
      >
        {hasChildren ? (
          <button
            className="tree-toggle"
            aria-label={t(expanded ? 'Collapse {{title}}' : 'Expand {{title}}', {
              title: page.title,
            })}
            onClick={() => useWorkspace.getState().toggleExpanded(page.id)}
          >
            {expanded ? <ChevronDown /> : <ChevronRight />}
          </button>
        ) : (
          <span className="tree-toggle" />
        )}
        <button
          className="tree-page"
          onClick={(event) => {
            const state = useWorkspace.getState();
            if (event.ctrlKey || event.metaKey) state.openTab(page.id, pageView(page.kind));
            else state.navigate(page.id, pageView(page.kind));
          }}
        >
          {page.icon ? (
            <span className="page-reference-icon" aria-hidden="true">
              {page.icon}
            </span>
          ) : (
            <Icon />
          )}
          <span>{page.title}</span>
        </button>
        <span className="tree-row-actions" data-tree-control>
          {page.kind === 'document' && !readOnly && (
            <button
              aria-label={t('Add subpage to {{title}}', { title: page.title })}
              onClick={() =>
                void useWorkspace
                  .getState()
                  .createQuickPage(page.id)
                  .catch(useWorkspace.getState().setError)
              }
            >
              <Plus size={13} />
            </button>
          )}
          <button
            aria-label={t('Actions for {{title}}', { title: page.title })}
            onClick={(event) => setMenu(event.currentTarget)}
          >
            <MoreHorizontal size={13} />
          </button>
        </span>
      </div>
      {menu && <PageActions page={page} anchor={menu} close={() => setMenu(null)} />}
      {expanded &&
        children.map((child) => (
          <PageRow key={child.id} page={child} depth={depth + 1} drop={drop} />
        ))}
      {expanded && cursor && (
        <button
          className="tree-more"
          onClick={() =>
            void useWorkspace
              .getState()
              .loadChildren(page.id, true)
              .catch(useWorkspace.getState().setError)
          }
        >
          {t('Load more pages')}
        </button>
      )}
    </>
  );
}
export function Sidebar() {
  const state = useWorkspace();
  const [accountMenu, setAccountMenu] = useState<HTMLElement | null>(null);
  const theme = useTheme();
  const drag = useTreeDrag();
  const drawer = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!state.sidebarOpen) return;
    drawer.current?.querySelector<HTMLButtonElement>('[data-close-navigation]')?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        useWorkspace.getState().setSidebarOpen(false);
      }
      if (event.key === 'Tab') {
        const items = [
          ...(drawer.current?.querySelectorAll<HTMLElement>(
            'a[href],button:not(:disabled),select:not(:disabled)',
          ) ?? []),
        ].filter(
          (element) =>
            getComputedStyle(element).display !== 'none' && element.getClientRects().length > 0,
        );
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keys);
    return () => {
      document.removeEventListener('keydown', keys);
      document.querySelector<HTMLButtonElement>('[data-open-navigation]')?.focus();
    };
  }, [state.sidebarOpen]);
  const workspace = state.workspaces.find((item) => item.id === state.workspaceId);
  const templateId = state.pages.find((page) => page.id === state.selectedId)?.templateRootId,
    template = state.pages.find((page) => page.id === templateId);
  const destinations = [
    { view: 'home', label: 'Home', Icon: House },
    { view: 'all', label: 'All pages', Icon: Files },
    { view: 'graph', label: 'Knowledge graph', Icon: Network },
    { view: 'database', label: 'Databases', Icon: Database },
    { view: 'templates', label: 'Templates', Icon: LayoutTemplate },
    { view: 'canvas', label: 'Canvases', Icon: Shapes },
  ] as const;
  const utilities = [
    { label: 'Commands', Icon: Command, run: state.showCommands },
    { label: 'Invite people', Icon: UserPlus, run: () => state.openDialog('invite') },
    { label: 'Settings', Icon: Settings, run: () => state.openDialog('settings') },
  ];
  return (
    <>
      <button
        className={`sidebar-scrim ${state.sidebarOpen ? 'visible' : ''}`}
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => useWorkspace.getState().setSidebarOpen(false)}
      />
      <aside
        ref={drawer}
        className={`sidebar ${state.sidebarOpen ? 'open' : ''}`}
        aria-label={t('Workspace navigation')}
        onPointerDown={drag.start}
        onClickCapture={drag.captureClick}
        data-drop-id={drag.target?.id ?? ''}
        data-drop-edge={drag.target?.edge ?? ''}
      >
        <button
          className="mobile-navigation-close icon-button"
          aria-label={t('Close navigation drawer')}
          data-close-navigation
          onClick={() => useWorkspace.getState().setSidebarOpen(false)}
        >
          <X size={18} />
        </button>
        <div className="sidebar-pane">
          <div className="workspace-identity">
            <label className="workspace-select">
              <BrandMark size={24} />
              <span className="workspace-names">
                <strong>Mosaic</strong>
                <Select
                  aria-label={t('Workspace')}
                  value={state.workspaceId ?? ''}
                  onChange={(event) => void state.chooseWorkspace(event.target.value)}
                >
                  {state.workspaces.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </span>
            </label>
            <IconButton
              label={t('New page')}
              disabled={workspace?.role === 'viewer'}
              onClick={() => void state.createQuickPage().catch(state.setError)}
            >
              <SquarePen size={17} />
            </IconButton>
          </div>
          <button className="search-trigger" onClick={() => state.openDialog('search')}>
            <Search size={15} />
            <span>{t('Search')}</span>
            <kbd>Ctrl K</kbd>
          </button>
          <nav className="workspace-destinations" aria-label={t('Workspace tools')}>
            {destinations.map(({ view, label, Icon }) => {
              // Databases and Canvases are indexes: an open database or canvas page is
              // highlighted in the page tree, not as the index.
              const active = template
                ? view === 'templates'
                : state.view === view && (GLOBAL_VIEWS.includes(view) || !state.selectedId);
              return (
                <button
                  key={view}
                  aria-label={t(label)}
                  aria-current={active ? 'page' : undefined}
                  onClick={() =>
                    state.navigate(['all', 'graph'].includes(view) ? state.selectedId : null, view)
                  }
                >
                  <Icon size={16} />
                  <span>{t(label)}</span>
                </button>
              );
            })}
          </nav>
          <div className="sidebar-scroll">
            {state.favorites.length > 0 && (
              <>
                <div className="section-label favorites-label">{t('Favorites')}</div>
                <div className="favorites">
                  {state.pages
                    .filter((page) => state.favorites.includes(page.id) && !page.templateRootId)
                    .map((page) => (
                      <button
                        key={page.id}
                        data-kind={page.kind}
                        onClick={() => state.navigate(page.id, pageView(page.kind))}
                      >
                        {page.icon ? (
                          <span className="page-reference-icon" aria-hidden="true">
                            {page.icon}
                          </span>
                        ) : (
                          <FileText />
                        )}
                        <span>{page.title}</span>
                      </button>
                    ))}
                </div>
              </>
            )}
            <div
              className="section-label"
              data-tree-root
              data-drag-over={drag.target?.id === null || undefined}
            >
              <span>{t('Pages')}</span>
              <IconButton
                label={t('Create page')}
                disabled={workspace?.role === 'viewer'}
                onClick={() => void state.createQuickPage().catch(state.setError)}
              >
                <Plus />
              </IconButton>
              <IconButton
                label={t('New page options')}
                disabled={workspace?.role === 'viewer'}
                onClick={() => state.openCreatePage()}
              >
                <SlidersHorizontal size={13} />
              </IconButton>
            </div>
            {drag.label && (
              <div className="tree-drag-status" role="status">
                {t('Moving {{title}}. Drop between pages to reorder, or on a page to nest.', {
                  title: drag.label,
                })}
              </div>
            )}
            <div className="page-tree">
              {state.pages
                .filter((page) => !page.parentId && !page.templateRootId)
                .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
                .map((page) => (
                  <PageRow key={page.id} page={page} depth={0} drop={drag.target} />
                ))}
              {state.navigationCursors.root && (
                <button
                  className="tree-more"
                  onClick={() => void state.loadChildren(null, true).catch(state.setError)}
                >
                  {t('Load more pages')}
                </button>
              )}
            </div>
            {template && (
              <>
                <div className="section-label">{t('Editing template')}</div>
                <div className="page-tree">
                  <PageRow key={template.id} page={template} depth={0} drop={drag.target} />
                </div>
              </>
            )}
          </div>
          <footer className="sidebar-footer">
            <button
              className="account-trigger"
              aria-label={t('Account menu')}
              aria-haspopup="menu"
              aria-expanded={!!accountMenu}
              onClick={(event) => setAccountMenu(accountMenu ? null : event.currentTarget)}
            >
              <span className="avatar">{state.user?.name[0]}</span>
              <span>{state.user?.name}</span>
              <ChevronDown size={13} />
              {!state.online && <small>{t('Offline')}</small>}
            </button>
            {accountMenu && (
              <Popover anchor={accountMenu} label={t('Account')} close={() => setAccountMenu(null)}>
                <div className="theme-switch" role="group" aria-label={t('Theme')}>
                  {(
                    [
                      ['light', 'Light', Sun],
                      ['dark', 'Dark', Moon],
                      ['system', 'System', Monitor],
                    ] as [Theme, string, typeof Sun][]
                  ).map(([value, label, Icon]) => (
                    <button
                      key={value}
                      role="menuitemradio"
                      aria-checked={theme === value}
                      onClick={() => applyTheme(value)}
                    >
                      <Icon size={14} />
                      {t(label)}
                    </button>
                  ))}
                </div>
                <div className="menu-list">
                  <button
                    onClick={() => {
                      setAccountMenu(null);
                      state.openAppearance('app');
                    }}
                  >
                    <Palette />
                    {t('Appearance')}
                  </button>
                  {utilities.map(({ label, Icon, run }) => (
                    <button
                      key={t(label)}
                      onClick={() => {
                        setAccountMenu(null);
                        run();
                      }}
                    >
                      <Icon />
                      {t(label)}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setAccountMenu(null);
                      void state.signOut().catch(state.setError);
                    }}
                  >
                    <LogOut />
                    {t('Sign out')}
                  </button>
                </div>
              </Popover>
            )}
          </footer>
        </div>
      </aside>
    </>
  );
}
