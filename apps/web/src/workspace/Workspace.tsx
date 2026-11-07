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
  Trash2,
  FolderInput,
  PanelRight,
  Network,
} from 'lucide-react';
import { useEffect, lazy, Suspense } from 'react';
import { useWorkspace } from '../state/store.js';
import { Sidebar } from '../navigation/Sidebar.js';
import { IconButton } from '../ui/IconButton.js';
import { Dialog } from '../ui/Dialog.js';
import { PageHeader } from './PageHeader.js';
import { ContextPanel } from '../knowledge/ContextPanel.js';
import { DatabaseView } from '../databases/DatabaseView.js';
import { Search } from '../knowledge/Search.js';
import { Settings } from '../settings/Settings.js';
import { Invite } from '../settings/Invite.js';
import { MovePage } from '../navigation/MovePage.js';
import { download } from '../settings/DataSettings.js';
import { NewPage } from '../navigation/NewPage.js';
import { AllPages } from '../navigation/AllPages.js';
const Graph = lazy(() => import('../knowledge/Graph.js'));
const DocumentEditor = lazy(() =>
  import('../documents/Editor.js').then((module) => ({ default: module.DocumentEditor })),
);
export function Workspace() {
  const state = useWorkspace();
  const page = state.pages.find((item) => item.id === state.selectedId);
  const parent = state.pages.find((item) => item.id === page?.parentId);
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
    <div className="app-shell">
      <Sidebar />
      <main className="workspace-main">
        <header className="topbar">
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
            {parent && (
              <>
                <button className="breadcrumb-parent" onClick={() => state.navigate(parent.id)}>
                  {parent.title}
                </button>
                <span>/</span>
              </>
            )}
            <strong>{page?.title ?? 'Workspace'}</strong>
          </div>
          <div className="topbar-actions">
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
            {page && (
              <IconButton
                label={state.favorites.includes(page.id) ? 'Remove favorite' : 'Add to favorites'}
                onClick={() => state.toggleFavorite(page.id)}
              >
                <Star fill={state.favorites.includes(page.id) ? 'currentColor' : 'none'} />
              </IconButton>
            )}
            {state.view === 'document' && (
              <IconButton
                label={state.contextOpen ? 'Close page details' : 'Open page details'}
                onClick={() => useWorkspace.setState({ contextOpen: !state.contextOpen })}
              >
                <PanelRight />
              </IconButton>
            )}
            <IconButton label="Page actions" onClick={() => state.openDialog('page-menu')}>
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
            <IconButton
              label="Dismiss error"
              onClick={() => useWorkspace.setState({ error: null })}
            >
              <X />
            </IconButton>
          </div>
        )}
        <div className="workspace-content">
          {state.view === 'graph' ? (
            <Suspense fallback={<p className="table-empty">Opening graph…</p>}>
              <Graph />
            </Suspense>
          ) : state.view === 'all' ? (
            <AllPages />
          ) : page ? (
            <>
              <div className="document-scroll">
                <article
                  className={`document-canvas ${state.view === 'database' ? 'database-page' : ''}`}
                >
                  <PageHeader page={page} connections={state.linkedPageIds.length} />
                  {state.view === 'database' ? (
                    page.kind === 'database' ? (
                      <DatabaseView id={page.id} />
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
                    <Suspense fallback={<p className="editor-prompt">Opening editor…</p>}>
                      <DocumentEditor key={page.id} page={page} />
                    </Suspense>
                  )}
                </article>
              </div>
              {state.contextOpen && state.view === 'document' && (
                <>
                  <button
                    className="details-scrim"
                    aria-label="Close page details overlay"
                    onClick={() => useWorkspace.setState({ contextOpen: false })}
                  />
                  <ContextPanel />
                </>
              )}
            </>
          ) : (
            <div className="empty-state">
              <FileText />
              <h1>A little space to think.</h1>
              <p>Create a page and make it yours.</p>
              <button className="button primary" onClick={() => state.openDialog('new-page')}>
                <Plus />
                New page
              </button>
            </div>
          )}
        </div>
      </main>
      {state.dialog === 'new-page' && <NewPage />}
      {state.dialog === 'search' && <Search />}
      {state.dialog === 'settings' && <Settings />}
      {state.dialog === 'invite' && <Invite />}
      {state.dialog === 'move' && page && <MovePage />}
      {state.dialog === 'page-menu' && page && (
        <Dialog title="Page actions" onClose={() => state.openDialog(null)}>
          <div className="menu-list">
            <button
              onClick={() => {
                state.toggleFavorite(page.id);
                state.openDialog(null);
              }}
            >
              <Star />
              {state.favorites.includes(page.id) ? 'Remove favorite' : 'Add to favorites'}
            </button>
            <button onClick={() => state.openDialog('new-page')}>
              <Plus />
              Add subpage
            </button>
            <button onClick={() => state.openDialog('move')} disabled={page.kind === 'record'}>
              <FolderInput />
              Move page
            </button>
            <button
              onClick={() =>
                void download(`/api/pages/${page.id}/markdown`, page.title + '.md').catch(
                  state.setError,
                )
              }
            >
              <FileText />
              Export text as Markdown
            </button>
            <button
              className="danger"
              onClick={() => void state.trashPage(page.id).catch(state.setError)}
            >
              <Trash2 />
              Move to trash
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
