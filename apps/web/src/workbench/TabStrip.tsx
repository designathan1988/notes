import { useEffect, useRef, useState } from 'react';
import {
  FileText,
  Database,
  Network,
  Files,
  Plus,
  X,
  Pin,
  PanelLeft,
  RotateCcw,
  LayoutTemplate,
  SquareDashed,
  PanelsTopLeft,
} from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import { tabKey } from './state.js';
import { IconButton } from '../ui/IconButton.js';
import { Popover } from '../ui/Popover.js';
export function TabStrip() {
  const state = useWorkspace(),
    active = tabKey(state.selectedId, state.view),
    root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ id: string; anchor: HTMLElement } | null>(null),
    [dragged, setDragged] = useState<string | null>(null),
    [mobileAnchor, setMobileAnchor] = useState<HTMLElement | null>(null);
  const cleanup = useRef<(() => void) | null>(null),
    skipClick = useRef(false);
  useEffect(() => () => cleanup.current?.(), []);
  useEffect(() => {
    const desktop = matchMedia('(min-width: 701px)');
    const resize = () => {
      if (desktop.matches) setMobileAnchor(null);
    };
    desktop.addEventListener('change', resize);
    return () => desktop.removeEventListener('change', resize);
  }, []);
  useEffect(() => {
    root.current
      ?.querySelector<HTMLElement>('[aria-selected=true]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);
  function drag(id: string, event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    cleanup.current?.();
    const x = event.clientX,
      y = event.clientY,
      pointer = event.pointerId;
    let moved = false,
      target = id;
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      if (!moved && Math.hypot(next.clientX - x, next.clientY - y) < 6) return;
      moved = true;
      skipClick.current = true;
      setDragged(id);
      const element = document
        .elementFromPoint(next.clientX, next.clientY)
        ?.closest<HTMLElement>('[data-workbench-tab]');
      if (element?.dataset.workbenchTab) target = element.dataset.workbenchTab;
    };
    const stop = () => {
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', end, true);
      document.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('blur', cancel);
      setDragged(null);
      cleanup.current = null;
      setTimeout(() => {
        skipClick.current = false;
      }, 0);
    };
    const end = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      stop();
      if (moved) useWorkspace.getState().reorderTabs(id, target);
    };
    const cancel = () => stop();
    cleanup.current = stop;
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', cancel, true);
    window.addEventListener('blur', cancel);
  }
  const tabs = (
    <div
      className="workbench-tabs"
      ref={root}
      role="tablist"
      aria-label="Open pages"
      aria-orientation={mobileAnchor ? 'vertical' : 'horizontal'}
      onKeyDown={(event) => {
        const forward = event.key === 'ArrowRight' || (mobileAnchor && event.key === 'ArrowDown');
        const backward = event.key === 'ArrowLeft' || (mobileAnchor && event.key === 'ArrowUp');
        if (forward || backward) {
          event.preventDefault();
          const index = state.tabs.findIndex((tab) => tab.id === active),
            next = state.tabs[(index + (forward ? 1 : -1) + state.tabs.length) % state.tabs.length];
          if (next) {
            state.activateTab(next.id);
            root.current
              ?.querySelector<HTMLButtonElement>(`[data-tab-button="${CSS.escape(next.id)}"]`)
              ?.focus();
          }
        }
      }}
    >
      {state.tabs.map((tab) => {
        const page = state.pages.find((page) => page.id === tab.pageId),
          label =
            tab.view === 'templates'
              ? 'Templates'
              : tab.view === 'all'
                ? 'All pages'
                : tab.view === 'graph'
                  ? 'Knowledge graph'
                  : tab.view === 'database' && !tab.pageId
                    ? 'Databases'
                    : tab.view === 'canvas' && !tab.pageId
                      ? 'Canvases'
                      : (page?.title ?? 'Page');
        const Icon =
          tab.view === 'templates'
            ? LayoutTemplate
            : tab.view === 'graph'
              ? Network
              : tab.view === 'all'
                ? Files
                : tab.view === 'database'
                  ? Database
                  : tab.view === 'canvas'
                    ? SquareDashed
                    : FileText;
        return (
          <div
            key={tab.id}
            data-workbench-tab={tab.id}
            className={`workbench-tab ${active === tab.id ? 'active' : ''} ${!tab.pinned ? 'preview' : ''} ${dragged === tab.id ? 'dragging' : ''}`}
            onContextMenu={(event) => {
              event.preventDefault();
              if (!mobileAnchor) setMenu({ id: tab.id, anchor: event.currentTarget });
            }}
          >
            <button
              role="tab"
              data-tab-button={tab.id}
              aria-selected={active === tab.id}
              tabIndex={active === tab.id ? 0 : -1}
              aria-label={label}
              title={label}
              onPointerDown={(event) => drag(tab.id, event)}
              onClick={() => {
                if (!skipClick.current) {
                  state.activateTab(tab.id);
                  setMobileAnchor(null);
                }
              }}
              onDoubleClick={() => state.pinTab(tab.id)}
            >
              {page?.icon && ['document', 'database'].includes(tab.view) ? (
                <span className="page-reference-icon" aria-hidden="true">
                  {page.icon}
                </span>
              ) : (
                <Icon size={15} />
              )}
              <span>{label}</span>
            </button>
            <button
              className="tab-close"
              aria-label={`Close ${label}`}
              title="Close tab"
              onClick={() => state.closeTab(tab.id)}
            >
              <X size={13} />
            </button>
            {mobileAnchor && (
              <button
                className="tab-keep"
                aria-label={`${tab.pinned ? 'Kept open' : 'Keep open'} ${label}`}
                disabled={tab.pinned}
                onClick={() => state.pinTab(tab.id)}
              >
                <Pin size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
  function newTab() {
    setMobileAnchor(null);
    state.pinTab(active);
    state.openDialog('search');
  }
  return (
    <div className="workbench-strip">
      <div className="workbench-window-tools">
        <IconButton
          label={state.sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          onClick={state.toggleSidebar}
        >
          <PanelLeft size={16} />
        </IconButton>
      </div>
      {!mobileAnchor && tabs}
      <button
        className="mobile-tab-trigger icon-button"
        aria-label="Open tabs"
        aria-expanded={!!mobileAnchor}
        aria-haspopup="dialog"
        onClick={(event) => setMobileAnchor(mobileAnchor ? null : event.currentTarget)}
      >
        <PanelsTopLeft />
        <span className="mobile-tab-count">{state.tabs.length}</span>
      </button>
      {mobileAnchor && (
        <Popover
          anchor={mobileAnchor}
          label="Open pages"
          role="dialog"
          close={() => setMobileAnchor(null)}
        >
          <div className="mobile-tabs-panel">
            <h2>Open pages</h2>
            {tabs}
            <button className="mobile-new-tab" onClick={newTab}>
              <Plus size={17} />
              New tab
            </button>
            <button
              className="mobile-new-tab"
              disabled={!state.closedTabs.length}
              onClick={() => state.reopenTab()}
            >
              <RotateCcw size={16} />
              Reopen closed tab
            </button>
          </div>
        </Popover>
      )}
      <IconButton label="New tab" onClick={newTab}>
        <Plus size={17} />
      </IconButton>
      <span className="workbench-spacer" />
      {menu && (
        <Popover anchor={menu.anchor} label="Tab actions" close={() => setMenu(null)}>
          <div className="menu-list">
            <button
              onClick={() => {
                state.pinTab(menu.id);
                setMenu(null);
              }}
            >
              <Pin />
              Keep tab open
            </button>
            <button
              onClick={() => {
                state.closeTab(menu.id);
                setMenu(null);
              }}
            >
              <X />
              Close tab
            </button>
            <button
              disabled={!state.closedTabs.length}
              onClick={() => {
                state.reopenTab();
                setMenu(null);
              }}
            >
              <RotateCcw />
              Reopen closed tab
            </button>
          </div>
        </Popover>
      )}
    </div>
  );
}
