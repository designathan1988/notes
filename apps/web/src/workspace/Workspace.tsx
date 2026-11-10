import { t } from '../i18n/index.js';
import {
  CloudOff,
  LoaderCircle,
  MoreHorizontal,
  Menu,
  X,
  Plus,
  FileText,
  Database,
  PanelLeft,
  PanelRight,
  ArrowLeft,
  ArrowRight,
  Command,
  MessageSquare,
  Link2,
  Folder,
  House,
  Network,
  Shapes,
  UserPlus,
} from 'lucide-react';
import { useEffect, lazy, Suspense } from 'react';
import { useWorkspace } from '../state/store.js';
import { Sidebar } from '../navigation/Sidebar.js';
import { IconButton } from '../ui/IconButton.js';
import { PageHeader } from './PageHeader.js';
import { AppearancePanel } from '../appearance/AppearancePanel.js';
import { appearanceVariables, PageAppearance } from '../appearance/projection.js';
import { PagePanel } from '../activity/PagePanel.js';
import { Search } from '../knowledge/Search.js';
import { Settings } from '../settings/Settings.js';
import { Invite } from '../settings/Invite.js';
import { MovePage } from '../navigation/MovePage.js';
import { NewPage } from '../navigation/NewPage.js';
import { AllPages } from '../navigation/AllPages.js';
import { PageActions } from '../navigation/PageActions.js';
import { CommandPalette } from '../workbench/CommandPalette.js';
import { TemplateBanner } from '../templates/TemplateBanner.js';
import { TemplateDialog } from '../templates/TemplateDialog.js';
import { LazyBoundary } from '../ui/LazyBoundary.js';
import { Home } from '../home/Home.js';
import { CaptureDock } from '../capture/CaptureDock.js';
import { ConnectionThread } from '../knowledge/ConnectionThread.js';
const Library = lazy(() => import('../templates/Library.js'));
const Graph = lazy(() => import('../knowledge/Graph.js'));
const DatabaseView = lazy(() =>
  import('../databases/DatabaseView.js').then((module) => ({ default: module.DatabaseView })),
);
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
    state.view === 'home' ||
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
      // A responsive change must not unmount work already open in a native dialog.
      if (narrow.matches && !document.querySelector('dialog[open]'))
        useWorkspace.getState().setContextOpen(false);
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
        <header className="topbar">
          {state.sidebarCollapsed && (
            <IconButton
              className="sidebar-expand"
              label={t('Show sidebar')}
              onClick={state.toggleSidebar}
            >
              <PanelLeft />
            </IconButton>
          )}
          <div className="history-controls">
            <IconButton
              label={t('Go back')}
              disabled={state.navigationHistory.index <= 0}
              onClick={state.goBack}
            >
              <ArrowLeft size={16} />
            </IconButton>
            <IconButton
              label={t('Go forward')}
              disabled={state.navigationHistory.index >= state.navigationHistory.entries.length - 1}
              onClick={state.goForward}
            >
              <ArrowRight size={16} />
            </IconButton>
          </div>
          <div className="mobile-brand">
            <IconButton
              label={t('Open navigation')}
              data-open-navigation
              onClick={() => useWorkspace.getState().setSidebarOpen(true)}
            >
              <Menu />
            </IconButton>
          </div>
          <div className="breadcrumb">
            {parent && !globalView && (
              <>
                <button className="breadcrumb-parent" onClick={() => state.navigate(parent.id)}>
                  <Folder size={15} aria-hidden="true" />
                  {parent.title}
                </button>
                <span>/</span>
              </>
            )}
            <strong>
              {(() => {
                const CrumbIcon =
                  state.view === 'home'
                    ? House
                    : state.view === 'graph'
                      ? Network
                      : page?.kind === 'database' || databaseIndex
                        ? Database
                        : page?.kind === 'canvas' || canvasIndex
                          ? Shapes
                          : FileText;
                return <CrumbIcon size={15} aria-hidden="true" />;
              })()}
              {state.view === 'home'
                ? t('Home')
                : state.view === 'templates'
                  ? t('Templates')
                  : state.view === 'all'
                    ? t('All pages')
                    : state.view === 'graph'
                      ? t('Knowledge graph')
                      : databaseIndex
                        ? t('Databases')
                        : canvasIndex
                          ? t('Canvases')
                          : (page?.title ?? t('Workspace'))}
            </strong>
            {page && !globalView && ['document', 'canvas'].includes(state.view) && (
              <small className="mobile-save-label">{t(status)}</small>
            )}
          </div>
          <div className="topbar-actions">
            {state.view === 'graph' && <div className="bar-slot" id="graph-bar-slot" />}
            <IconButton
              label={t('Command palette')}
              data-command-palette
              onClick={state.showCommands}
            >
              <Command size={16} />
            </IconButton>
            {page && !globalView && ['document', 'canvas'].includes(state.view) && (
              <span className={`save-status ${state.saveStatus}`}>
                {state.saveStatus === 'saved' ? (
                  <i className="save-dot" aria-hidden="true" />
                ) : state.saveStatus === 'local' || state.saveStatus === 'error' ? (
                  <CloudOff />
                ) : (
                  <LoaderCircle className={state.saveStatus === 'saving' ? 'spin' : ''} />
                )}
                <span>{t(status)}</span>
              </span>
            )}
            {page && !globalView && state.view === 'document' && (
              <button
                type="button"
                className="bar-connections"
                aria-label={t('Connections: {{count}}', { count: state.linkedPageIds.length })}
                aria-pressed={state.contextOpen}
                onClick={() => state.setContextOpen(!state.contextOpen)}
              >
                <Link2 size={15} />
                <span>{t('Connections')}</span>
                <b>{state.linkedPageIds.length}</b>
              </button>
            )}
            {page && !globalView && (
              <IconButton
                label={t('Open comments')}
                data-open-comments
                onClick={() => state.openPagePanel('discussion')}
              >
                <MessageSquare size={17} />
              </IconButton>
            )}
            {['document', 'canvas', 'database'].includes(state.view) && (
              <IconButton
                label={state.contextOpen ? t('Close page details') : t('Open page details')}
                aria-pressed={state.contextOpen}
                onClick={() => useWorkspace.getState().setContextOpen(!state.contextOpen)}
              >
                <PanelRight />
              </IconButton>
            )}
            <IconButton
              label={t('Page actions')}
              data-page-actions
              disabled={!page || globalView}
              onClick={() => state.openDialog('page-menu')}
            >
              <MoreHorizontal />
            </IconButton>
            {page && !globalView && (
              <button
                className="button primary share-button"
                title={t('Invite people to the workspace')}
                onClick={() => state.openDialog('invite')}
              >
                <UserPlus />
                {t('Share')}
              </button>
            )}
          </div>
        </header>
        {state.error && (
          <div className="error-banner" role="alert">
            <span>{t(state.error)}</span>
            {state.connectionError && (
              <button className="text-button" onClick={() => void state.reload()}>
                {t('Retry connection')}
              </button>
            )}
            <IconButton
              label={t('Dismiss error')}
              onClick={() => useWorkspace.getState().clearError()}
            >
              <X />
            </IconButton>
          </div>
        )}
        <div className="workspace-content">
          {state.view === 'home' ? (
            <Home />
          ) : state.view === 'templates' ? (
            <LazyBoundary key={`templates:${state.workspaceId}`} name="Templates">
              <Suspense fallback={<p className="table-empty">{t('Opening templates…')}</p>}>
                <Library key={state.workspaceId} />
              </Suspense>
            </LazyBoundary>
          ) : state.view === 'graph' ? (
            <LazyBoundary key={`graph:${state.workspaceId}`} name="Knowledge graph">
              <Suspense fallback={<p className="table-empty">{t('Opening graph…')}</p>}>
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
              <div
                className="canvas-page"
                data-styled-page={page.id}
                style={appearanceVariables(
                  state.pageAppearanceDrafts[page.id]?.overrides ?? page.appearance ?? {},
                )}
              >
                <PageAppearance
                  id={page.id}
                  appearance={state.pageAppearanceDrafts[page.id]?.overrides ?? page.appearance}
                />
                <TemplateBanner page={page} />
                <LazyBoundary key={page.id} name="Canvas">
                  <Suspense fallback={<p className="editor-prompt">{t('Opening canvas…')}</p>}>
                    <DocumentEditor key={page.id} page={page} />
                  </Suspense>
                </LazyBoundary>
              </div>
              {state.contextOpen && !state.appearanceScope && (
                <>
                  <button
                    className="details-scrim"
                    aria-label={t('Close page details overlay')}
                    onClick={() => useWorkspace.getState().setContextOpen(false)}
                  />
                  <PagePanel />
                </>
              )}
            </>
          ) : page ? (
            <>
              <div className="document-scroll" data-kind={page.kind}>
                {state.view === 'document' && page.format !== 'web' && <ConnectionThread />}
                <TemplateBanner page={page} />
                <article
                  className={`document-canvas ${state.view === 'database' ? 'database-page' : ''}`}
                  data-styled-page={page.id}
                  style={appearanceVariables(
                    state.pageAppearanceDrafts[page.id]?.overrides ?? page.appearance ?? {},
                  )}
                >
                  <PageAppearance
                    id={page.id}
                    appearance={state.pageAppearanceDrafts[page.id]?.overrides ?? page.appearance}
                  />
                  <PageHeader
                    page={page}
                    connections={state.view === 'document' ? state.linkedPageIds.length : undefined}
                  />
                  {state.view === 'database' ? (
                    page.kind === 'database' ? (
                      <LazyBoundary key={page.id} name="Database">
                        <Suspense
                          fallback={<p className="table-empty">{t('Opening database…')}</p>}
                        >
                          <DatabaseView key={page.id} id={page.id} />
                        </Suspense>
                      </LazyBoundary>
                    ) : (
                      <div className="empty-state">
                        <Database />
                        <h1>{t('Give your ideas some structure.')}</h1>
                        <p>{t('Create a database to organize records and properties.')}</p>
                        <button
                          className="button primary"
                          onClick={() => state.openDialog('new-page')}
                        >
                          {t('Create database')}
                        </button>
                      </div>
                    )
                  ) : (
                    <LazyBoundary key={page.id} name="Editor">
                      <Suspense fallback={<p className="editor-prompt">{t('Opening editor…')}</p>}>
                        <DocumentEditor key={page.id} page={page} />
                      </Suspense>
                    </LazyBoundary>
                  )}
                </article>
              </div>
              {state.contextOpen && !state.appearanceScope && (
                <>
                  <button
                    className="details-scrim"
                    aria-label={t('Close page details overlay')}
                    onClick={() => useWorkspace.getState().setContextOpen(false)}
                  />
                  <PagePanel />
                </>
              )}
            </>
          ) : (
            <div className="empty-state">
              <FileText />
              <h1>{t('A little space to think.')}</h1>
              <p>{t('Create a page and make it yours.')}</p>
              <button
                className="button primary"
                onClick={() => void state.createQuickPage().catch(state.setError)}
              >
                <Plus />
                {t('New page')}
              </button>
            </div>
          )}
          {state.appearanceScope && <AppearancePanel />}
        </div>
        {/* Capture belongs where people read and file; canvases and the visual editor have their own docks. */}
        {state.workspaces.find((item) => item.id === state.workspaceId)?.role !== 'viewer' &&
          (globalView
            ? ['home', 'all', 'templates'].includes(state.view)
            : !!page && page.format !== 'web' && ['document', 'database'].includes(state.view)) && (
            <CaptureDock />
          )}
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
          anchor={document.querySelector<HTMLElement>('.topbar [data-page-actions]')}
          close={() => state.openDialog(null)}
        />
      )}
    </div>
  );
}
