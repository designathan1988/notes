import { t, formatDate } from '../i18n/index.js';
import { Select } from '../ui/Select.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Plus, Search } from 'lucide-react';
import type { Page } from '@note/contracts';
import { api } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
import { pageView } from '../workbench/route.js';
import { PageGlyph } from '../ui/PageGlyph.js';
import { pageType, typeLabel } from '../pages/type.js';
export function AllPages({ kind }: { kind?: 'database' | 'canvas' }) {
  const [input, setInput] = useState(''),
    [query, setQuery] = useState(''),
    [type, setType] = useState(''),
    [sort, setSort] = useState('updated:desc');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), 200);
    return () => clearTimeout(timer);
  }, [input]);
  const title =
    kind === 'canvas' ? t('Canvases') : kind === 'database' ? t('Databases') : t('All pages');
  const workspace = useWorkspace((state) => state.workspaceId);
  const identity = useWorkspace((state) => state.user?.id);
  const version = useWorkspace((state) => state.knowledgeVersion);
  const scope = `${identity}:${workspace}:${kind ?? type}:${version}:${query}:${sort}`;
  const readOnly = useWorkspace(
    (state) => state.workspaces.find((item) => item.id === state.workspaceId)?.role === 'viewer',
  );
  const [result, setResult] = useState<{
    scope: string;
    pages: (Page & { parentTitle?: string })[];
    more: boolean;
    busy: boolean;
    error: string;
  }>({ scope: '', pages: [], more: false, busy: true, error: '' });
  const request = useRef(0);
  const load = useCallback(
    async (offset: number) => {
      const sequence = ++request.current;
      const current = () => {
        const state = useWorkspace.getState();
        return (
          sequence === request.current &&
          identity === state.user?.id &&
          workspace === state.workspaceId &&
          version === state.knowledgeVersion
        );
      };
      setResult((previous) => ({
        scope,
        pages: offset && previous.scope === scope ? previous.pages : [],
        more: false,
        busy: true,
        error: '',
      }));
      if (!workspace || !identity) {
        if (current()) setResult({ scope, pages: [], more: false, busy: false, error: '' });
        return;
      }
      try {
        const [order, direction] = sort.split(':');
        const next = await api<{ pages: (Page & { parentTitle?: string })[]; more: boolean }>(
          `/workspaces/${workspace}/page-list?${new URLSearchParams({ offset: String(offset), kind: kind ?? type, q: query, sort: order, direction })}`,
        );
        if (!current()) return;
        setResult((previous) => ({
          scope,
          pages:
            offset && previous.scope === scope ? [...previous.pages, ...next.pages] : next.pages,
          more: next.more,
          busy: false,
          error: '',
        }));
      } catch (error) {
        if (current())
          setResult((previous) => ({ ...previous, busy: false, error: (error as Error).message }));
      }
    },
    [workspace, identity, version, kind, type, query, sort, scope],
  );
  useEffect(() => {
    const requests = request;
    void load(0);
    return () => {
      // Invalidate the read still in flight for the previous filters.
      requests.current++;
    };
  }, [load]);
  // Permission invalidation hides the old projection before the replacement read finishes.
  const visible = result.scope === scope;
  const pages = visible ? result.pages : [];
  const more = visible && result.more;
  const busy = !visible || result.busy;
  const error = visible ? result.error : '';
  return (
    <section className="all-pages" aria-label={t(title)}>
      <div className="page-index-heading">
        <div>
          <h1>{t(title)}</h1>
        </div>
        <button
          disabled={readOnly}
          className="button primary"
          onClick={() =>
            void useWorkspace
              .getState()
              .createQuickPage(null, kind ?? 'document')
              .catch(useWorkspace.getState().setError)
          }
        >
          <Plus size={15} />
          {kind === 'canvas'
            ? t('New canvas')
            : kind === 'database'
              ? t('New database')
              : t('New page')}
        </button>
      </div>
      <div className="explorer-toolbar">
        <label className="explorer-search">
          <Search size={15} />
          <input
            aria-label={t('Search pages')}
            placeholder={t(
              kind === 'canvas'
                ? 'Find a canvas…'
                : kind === 'database'
                  ? 'Find a database…'
                  : 'Find a page…',
            )}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
        </label>
        {!kind && (
          <Select
            aria-label={t('Page type')}
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">{t('All types')}</option>
            <option value="page">{t('Pages')}</option>
            <option value="web">{t('Documents')}</option>
            <option value="database">{t('Databases')}</option>
            <option value="canvas">{t('Canvases')}</option>
            <option value="record">{t('Records')}</option>
          </Select>
        )}
        <Select
          aria-label={t('Sort pages')}
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="updated:desc">{t('Last edited')}</option>
          <option value="updated:asc">{t('Oldest edited')}</option>
          <option value="title:asc">{t('Name A–Z')}</option>
          <option value="title:desc">{t('Name Z–A')}</option>
        </Select>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {t(error)}
        </p>
      )}
      <div className="page-index-list">
        <div className="explorer-columns" aria-hidden="true">
          <span>{t('Name')}</span>
          <span>{t('Location')}</span>
          {!kind && <span>{t('Type')}</span>}
          <span>{t('Edited')}</span>
        </div>
        {pages.map((page) => (
          <button
            key={page.id}
            aria-label={t('{{title}} {{kind}}', {
              title: page.title,
              kind: t(typeLabel[pageType(page)]).toLocaleLowerCase(),
            })}
            data-kind={page.kind}
            onClick={() => useWorkspace.getState().navigate(page.id, pageView(page.kind))}
          >
            <PageGlyph page={page} size={16} />
            <span className="explorer-name">{page.title}</span>
            <small className="explorer-location">{page.parentTitle ?? t('Workspace')}</small>
            <small className="explorer-kind" hidden={!!kind}>
              {t(typeLabel[pageType(page)])}
            </small>
            <time dateTime={page.updatedAt}>
              {formatDate(page.updatedAt, { month: 'short', day: 'numeric' })}
            </time>
            <ArrowUpRight className="explorer-open" size={14} />
          </button>
        ))}
      </div>
      {!busy && !pages.length && !error && (
        <div className="explorer-empty">
          <p>
            {query || type
              ? t(
                  kind === 'canvas'
                    ? 'No canvases match these filters.'
                    : kind === 'database'
                      ? 'No databases match these filters.'
                      : 'No pages match these filters.',
                )
              : t(
                  kind === 'canvas'
                    ? 'No canvases yet.'
                    : kind === 'database'
                      ? 'No databases yet.'
                      : 'No pages yet.',
                )}
          </p>
          {(query || type) && (
            <button
              className="button"
              onClick={() => {
                setInput('');
                setQuery('');
                setType('');
              }}
            >
              {t('Clear filters')}
            </button>
          )}
        </div>
      )}
      {busy && <p className="muted-text">{t('Loading pages…')}</p>}
      {more && (
        <button className="button" disabled={busy} onClick={() => void load(pages.length)}>
          {t('Load more pages')}
        </button>
      )}
    </section>
  );
}
