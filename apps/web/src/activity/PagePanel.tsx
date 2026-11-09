import { useEffect, useRef } from 'react';
import { History, List, MessageSquare, X } from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import { IconButton } from '../ui/IconButton.js';
import { ContextPanel } from '../knowledge/ContextPanel.js';
import { DiscussionPanel } from './DiscussionPanel.js';
import { HistoryPanel } from './HistoryPanel.js';
import type { PagePanelTab } from './state.js';
export function PagePanel() {
  const pageId = useWorkspace((state) => state.selectedId),
    tab = useWorkspace((state) => state.pagePanelTab);
  const role = useWorkspace(
    (state) => state.workspaces.find((workspace) => workspace.id === state.workspaceId)?.role,
  );
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!matchMedia('(max-width:1050px)').matches) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  if (!pageId) return null;
  const tabs = [
    { id: 'details', label: 'Details', Icon: List },
    { id: 'discussion', label: 'Comments', Icon: MessageSquare },
    { id: 'history', label: 'History', Icon: History },
  ] as const;
  return (
    <aside
      ref={ref}
      className={`context-panel page-panel ${tab !== 'details' ? 'activity-panel' : ''}`}
      aria-label="Page details"
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest('dialog')) return;
        if (event.key === 'Escape') {
          event.stopPropagation();
          useWorkspace.getState().setContextOpen(false);
        }
        if (event.key === 'Tab' && matchMedia('(max-width:1050px)').matches) {
          const controls = [
            ...ref.current!.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input,textarea,a[href],[tabindex="0"]',
            ),
          ].filter((element) => element.getClientRects().length);
          const first = controls[0],
            last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <header>
        <h2>
          {tab === 'discussion'
            ? 'Comments'
            : tab === 'history'
              ? 'Version history'
              : 'Page details'}
        </h2>
        <IconButton
          label="Close page details"
          onClick={() => useWorkspace.getState().setContextOpen(false)}
        >
          <X />
        </IconButton>
      </header>
      <div className="page-panel-tabs" role="tablist" aria-label="Page tools">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={id === tab}
            aria-label={id === 'history' ? 'Version history' : label}
            onClick={() => useWorkspace.getState().openPagePanel(id as PagePanelTab)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      {tab === 'details' ? (
        <ContextPanel />
      ) : tab === 'discussion' ? (
        <DiscussionPanel key={pageId} pageId={pageId} canWrite={!!role && role !== 'viewer'} />
      ) : (
        <HistoryPanel key={pageId} pageId={pageId} canWrite={!!role && role !== 'viewer'} />
      )}
    </aside>
  );
}
