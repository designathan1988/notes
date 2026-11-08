import { useCallback, useEffect, useRef, useState } from 'react';
import { Database, FileText, ArrowUpRight, Plus, SquareDashed } from 'lucide-react';
import type { Page } from '../../../../packages/contracts/src/index.js';
import { api } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
import { pageView } from '../workbench/route.js';
export function AllPages({ kind }: { kind?: 'database' | 'canvas' }) {
  const title = kind === 'canvas' ? 'Canvases' : kind === 'database' ? 'Databases' : 'All pages';
  const workspace = useWorkspace((state) => state.workspaceId);
  const identity = useWorkspace((state) => state.user?.id);
  const version = useWorkspace((state) => state.knowledgeVersion);
  const scope = `${identity}:${workspace}:${kind ?? ''}:${version}`;
  const readOnly = useWorkspace(
    (state) => state.workspaces.find((item) => item.id === state.workspaceId)?.role === 'viewer',
  );
  const [result, setResult] = useState<{
    scope: string;
    pages: Page[];
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
        const next = await api<{ pages: Page[]; more: boolean }>(
          `/workspaces/${workspace}/page-list?offset=${offset}&kind=${kind ?? ''}`,
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
    [workspace, identity, version, kind, scope],
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
          <p className="muted-text">
            {kind === 'canvas'
              ? 'Space to connect notes, media, and ideas.'
              : kind
                ? 'Structured information, connected to your pages.'
                : 'Your workspace, connected.'}
          </p>
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
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="page-index-list">
        {pages.map((page) => (
          <button
            key={page.id}
            onClick={() => useWorkspace.getState().navigate(page.id, pageView(page.kind))}
          >
            {page.icon ? (
              <span className="page-reference-icon" aria-hidden="true">
                {page.icon}
              </span>
            ) : page.kind === 'canvas' ? (
              <SquareDashed />
            ) : page.kind === 'database' ? (
              <Database />
            ) : (
              <FileText />
            )}
            <span>{page.title}</span>
            <small>{page.kind}</small>
            <ArrowUpRight size={14} />
          </button>
        ))}
      </div>
      {busy && <p className="muted-text">Loading pages…</p>}
      {more && (
        <button className="button" disabled={busy} onClick={() => void load(pages.length)}>
          Load more pages
        </button>
      )}
    </section>
  );
}
