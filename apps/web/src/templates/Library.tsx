import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Database,
  FileText,
  LayoutTemplate,
  Plus,
  Search,
  LockKeyhole,
  Users,
  ArrowUpRight,
} from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import { TemplateDefaults } from './TemplateDefaults.js';
import { LazyBoundary } from '../ui/LazyBoundary.js';
import { pageView } from '../workbench/route.js';
const TemplatePreview = lazy(() => import('./TemplatePreview.js'));
export default function Library() {
  const state = useWorkspace(),
    [query, setQuery] = useState(state.templateFilters.q ?? ''),
    [kind, setKind] = useState(state.templateFilters.kind ?? ''),
    [selected, setSelected] = useState<string | null>(null);
  const workspace = state.workspaceId,
    version = state.knowledgeVersion,
    database = state.templateFilters.database ?? '';
  const items = state.templateIds.flatMap((id) => state.pages.find((page) => page.id === id) ?? []),
    active = items.find((page) => page.id === selected) ?? items[0],
    readOnly = state.workspaces.find((item) => item.id === workspace)?.role === 'viewer';
  useEffect(() => {
    const timer = setTimeout(
      () => void useWorkspace.getState().loadTemplates({ q: query, kind, database }),
      150,
    );
    return () => clearTimeout(timer);
  }, [workspace, version, query, kind, database]);
  const activeId = active?.id;
  useEffect(() => {
    if (activeId) void useWorkspace.getState().previewTemplate(activeId);
  }, [activeId, version]);
  return (
    <section
      className={`templates-screen ${selected ? 'template-selected' : ''}`}
      aria-label="Template library"
    >
      <header className="page-index-heading">
        <div>
          <h1>Templates</h1>
          <p className="muted-text">Keep your best starting points ready for the next idea.</p>
        </div>
        <button
          className="button primary"
          disabled={readOnly || !!state.copyBusy}
          onClick={() =>
            void state
              .copyPage({ operation: 'blank' })
              .then((page) => {
                if (page) useWorkspace.getState().focusPageTitle();
              })
              .catch(state.setError)
          }
        >
          <Plus size={15} />
          New template
        </button>
      </header>
      {!!state.pendingCopies.length && (
        <section className="pending-copies" aria-label="Unconfirmed copies">
          <strong>Check your recent copies</strong>
          <p>
            A copy may already exist. Retry confirms the same request without creating it twice.
          </p>
          {state.pendingCopies.map((command) => (
            <div key={command.requestId}>
              <span>
                {command.title ??
                  (command.operation === 'blank' ? 'Untitled template' : 'Page copy')}
              </span>
              <button
                className="button"
                disabled={!!state.copyBusy}
                onClick={() => void state.copyPage(command).catch(state.setError)}
              >
                Retry
              </button>
              <button
                className="text-button"
                disabled={!!state.copyBusy}
                onClick={() => state.dismissCopy(command.requestId)}
              >
                Dismiss
              </button>
            </div>
          ))}
        </section>
      )}
      <div className="template-toolbar">
        <label className="template-search">
          <Search size={16} />
          <input
            type="search"
            aria-label="Search templates"
            placeholder="Search your templates…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Template type"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="">All types</option>
          <option value="document">Pages and databases</option>
          <option value="record">Record templates</option>
        </select>
        {database && (
          <button
            className="text-button"
            onClick={() => state.setTemplateFilters({ ...state.templateFilters, database: '' })}
          >
            Clear database filter
          </button>
        )}
      </div>
      {state.templateError && (
        <p className="form-error" role="alert">
          {state.templateError}{' '}
          <button className="text-button" onClick={() => void state.loadTemplates()}>
            Retry
          </button>
        </p>
      )}
      <div className="template-workbench">
        <div
          className="template-list"
          aria-label="Saved templates"
          aria-busy={state.templateLoading}
        >
          {items.map((page) => (
            <button
              key={page.id}
              aria-label={`Preview ${page.title}`}
              aria-pressed={active?.id === page.id}
              onClick={() => setSelected(page.id)}
            >
              <span className="template-list-icon">
                {page.icon ??
                  (page.kind === 'database' ? (
                    <Database size={20} />
                  ) : page.templateDatabaseId ? (
                    <LayoutTemplate size={20} />
                  ) : (
                    <FileText size={20} />
                  ))}
              </span>
              <span>
                <strong>{page.title}</strong>
                <small>
                  {page.templateDatabaseId
                    ? (state.pages.find((item) => item.id === page.templateDatabaseId)?.title ??
                      'Record template')
                    : page.kind === 'database'
                      ? 'Database template'
                      : 'Page template'}{' '}
                  · {page.visibility === 'private' ? 'Private' : 'Workspace'}
                </small>
                {page.description && <p>{page.description}</p>}
              </span>
              <ArrowUpRight size={14} />
            </button>
          ))}
          {!items.length && (
            <div className="template-empty">
              <LayoutTemplate size={28} />
              <h2>{state.templateLoading ? 'Finding templates…' : 'A useful place to start'}</h2>
              <p>
                {query || kind || database
                  ? 'No templates match these filters.'
                  : 'Save a page or record as a template, or create one here. Each use becomes an independent copy.'}
              </p>
            </div>
          )}
          {state.templateCursor && (
            <button
              className="button template-more"
              disabled={state.templateLoading}
              onClick={() => void state.loadTemplates(undefined, true)}
            >
              Load more templates
            </button>
          )}
        </div>
        {active && (
          <section className="template-preview" aria-label="Template preview">
            <button className="text-button template-preview-back" onClick={() => setSelected(null)}>
              Back to templates
            </button>
            <header>
              <span className="template-visibility">
                {active.visibility === 'private' ? <LockKeyhole size={13} /> : <Users size={13} />}{' '}
                {active.visibility === 'private' ? 'Only you' : 'Workspace'}
              </span>
              <h2>{active.title}</h2>
              {active.description && <p>{active.description}</p>}
              <div>
                <button
                  className="button"
                  onClick={() => state.navigate(active.id, pageView(active.kind))}
                >
                  {readOnly ? 'Open template' : 'Edit template'}
                </button>
                <button
                  className="button primary"
                  disabled={!state.canUseTemplate(active.id)}
                  onClick={() => void state.useTemplate(active.id).catch(state.setError)}
                >
                  Use template
                </button>
              </div>
              <small>
                {active.templateDatabaseId
                  ? `New records follow the access settings of ${state.tables[active.templateDatabaseId]?.title ?? 'their database'}. `
                  : 'New pages start private. '}
                Page content, media and subpages are copied. Linked pages and databases stay
                connected.
              </small>
            </header>
            {active.templateDatabaseId && <TemplateDefaults page={active} readOnly />}
            {state.templatePreview?.pageId === active.id ? (
              <LazyBoundary key={active.id} name="Template preview">
                <Suspense fallback={<p className="muted-text">Opening preview…</p>}>
                  <TemplatePreview state={state.templatePreview.state} />
                </Suspense>
              </LazyBoundary>
            ) : (
              <p className="muted-text">
                {state.templateError ? 'Preview unavailable.' : 'Opening preview…'}
              </p>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
