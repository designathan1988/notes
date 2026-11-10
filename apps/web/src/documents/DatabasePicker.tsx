import { t } from '../i18n/index.js';
import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Database, Plus } from 'lucide-react';
import { Dialog } from '../ui/Dialog.js';
import { api } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
import type { Page } from '@note/contracts';
import { insertBlock } from './BlockMenu.js';

export function DatabasePicker({
  editor,
  pageId,
  position,
  close,
}: {
  editor: Editor;
  pageId: string;
  /** End of the block the menu was opened from, captured before the dialog took focus. */
  position: number;
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
  // A database view is a block of its own: it goes where the menu was opened, at the top level,
  // never into whatever the caret happens to be inside (a table cell, a list item).
  const insert = (id: string) => {
    insertBlock(editor, Math.min(position, editor.state.doc.content.size), 'databaseView', 2, {
      databaseId: id,
    });
    close();
  };
  return (
    <Dialog title={t('Insert a database view')} onClose={close}>
      <label>
        {t('Find a database')}
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('Search databases…')}
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
            const page = await useWorkspace.getState().createPage(
              {
                title: query.trim() || t('Untitled database'),
                kind: 'database',
                parentId: pageId,
              },
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
        {t('Create a new database')}
      </button>
      {error && (
        <p role="alert" className="form-error">
          {t(error)}
        </p>
      )}
    </Dialog>
  );
}
