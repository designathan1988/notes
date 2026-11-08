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
  kind = 'record',
  begin,
  end,
}: {
  value: string;
  label: string;
  readOnly: boolean;
  change(value: string | null): void;
  kind?: 'record' | 'page';
  begin?(): void;
  end?(): void;
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
          if (active) setTitle(kind === 'record' ? 'Unavailable record' : 'Unavailable page');
        });
    return () => {
      active = false;
    };
  }, [value, kind]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(
      () =>
        void api<{ pages: PageLookup[] }>(
          `/workspaces/${workspace}/page-list?kind=${kind === 'record' ? 'record' : ''}&q=${encodeURIComponent(query)}`,
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
          begin?.();
        }}
      >
        <Link2 size={13} />
        {value ? title || 'Loading…' : kind === 'record' ? 'Link a record' : 'Link a page'}
      </button>
      {open && (
        <Dialog
          title={kind === 'record' ? 'Link a record' : 'Link a page'}
          onClose={() => {
            setOpen(false);
            end?.();
          }}
        >
          <label>
            {kind === 'record' ? 'Find a record' : 'Find a page'}
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={kind === 'record' ? 'Search record names…' : 'Search page names…'}
            />
          </label>
          <div className="link-results">
            {results.map((page) => (
              <button
                key={page.id}
                aria-label={page.title}
                aria-description={
                  page.parentTitle ?? (kind === 'record' ? 'Workspace record' : 'Workspace page')
                }
                onClick={() => {
                  change(page.id);
                  setTitle(page.title);
                  setOpen(false);
                }}
              >
                <Link2 size={15} />
                <span className="relation-result-context">
                  <strong>{page.title}</strong>
                  <small>
                    {page.parentTitle ??
                      (kind === 'record' ? 'Workspace record' : 'Workspace page')}
                  </small>
                </span>
              </button>
            ))}
          </div>
          {!results.length && (
            <p className="muted-text">
              {kind === 'record' ? 'No matching records.' : 'No matching pages.'}
            </p>
          )}
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
