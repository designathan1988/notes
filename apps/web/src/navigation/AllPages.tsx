import { useEffect, useState } from 'react';
import { Database, FileText, ArrowUpRight } from 'lucide-react';
import type { Page } from '../../../../packages/contracts/src/index.js';
import { api } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
export function AllPages() {
  const workspace = useWorkspace((state) => state.workspaceId);
  const [pages, setPages] = useState<Page[]>([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  async function load(offset: number) {
    setBusy(true);
    try {
      const result = await api<{ pages: Page[]; more: boolean }>(
        `/workspaces/${workspace}/page-list?offset=${offset}`,
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
  }, [workspace]);
  return (
    <section className="all-pages">
      <h1>All pages</h1>
      <p>Your workspace, connected.</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div>
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
