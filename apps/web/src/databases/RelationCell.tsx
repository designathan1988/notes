import { useEffect, useState } from 'react';
import { Link2, X } from 'lucide-react';
import type { Page, PageLookup } from '../../../../packages/contracts/src/index.js';
import { api } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
import { Dialog } from '../ui/Dialog.js';
export function RelationCell({
  value,
  label,
  readOnly,
  change,
}: {
  value: string;
  label: string;
  readOnly: boolean;
  change(value: string | null): void;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(''),
    [title, setTitle] = useState('');
  const [results, setResults] = useState<PageLookup[]>([]),
    [error, setError] = useState('');
  const workspace = useWorkspace((state) => state.workspaceId);
  useEffect(() => {
    let active = true;
    setTitle('');
    if (value)
      void api<Page>(`/pages/${value}`)
        .then((page) => {
          if (active) setTitle(page.title);
        })
        .catch(() => {
          if (active) setTitle('Unavailable record');
        });
    return () => {
      active = false;
    };
  }, [value]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(
      () =>
        void api<{ pages: PageLookup[] }>(
          `/workspaces/${workspace}/page-list?kind=record&q=${encodeURIComponent(query)}`,
        )
          .then((result) => {
            if (active) {
              setResults(result.pages);
              setError('');
            }
          })
          .catch((error) => {
            if (active) setError(error.message);
          }),
      120,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, query, workspace]);
  return (
    <>
      <button
        className="relation-cell"
        aria-label={label}
        disabled={readOnly && !value}
        onClick={() => {
          if (readOnly && value) useWorkspace.getState().navigate(value);
          else setOpen(true);
        }}
      >
        <Link2 size={13} />
        {value ? title || 'Loading…' : 'Link a record'}
      </button>
      {open && (
        <Dialog title="Link a record" onClose={() => setOpen(false)}>
          <label>
            Find a record
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search record names…"
            />
          </label>
          <div className="link-results">
            {results.map((page) => (
              <button
                key={page.id}
                aria-label={page.title}
                aria-description={page.parentTitle ?? 'Workspace record'}
                onClick={() => {
                  change(page.id);
                  setTitle(page.title);
                  setOpen(false);
                }}
              >
                <Link2 size={15} />
                <span className="relation-result-context">
                  <strong>{page.title}</strong>
                  <small>{page.parentTitle ?? 'Workspace record'}</small>
                </span>
              </button>
            ))}
          </div>
          {!results.length && <p className="muted-text">No matching records.</p>}
          {value && (
            <button
              className="text-button"
              onClick={() => {
                change(null);
                setOpen(false);
              }}
            >
              <X size={13} />
              Clear relation
            </button>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </Dialog>
      )}
    </>
  );
}
