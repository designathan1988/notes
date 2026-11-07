import {
  ChevronDown,
  ChevronRight,
  Search,
  Files,
  Network,
  Database,
  Plus,
  Star,
  UserPlus,
  Settings,
  Building2,
  FileText,
  Folder,
  LogOut,
  X,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useWorkspace } from '../state/store.js';
import { IconButton } from '../ui/IconButton.js';
import type { Page } from '../../../../packages/contracts/src/index.js';
import { useTreeDrag } from './useTreeDrag.js';
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
  const selected = useWorkspace((state) => state.selectedId);
  const expanded = useWorkspace((state) => state.expanded.includes(page.id));
  const cursor = useWorkspace((state) => state.navigationCursors[page.id]);
  const children = pages
    .filter((item) => item.parentId === page.id && item.kind !== 'record')
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const hasChildren = page.hasChildren || children.length > 0;
  const Icon = page.kind === 'database' ? Database : hasChildren ? Folder : FileText;
  return (
    <>
      <div
        className={`tree-row ${selected === page.id ? 'selected' : ''} ${drop?.id === page.id ? 'tree-drop-' + drop.edge : ''}`}
        data-tree-page={page.id}
        style={{ '--depth': Math.min(depth, 8) } as React.CSSProperties}
      >
        {hasChildren ? (
          <button
            className="tree-toggle"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${page.title}`}
            onClick={() => useWorkspace.getState().toggleExpanded(page.id)}
          >
            {expanded ? <ChevronDown /> : <ChevronRight />}
          </button>
        ) : (
          <span className="tree-toggle" />
        )}
        <button
          className="tree-page"
          onClick={() =>
            useWorkspace
              .getState()
              .navigate(page.id, page.kind === 'database' ? 'database' : 'document')
          }
        >
          <Icon />
          <span>{page.title}</span>
        </button>
      </div>
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
          Load more pages
        </button>
      )}
    </>
  );
}
export function Sidebar() {
  const state = useWorkspace();
  const drag = useTreeDrag();
  const drawer = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!state.sidebarOpen) return;
    drawer.current
      ?.querySelector<HTMLButtonElement>('[aria-label="Close navigation drawer"]')
      ?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        useWorkspace.setState({ sidebarOpen: false });
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
      document.querySelector<HTMLButtonElement>('[aria-label="Open navigation"]')?.focus();
    };
  }, [state.sidebarOpen]);
  const workspace = state.workspaces.find((item) => item.id === state.workspaceId);
  return (
    <>
      <button
        className={`sidebar-scrim ${state.sidebarOpen ? 'visible' : ''}`}
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => useWorkspace.setState({ sidebarOpen: false })}
      />
      <aside
        ref={drawer}
        className={`sidebar ${state.sidebarOpen ? 'open' : ''}`}
        aria-label="Workspace navigation"
        onPointerDown={drag.start}
        onClickCapture={drag.captureClick}
        data-drop-id={drag.target?.id ?? ''}
        data-drop-edge={drag.target?.edge ?? ''}
      >
        <button
          className="mobile-navigation-close icon-button"
          aria-label="Close navigation drawer"
          onClick={() => useWorkspace.setState({ sidebarOpen: false })}
        >
          <X size={18} />
        </button>
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            state.navigate(
              state.pages.find((p) => p.title === 'Product direction')?.id ??
                state.pages[0]?.id ??
                null,
            );
          }}
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
          Note
        </a>
        <label className="workspace-select">
          <Building2 size={17} />
          <select
            aria-label="Workspace"
            value={state.workspaceId ?? ''}
            onChange={(event) => void state.chooseWorkspace(event.target.value)}
          >
            {state.workspaces.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <ChevronDown size={15} />
        </label>
        <button className="search-trigger" onClick={() => state.openDialog('search')}>
          <Search size={18} />
          <span>Search anything</span>
          <kbd>Ctrl K</kbd>
        </button>
        <nav className="main-nav">
          <button onClick={() => state.navigate(state.selectedId, 'all')}>
            <Files />
            All pages
          </button>
          <button onClick={() => state.navigate(state.selectedId, 'graph')}>
            <Network />
            Knowledge graph
          </button>
          <button onClick={() => state.navigate(null, 'database')}>
            <Database />
            Databases
          </button>
        </nav>
        <div className="sidebar-scroll">
          <div
            className="section-label"
            data-tree-root
            data-drag-over={drag.target?.id === null || undefined}
          >
            <span>Workspace</span>
            <IconButton
              label="Create page"
              disabled={workspace?.role === 'viewer'}
              onClick={() => state.openCreatePage()}
            >
              <Plus />
            </IconButton>
          </div>
          {drag.label && (
            <div className="tree-drag-status" role="status">
              Moving {drag.label}. Drop between pages to reorder, or on a page to nest.
            </div>
          )}
          <div className="page-tree">
            {state.pages
              .filter((page) => !page.parentId)
              .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
              .map((page) => (
                <PageRow key={page.id} page={page} depth={0} drop={drag.target} />
              ))}
            {state.navigationCursors.root && (
              <button
                className="tree-more"
                onClick={() => void state.loadChildren(null, true).catch(state.setError)}
              >
                Load more pages
              </button>
            )}
          </div>
          <div className="section-label favorites-label">Favorites</div>
          <div className="favorites">
            {state.pages
              .filter((page) => state.favorites.includes(page.id))
              .map((page) => (
                <button
                  key={page.id}
                  onClick={() =>
                    state.navigate(page.id, page.kind === 'database' ? 'database' : 'document')
                  }
                >
                  <Star />
                  <span>{page.title}</span>
                </button>
              ))}
          </div>
        </div>
        <footer className="sidebar-footer">
          <button onClick={() => state.openDialog('invite')}>
            <UserPlus />
            Invite people
          </button>
          <button onClick={() => state.openDialog('settings')}>
            <Settings />
            Settings
          </button>
          <div className="user-row">
            <span className="avatar">{state.user?.name[0]}</span>
            <span>{state.user?.name}</span>
            <IconButton label="Sign out" onClick={() => void state.signOut().catch(state.setError)}>
              <LogOut size={15} />
            </IconButton>
            <small className={state.online ? 'connection' : 'connection offline'}>
              {state.online ? 'Connected' : 'Offline'}
            </small>
          </div>
        </footer>
      </aside>
    </>
  );
}
