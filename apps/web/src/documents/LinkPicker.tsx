import { useEffect, useState } from 'react';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { Link } from 'lucide-react';
import { Dialog } from '../ui/Dialog.js';
import { useWorkspace } from '../state/store.js';
export function LinkPicker({
  editor,
  close,
  onPage,
  onUrl,
}: {
  editor: TiptapEditor;
  close(): void;
  onPage?(id: string): void;
  onUrl?(url: string): void;
}) {
  const pages = useWorkspace((state) => state.searchResults);
  const search = useWorkspace((state) => state.search);
  const version = useWorkspace((state) => state.knowledgeVersion);
  const loading = useWorkspace((state) => state.searchLoading);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      void search(query).catch(useWorkspace.getState().setError);
    }, 120);
    return () => clearTimeout(timer);
  }, [query, search, version]);
  return (
    <Dialog title="Connect an idea" onClose={close}>
      <label>
        Find a page or enter a URL
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pages or https://…"
        />
      </label>
      {loading && <p className="muted-text">Searching pages…</p>}
      <div className="link-results">
        {pages
          .filter((page) => page.title.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 12)
          .map((page) => (
            <button
              key={page.id}
              onClick={() => {
                if (onPage) {
                  onPage(page.id);
                  close();
                  return;
                }
                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: 'wikiLink',
                    attrs: { targetId: page.id, label: page.title },
                  })
                  .run();
                close();
              }}
            >
              <Link size={16} />
              {page.title}
            </button>
          ))}
        {/^https?:\/\//i.test(query) && (
          <button
            onClick={() => {
              if (onUrl) {
                onUrl(query);
                close();
                return;
              }
              if (!editor.state.selection.empty || editor.isActive('link')) {
                editor.chain().focus().extendMarkRange('link').setLink({ href: query }).run();
                close();
                return;
              }
              editor
                .chain()
                .focus()
                .insertContent({
                  type: 'text',
                  text: query,
                  marks: [{ type: 'link', attrs: { href: query } }],
                })
                .run();
              close();
            }}
          >
            Link to {query}
          </button>
        )}
      </div>
    </Dialog>
  );
}
