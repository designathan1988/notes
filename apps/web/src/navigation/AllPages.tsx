import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Plus, Search } from 'lucide-react';
import type { Page } from '@note/contracts';
import { api } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
import { pageView } from '../workbench/route.js';
import { PageGlyph } from '../ui/PageGlyph.js';
export function AllPages({ kind }: { kind?: 'database' | 'canvas' }) {
  const [input, setInput] = useState(''),
    [query, setQuery] = useState(''),
    [type, setType] = useState(''),
    [sort, setSort] = useState('updated:desc');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), 200);
    return () => clearTimeout(timer);
  }, [input]);
  const title = kind === 'canvas' ? 'Canvases' : kind === 'database' ? 'Databases' : 'All pages';
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
    void load(0);
    return () => {
      request.current++;
    };
  }, [load]);
  // Permission invalidation hides the old projection before the replacement read finishes.
  const visible = result.scope === scope;
  const pages = visible ? result.pages : [];
  const more = visible && result.more;
  const busy = !visible || result.busy;
  const error = visible ? result.error : '';
  return (
    <section className="all-pages" aria-label={title}>
      <div className="page-index-heading">
        <div>
          <h1>{title}</h1>
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
          {kind === 'canvas' ? 'New canvas' : kind === 'database' ? 'New database' : 'New page'}
        </button>
      </div>
      <div className="explorer-toolbar">
        <label className="explorer-search">
          <Search size={15} />
          <input
            aria-label="Search pages"
            placeholder="Find a page…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
        </label>
        {!kind && (
          <select
            aria-label="Page type"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">All types</option>
            <option value="document">Documents</option>
            <option value="database">Databases</option>
            <option value="canvas">Canvases</option>
            <option value="record">Records</option>
          </select>
        )}
        <select
          aria-label="Sort pages"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="updated:desc">Last edited</option>
          <option value="updated:asc">Oldest edited</option>
          <option value="title:asc">Name A–Z</option>
          <option value="title:desc">Name Z–A</option>
        </select>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="page-index-list">
        <div className="explorer-columns" aria-hidden="true">
          <span>Name</span>
          <span>Location</span>
          <span>Type</span>
          <span>Edited</span>
        </div>
        {pages.map((page) => (
          <button
            key={page.id}
            aria-label={`${page.title} ${page.kind}`}
            data-kind={page.kind}
            onClick={() => useWorkspace.getState().navigate(page.id, pageView(page.kind))}
          >
            <PageGlyph page={page} size={16} />
            <span className="explorer-name">{page.title}</span>
            <small className="explorer-location">{page.parentTitle ?? 'Workspace'}</small>
            <small className="explorer-kind">
              {page.kind === 'document'
                ? 'Document'
                : page.kind === 'canvas'
                  ? 'Canvas'
                  : page.kind === 'database'
                    ? 'Database'
                    : 'Record'}
            </small>
            <time dateTime={page.updatedAt}>
              {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(
                new Date(page.updatedAt),
              )}
            </time>
            <ArrowUpRight className="explorer-open" size={14} />
          </button>
        ))}
      </div>
      {!busy && !pages.length && !error && (
        <p className="explorer-empty">
          {query || type ? 'No pages match these filters.' : 'No pages yet.'}
        </p>
      )}
      {busy && <p className="muted-text">Loading pages…</p>}
      {more && (
        <button className="button" disabled={busy} onClick={() => void load(pages.length)}>
          Load more pages
        </button>
      )}
    </section>
  );
}
