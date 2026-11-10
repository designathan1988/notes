import { t } from '../i18n/index.js';
import { Select } from '../ui/Select.js';
import { useEffect, useRef, useState } from 'react';
import { Search as SearchIcon, ArrowUpLeft } from 'lucide-react';
import { pageView } from '../workbench/route.js';
import { KindIcon } from '../ui/PageGlyph.js';
import { useWorkspace } from '../state/store.js';
import { Dialog } from '../ui/Dialog.js';
import type { SearchResult } from '@note/contracts';
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
    const options = resultsRef.current?.querySelectorAll('[role=option]');
    options?.[active]?.scrollIntoView({ block: 'nearest' });
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
    if (result) useWorkspace.getState().navigate(result.id, pageView(result.kind));
  };
  return (
    <Dialog
      title={t('Search your workspace')}
      wide
      onClose={() => useWorkspace.getState().openDialog(null)}
    >
      <div className="search-input">
        <SearchIcon />
        <input
          autoFocus
          aria-label={t('Search query')}
          placeholder={t('Find an idea, a page, a connection…')}
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
          aria-label={t('Tag filter')}
          placeholder={t('Filter by tag…')}
          value={tag}
          maxLength={80}
          onChange={(event) => setTag(event.target.value)}
        />
        <Select
          aria-label={t('Content type')}
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="">{t('All content')}</option>
          <option value="document">{t('Pages')}</option>
          <option value="database">{t('Databases')}</option>
          <option value="canvas">{t('Canvases')}</option>
          <option value="record">{t('Records')}</option>
        </Select>
        <label>
          {t('Updated after')}
          <input
            aria-label={t('Updated after')}
            type="date"
            value={after}
            onChange={(event) => setAfter(event.target.value)}
          />
        </label>
      </div>
      {showingRecent && <p className="block-menu-caption">{t('Recently opened')}</p>}
      <div
        className="search-results"
        ref={resultsRef}
        role="listbox"
        aria-label={t('Search results')}
      >
        {results.map((result, index) => (
          <button
            role="option"
            aria-selected={active === index}
            className={active === index ? 'active' : ''}
            key={result.id}
            onClick={() => open(index)}
          >
            <KindIcon kind={result.kind} />
            <span>
              <strong>{result.title}</strong>
              <small>{result.snippet || result.parentTitle || t('Workspace page')}</small>
            </span>
            <ArrowUpLeft />
          </button>
        ))}
        {!results.length && !loading && (
          <p className="table-empty">
            {query
              ? t('No matching pages. Try a different phrase.')
              : t('Your ideas will appear here.')}
          </p>
        )}
      </div>
      <footer className="search-footer">
        <span>
          {loading
            ? t('Searching…')
            : t(results.length === 1 ? '{{value0}} result' : '{{value0}} results', {
                value0: results.length,
              })}
          {indexing ? t(' · Indexing latest changes…') : ''}
        </span>
        <span>{t('↑ ↓ to navigate · Enter to open')}</span>
      </footer>
    </Dialog>
  );
}
