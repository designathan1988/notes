import {
  Check,
  CloudOff,
  LoaderCircle,
  MoreHorizontal,
  Menu,
  Users,
  X,
  Plus,
  FileText,
  Database,
  Star,
  PanelRight,
  ArrowLeft,
  ArrowRight,
  Command,
  MessageSquare,
} from 'lucide-react';
import { useEffect, lazy, Suspense } from 'react';
import { useWorkspace } from '../state/store.js';
import { Sidebar } from '../navigation/Sidebar.js';
import { IconButton } from '../ui/IconButton.js';
import { PageHeader } from './PageHeader.js';
import { PagePanel } from '../activity/PagePanel.js';
import { DatabaseView } from '../databases/DatabaseView.js';
import { Search } from '../knowledge/Search.js';
import { Settings } from '../settings/Settings.js';
import { Invite } from '../settings/Invite.js';
import { MovePage } from '../navigation/MovePage.js';
import { NewPage } from '../navigation/NewPage.js';
import { AllPages } from '../navigation/AllPages.js';
import { PageActions } from '../navigation/PageActions.js';
import { TabStrip } from '../workbench/TabStrip.js';
import { CommandPalette } from '../workbench/CommandPalette.js';
import { TemplateBanner } from '../templates/TemplateBanner.js';
import { TemplateDialog } from '../templates/TemplateDialog.js';
import { LazyBoundary } from '../ui/LazyBoundary.js';
const Library = lazy(() => import('../templates/Library.js'));
const Graph = lazy(() => import('../knowledge/Graph.js'));
const DocumentEditor = lazy(() =>
  import('../documents/Editor.js').then((module) => ({ default: module.DocumentEditor })),
);
export function Workspace() {
  const state = useWorkspace();
  const page = state.pages.find((item) => item.id === state.selectedId);
  const parent = state.pages.find((item) => item.id === page?.parentId);
  const databaseIndex = state.view === 'database' && page?.kind !== 'database';
  const canvasIndex = state.view === 'canvas' && page?.kind !== 'canvas';
  const globalView =
    state.view === 'all' ||
    state.view === 'graph' ||
    state.view === 'templates' ||
    databaseIndex ||
    canvasIndex;
  const status = {
    saved: 'Saved',
    saving: 'Saving…',
    connecting: 'Connecting…',
    local: 'Saved locally',
    error: 'Save failed',
    'read-only': 'Read only',
  }[state.saveStatus];
  useEffect(() => {
    const narrow = matchMedia('(max-width:1050px)');
    const resize = () => {
      if (narrow.matches) useWorkspace.setState({ contextOpen: false });
    };
    resize();
    narrow.addEventListener('change', resize);
    return () => narrow.removeEventListener('change', resize);
  }, []);
  useEffect(() => {
    if (!state.workspaceId) return;
    const source = new EventSource(`/api/workspaces/${state.workspaceId}/events`);
    const refresh = () => {
      void useWorkspace.getState().reload();
      const id = useWorkspace.getState().selectedId;
      if (id)
        void useWorkspace
          .getState()
          .loadMentions(id)
          .catch(() => {});
    };
    source.addEventListener('refresh', refresh);
    source.addEventListener('access-changed', () => {
      source.close();
      refresh();
    });
    return () => source.close();
  }, [state.workspaceId]);
  return (
    <div
      className={`app-shell ${state.sidebarCollapsed ? 'sidebar-collapsed' : ''} ${state.focusMode ? 'focus-mode' : ''}`}
    >
      <Sidebar />
      <main className="workspace-main" inert={state.sidebarOpen}>
        <TabStrip />
        <header className="topbar">
          <div className="history-controls">
            <IconButton
              label="Go back"
              disabled={state.navigationHistory.index <= 0}
              onClick={state.goBack}
            >
              <ArrowLeft size={16} />
            </IconButton>
            <IconButton
              label="Go forward"
              disabled={state.navigationHistory.index >= state.navigationHistory.entries.length - 1}
              onClick={state.goForward}
            >
              <ArrowRight size={16} />
            </IconButton>
          </div>
          <div className="mobile-brand">
            <IconButton
              label="Open navigation"
              onClick={() => useWorkspace.setState({ sidebarOpen: true })}
            >
              <Menu />
            </IconButton>
            <span className="brand-mark">
              <i />
              <i />
              <i />
              <i />
            </span>
            <b>Note</b>
          </div>
          <div className="breadcrumb">
            {parent && !globalView && (
              <>
                <button className="breadcrumb-parent" onClick={() => state.navigate(parent.id)}>
                  {parent.title}
                </button>
                <span>/</span>
              </>
            )}
            <strong>
              {state.view === 'templates'
                ? 'Templates'
                : state.view === 'all'
                  ? 'All pages'
                  : state.view === 'graph'
                    ? 'Knowledge graph'
                    : databaseIndex
                      ? 'Databases'
                      : canvasIndex
                        ? 'Canvases'
                        : (page?.title ?? 'Workspace')}
            </strong>
          </div>
          <div className="topbar-actions">
            <IconButton label="Command palette" onClick={state.showCommands}>
              <Command size={16} />
            </IconButton>
            {page && !globalView && ['document', 'canvas'].includes(state.view) && (
              <span className={`save-status ${state.saveStatus}`}>
                {state.saveStatus === 'saved' ? (
                  <Check />
                ) : state.saveStatus === 'local' || state.saveStatus === 'error' ? (
                  <CloudOff />
                ) : (
                  <LoaderCircle className={state.saveStatus === 'saving' ? 'spin' : ''} />
                )}
                <span>{status}</span>
              </span>
            )}
            {page && !globalView && (
              <IconButton
                label={state.favorites.includes(page.id) ? 'Remove favorite' : 'Add to favorites'}
                onClick={() => state.toggleFavorite(page.id)}
              >
                <Star fill={state.favorites.includes(page.id) ? 'currentColor' : 'none'} />
              </IconButton>
            )}
            {['document', 'canvas'].includes(state.view) && (
              <IconButton
                label={state.contextOpen ? 'Close page details' : 'Open page details'}
                onClick={() => useWorkspace.setState({ contextOpen: !state.contextOpen })}
              >
                <PanelRight />
              </IconButton>
            )}
            {page && !globalView && (
              <IconButton label="Open comments" onClick={() => state.openPagePanel('discussion')}>
                <MessageSquare size={17} />
              </IconButton>
            )}
            <IconButton
              label="Page actions"
              disabled={!page || globalView}
              onClick={() => state.openDialog('page-menu')}
            >
              <MoreHorizontal />
            </IconButton>
            <button
              className="button primary share-button"
              onClick={() => state.openDialog('invite')}
            >
              <Users />
              Share
            </button>
          </div>
        </header>
        {state.error && (
          <div className="error-banner" role="alert">
            <span>{state.error}</span>
            {state.connectionError && (
              <button className="text-button" onClick={() => void state.reload()}>
                Retry connection
              </button>
            )}
            <IconButton
              label="Dismiss error"
              onClick={() => useWorkspace.setState({ error: null })}
            >
              <X />
            </IconButton>
          </div>
        )}
        <div className="workspace-content">
          {state.view === 'templates' ? (
            <LazyBoundary key={`templates:${state.workspaceId}`} name="Templates">
              <Suspense fallback={<p className="table-empty">Opening templates…</p>}>
                <Library key={state.workspaceId} />
              </Suspense>
            </LazyBoundary>
          ) : state.view === 'graph' ? (
            <LazyBoundary key={`graph:${state.workspaceId}`} name="Knowledge graph">
              <Suspense fallback={<p className="table-empty">Opening graph…</p>}>
                <Graph />
              </Suspense>
            </LazyBoundary>
          ) : state.view === 'all' ? (
            <AllPages />
          ) : databaseIndex ? (
            <AllPages kind="database" />
          ) : canvasIndex ? (
            <AllPages kind="canvas" />
          ) : page?.kind === 'canvas' ? (
            <>
              <div className="canvas-page">
                <TemplateBanner page={page} />
                <LazyBoundary key={page.id} name="Canvas">
                  <Suspense fallback={<p className="editor-prompt">Opening canvas…</p>}>
                    <DocumentEditor key={page.id} page={page} />
                  </Suspense>
                </LazyBoundary>
              </div>
              {state.contextOpen && (
                <>
                  <button
                    className="details-scrim"
                    aria-label="Close page details overlay"
                    onClick={() => useWorkspace.setState({ contextOpen: false })}
                  />
                  <PagePanel />
                </>
              )}
            </>
          ) : page ? (
            <>
              <div className="document-scroll">
                <TemplateBanner page={page} />
                <article
                  className={`document-canvas ${state.view === 'database' ? 'database-page' : ''}`}
                >
                  <PageHeader page={page} connections={state.linkedPageIds.length} />
                  {state.view === 'database' ? (
                    page.kind === 'database' ? (
                      <DatabaseView key={page.id} id={page.id} />
                    ) : (
                      <div className="empty-state">
                        <Database />
                        <h1>Give your ideas some structure.</h1>
                        <p>Create a database to organize records and properties.</p>
                        <button
                          className="button primary"
                          onClick={() => state.openDialog('new-page')}
                        >
                          Create database
                        </button>
                      </div>
                    )
                  ) : (
                    <LazyBoundary key={page.id} name="Editor">
                      <Suspense fallback={<p className="editor-prompt">Opening editor…</p>}>
                        <DocumentEditor key={page.id} page={page} />
                      </Suspense>
                    </LazyBoundary>
                  )}
                </article>
              </div>
              {state.contextOpen && (
                <>
                  <button
                    className="details-scrim"
                    aria-label="Close page details overlay"
                    onClick={() => useWorkspace.setState({ contextOpen: false })}
                  />
                  <PagePanel />
                </>
              )}
            </>
          ) : (
            <div className="empty-state">
              <FileText />
              <h1>A little space to think.</h1>
              <p>Create a page and make it yours.</p>
              <button
                className="button primary"
                onClick={() => void state.createQuickPage().catch(state.setError)}
              >
                <Plus />
                New page
              </button>
            </div>
          )}
        </div>
      </main>
      {state.dialog === 'new-page' && <NewPage />}
      {state.commandOpen && <CommandPalette />}
      {state.templateDialog && (
        <TemplateDialog
          key={`${state.user?.id}:${state.workspaceId}:${state.templateDialog.sourceId}`}
        />
      )}
      {state.dialog === 'search' && <Search />}
      {state.dialog === 'settings' && <Settings />}
      {state.dialog === 'invite' && <Invite />}
      {state.dialog === 'move' && (page || state.pendingMove) && <MovePage />}
      {state.dialog === 'page-menu' && page && (
        <PageActions
          page={page}
          anchor={document.querySelector<HTMLElement>('.topbar [aria-label="Page actions"]')}
          close={() => state.openDialog(null)}
        />
      )}
    </div>
  );
}
