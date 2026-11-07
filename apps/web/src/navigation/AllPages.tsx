import { useEffect, useState } from 'react';
import { Database, FileText, ArrowUpRight, Plus } from 'lucide-react';
import type { Page } from '../../../../packages/contracts/src/index.js';
import { api } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
export function AllPages({ kind }: { kind?: 'database' }) {
  const workspace = useWorkspace((state) => state.workspaceId);
  const readOnly = useWorkspace(
    (state) => state.workspaces.find((item) => item.id === state.workspaceId)?.role === 'viewer',
  );
  const [pages, setPages] = useState<Page[]>([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  async function load(offset: number) {
    setBusy(true);
    try {
      const result = await api<{ pages: Page[]; more: boolean }>(
        `/workspaces/${workspace}/page-list?offset=${offset}&kind=${kind ?? ''}`,
      );
      if (workspace !== useWorkspace.getState().workspaceId) return;
      setPages((current) => (offset ? [...current, ...result.pages] : result.pages));
      setMore(result.more);
      setError('');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setPages([]);
    void load(0);
  }, [workspace, kind]);
  return (
    <section className="all-pages" aria-label={kind ? 'Databases' : 'All pages'}>
      <div className="page-index-heading">
        <div>
          <h1>{kind ? 'Databases' : 'All pages'}</h1>
          <p className="muted-text">
            {kind
              ? 'Structured information, connected to your pages.'
              : 'Your workspace, connected.'}
          </p>
        </div>
        <button
          disabled={readOnly}
          className="button primary"
          onClick={() =>
            useWorkspace.getState().openCreatePage(null, kind ? 'database' : 'document')
          }
        >
          <Plus size={15} />
          {kind ? 'New database' : 'New page'}
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
            onClick={() =>
              useWorkspace
                .getState()
                .navigate(page.id, page.kind === 'database' ? 'database' : 'document')
            }
          >
            {page.kind === 'database' ? <Database /> : <FileText />}
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
