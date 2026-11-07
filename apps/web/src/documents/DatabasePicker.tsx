import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Database, Plus } from 'lucide-react';
import { Dialog } from '../ui/Dialog.js';
import { api } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
import type { Page } from '../../../../packages/contracts/src/index.js';

export function DatabasePicker({
  editor,
  pageId,
  close,
}: {
  editor: Editor;
  pageId: string;
  close(): void;
}) {
  const workspaceId = useWorkspace((state) => state.workspaceId);
  const [query, setQuery] = useState('');
  const [pages, setPages] = useState<Page[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void api<{ pages: Page[] }>(
      `/workspaces/${workspaceId}/page-list?kind=database&q=${encodeURIComponent(query)}`,
    )
      .then((result) => {
        if (active) setPages(result.pages);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [workspaceId, query]);
  const insert = (id: string) => {
    editor
      .chain()
      .focus()
      .insertContent({ type: 'databaseView', attrs: { databaseId: id } })
      .run();
    close();
  };
  return (
    <Dialog title="Insert a database view" onClose={close}>
      <label>
        Find a database
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search databases…"
        />
      </label>
      <div className="picker-results">
        {pages.map((page) => (
          <button key={page.id} className="search-result" onClick={() => insert(page.id)}>
            <Database size={17} />
            <span>{page.title}</span>
          </button>
        ))}
      </div>
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const page = await useWorkspace
              .getState()
              .createPage(
                { title: query.trim() || 'Untitled database', kind: 'database', parentId: pageId },
                { navigate: false },
              );
            insert(page.id);
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Plus size={15} />
        Create a new database
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </Dialog>
  );
}
