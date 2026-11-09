import { t } from '../i18n/index.js';
import { Select } from '../ui/Select.js';
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
      aria-label={t('Template library')}
    >
      <header className="page-index-heading">
        <div>
          <h1>{t('Templates')}</h1>
          <p className="muted-text">
            {t('Keep your best starting points ready for the next idea.')}
          </p>
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
          {t('New template')}
        </button>
      </header>
      {!!state.pendingCopies.length && (
        <section className="pending-copies" aria-label={t('Unconfirmed copies')}>
          <strong>{t('Check your recent copies')}</strong>
          <p>
            {t(
              'A copy may already exist. Retry confirms the same request without creating it twice.',
            )}
          </p>
          {state.pendingCopies.map((command) => (
            <div key={command.requestId}>
              <span>
                {command.title ??
                  (command.operation === 'blank' ? t('Untitled template') : t('Page copy'))}
              </span>
              <button
                className="button"
                disabled={!!state.copyBusy}
                onClick={() => void state.copyPage(command).catch(state.setError)}
              >
                {t('Retry')}
              </button>
              <button
                className="text-button"
                disabled={!!state.copyBusy}
                onClick={() => state.dismissCopy(command.requestId)}
              >
                {t('Dismiss')}
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
            aria-label={t('Search templates')}
            placeholder={t('Search your templates…')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <Select
          aria-label={t('Template type')}
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="">{t('All types')}</option>
          <option value="document">{t('Pages and databases')}</option>
          <option value="record">{t('Record templates')}</option>
        </Select>
        {database && (
          <button
            className="text-button"
            onClick={() => state.setTemplateFilters({ ...state.templateFilters, database: '' })}
          >
            {t('Clear database filter')}
          </button>
        )}
      </div>
      {state.templateError && (
        <p className="form-error" role="alert">
          {state.templateError}{' '}
          <button className="text-button" onClick={() => void state.loadTemplates()}>
            {t('Retry')}
          </button>
        </p>
      )}
      <div className="template-workbench">
        <div
          className="template-list"
          aria-label={t('Saved templates')}
          aria-busy={state.templateLoading}
        >
          {items.map((page) => (
            <button
              key={page.id}
              aria-label={t('Preview {{value0}}', { value0: page.title })}
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
                      t('Record template'))
                    : page.kind === 'database'
                      ? t('Database template')
                      : t('Page template')}{' '}
                  · {page.visibility === 'private' ? t('Private') : t('Workspace')}
                </small>
                {page.description && <p>{page.description}</p>}
              </span>
              <ArrowUpRight size={14} />
            </button>
          ))}
          {!items.length && (
            <div className="template-empty">
              <LayoutTemplate size={28} />
              <h2>
                {state.templateLoading ? t('Finding templates…') : t('A useful place to start')}
              </h2>
              <p>
                {query || kind || database
                  ? t('No templates match these filters.')
                  : t(
                      'Save a page or record as a template, or create one here. Each use becomes an independent copy.',
                    )}
              </p>
            </div>
          )}
          {state.templateCursor && (
            <button
              className="button template-more"
              disabled={state.templateLoading}
              onClick={() => void state.loadTemplates(undefined, true)}
            >
              {t('Load more templates')}
            </button>
          )}
        </div>
        {active && (
          <section className="template-preview" aria-label={t('Template preview')}>
            <button className="text-button template-preview-back" onClick={() => setSelected(null)}>
              {t('Back to templates')}
            </button>
            <header>
              <span className="template-visibility">
                {active.visibility === 'private' ? <LockKeyhole size={13} /> : <Users size={13} />}{' '}
                {active.visibility === 'private' ? t('Only you') : t('Workspace')}
              </span>
              <h2>{active.title}</h2>
              {active.description && <p>{active.description}</p>}
              <div>
                <button
                  className="button"
                  onClick={() => state.navigate(active.id, pageView(active.kind))}
                >
                  {readOnly ? t('Open template') : t('Edit template')}
                </button>
                <button
                  className="button primary"
                  disabled={!state.canUseTemplate(active.id)}
                  onClick={() => void state.useTemplate(active.id).catch(state.setError)}
                >
                  {t('Use template')}
                </button>
              </div>
              <small>
                {active.templateDatabaseId
                  ? t('New records follow the access settings of {{value0}}. ', {
                      value0: state.tables[active.templateDatabaseId]?.title ?? t('their database'),
                    })
                  : t('New pages start private. ')}
                {t(
                  'Page content, media and subpages are copied. Linked pages and databases stay connected.',
                )}
              </small>
            </header>
            {active.templateDatabaseId && <TemplateDefaults page={active} readOnly />}
            {state.templatePreview?.pageId === active.id ? (
              <LazyBoundary key={active.id} name={t('Template preview')}>
                <Suspense fallback={<p className="muted-text">{t('Opening preview…')}</p>}>
                  <TemplatePreview state={state.templatePreview.state} readOnly={!!readOnly} />
                </Suspense>
              </LazyBoundary>
            ) : (
              <p className="muted-text">
                {state.templateError ? t('Preview unavailable.') : t('Opening preview…')}
              </p>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
