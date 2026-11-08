import { useEffect, useRef, useState } from 'react';
import { Search as SearchIcon, FileText, ArrowUpLeft } from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import { Dialog } from '../ui/Dialog.js';
import type { SearchResult } from '../../../../packages/contracts/src/index.js';
export function Search() {
  const searched = useWorkspace((state) => state.searchResults);
  const recentIds = useWorkspace((state) => state.recentPageIds);
  const pages = useWorkspace((state) => state.pages);
  const loading = useWorkspace((state) => state.searchLoading);
  const indexing = useWorkspace((state) => state.indexing);
  const search = useWorkspace((state) => state.search);
  const version = useWorkspace((state) => state.knowledgeVersion);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [after, setAfter] = useState('');
  const [tag, setTag] = useState(useWorkspace.getState().searchTag);
  useEffect(() => () => useWorkspace.getState().clearSearchTag(), []);
  const [active, setActive] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const recent: SearchResult[] = recentIds.flatMap((id) => {
    const page = pages.find((page) => page.id === id);
    return page
      ? [{ id: page.id, title: page.title, kind: page.kind, snippet: page.description }]
      : [];
  });
  const showingRecent = !query && !kind && !after && !tag && recent.length > 0;
  const results = showingRecent ? recent : searched;
  useEffect(() => {
    resultsRef.current
      ?.querySelectorAll('[role=option]')
      [active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void search(query, { kind, after, tag }).catch(useWorkspace.getState().setError);
      setActive(0);
    }, 120);
    return () => clearTimeout(timer);
  }, [query, kind, after, tag, search, version]);
  const open = (index: number) => {
    const result = results[index];
    if (result)
      useWorkspace
        .getState()
        .navigate(result.id, result.kind === 'database' ? 'database' : 'document');
  };
  return (
    <Dialog
      title="Search your workspace"
      wide
      onClose={() => useWorkspace.getState().openDialog(null)}
    >
      <div className="search-input">
        <SearchIcon />
        <input
          autoFocus
          aria-label="Search query"
          placeholder="Find an idea, a page, a connection…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((value) => Math.max(0, Math.min(results.length - 1, value + 1)));
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((value) => Math.max(0, value - 1));
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              open(active);
            }
          }}
        />
        <kbd>↵</kbd>
      </div>
      <div className="search-filters">
        <input
          aria-label="Tag filter"
          placeholder="Filter by tag…"
          value={tag}
          maxLength={80}
          onChange={(event) => setTag(event.target.value)}
        />
        <select
          aria-label="Content type"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="">All content</option>
          <option value="document">Documents</option>
          <option value="database">Databases</option>
          <option value="record">Records</option>
        </select>
        <label>
          Updated after
          <input
            aria-label="Updated after"
            type="date"
            value={after}
            onChange={(event) => setAfter(event.target.value)}
          />
        </label>
      </div>
      {showingRecent && <p className="block-menu-caption">Recently opened</p>}
      <div className="search-results" ref={resultsRef} role="listbox" aria-label="Search results">
        {results.map((result, index) => (
          <button
            role="option"
            aria-selected={active === index}
            className={active === index ? 'active' : ''}
            key={result.id}
            onClick={() => open(index)}
          >
            <FileText />
            <span>
              <strong>{result.title}</strong>
              <small>{result.snippet || result.parentTitle || 'Workspace page'}</small>
            </span>
            <ArrowUpLeft />
          </button>
        ))}
        {!results.length && !loading && (
          <p className="table-empty">
            {query ? 'No matching pages. Try a different phrase.' : 'Your ideas will appear here.'}
          </p>
        )}
      </div>
      <footer className="search-footer">
        <span>
          {loading ? 'Searching…' : `${results.length} results`}
          {indexing ? ' · Indexing latest changes…' : ''}
        </span>
        <span>↑ ↓ to navigate · Enter to open</span>
      </footer>
    </Dialog>
  );
}
