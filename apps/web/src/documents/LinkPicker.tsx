import { t } from '../i18n/index.js';
import { useEffect, useRef, useState } from 'react';
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
  const results = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const isUrl = /^https?:\/\//i.test(query);
  const matches = pages
    .filter((page) => page.title.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 12);
  // Enter takes the first match (or the typed URL); the arrows walk the list like a menu.
  const keys = (event: React.KeyboardEvent) => {
    const items = [...(results.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Enter' && index < 0) {
      event.preventDefault();
      (isUrl ? items.at(-1) : items[0])?.click();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[Math.min(index + 1, items.length - 1)]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index <= 0) field.current?.focus();
      else items[index - 1]?.focus();
    }
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      void search(query).catch(useWorkspace.getState().setError);
    }, 120);
    return () => clearTimeout(timer);
  }, [query, search, version]);
  return (
    <Dialog title={t('Connect an idea')} onClose={close}>
      <label>
        {t('Find a page or enter a URL')}
        <input
          autoFocus
          ref={field}
          onKeyDown={keys}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('Search pages or https://…')}
        />
      </label>
      {loading && <p className="muted-text">{t('Searching pages…')}</p>}
      <div className="link-results" ref={results} onKeyDown={keys}>
        {!loading && !matches.length && !isUrl && query.trim() && (
          <p className="muted-text">{t('No matching pages.')}</p>
        )}
        {matches.map((page) => (
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
        {isUrl && (
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
            {t('Link to {{url}}', { url: query })}
          </button>
        )}
      </div>
    </Dialog>
  );
}
