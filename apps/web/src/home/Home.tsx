import {
  ArrowRight,
  Command,
  Database,
  FileText,
  LayoutTemplate,
  Network,
  Search,
  Shapes,
  Star,
} from 'lucide-react';
import type { Page, PageKind } from '@note/contracts';
import { useWorkspace } from '../state/store.js';
import { pageView } from '../workbench/route.js';
import { PageGlyph } from '../ui/PageGlyph.js';

const kindLabel: Record<PageKind, string> = {
  document: 'Page',
  database: 'Database',
  canvas: 'Canvas',
  record: 'Record',
};

const kindPlural: Record<PageKind, string> = {
  document: 'Pages',
  database: 'Databases',
  canvas: 'Canvases',
  record: 'Records',
};

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
export function edited(iso: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of units)
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  return 'just now';
}

function greeting(hour: number) {
  return hour < 5
    ? 'Working late'
    : hour < 12
      ? 'Good morning'
      : hour < 18
        ? 'Good afternoon'
        : 'Good evening';
}

export function Home() {
  const state = useWorkspace();
  const workspace = state.workspaces.find((item) => item.id === state.workspaceId);
  const canWrite = !!workspace && workspace.role !== 'viewer';
  const now = new Date();
  const live = state.pages.filter((page) => !page.deletedAt && !page.templateRootId);
  const recent = live
    .filter((page) => page.kind !== 'record')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);
  const favorites = live.filter((page) => state.favorites.includes(page.id)).slice(0, 6);
  const count = (kind: PageKind) => live.filter((page) => page.kind === kind).length;
  const open = (page: Page) => state.navigate(page.id, pageView(page.kind));
  const create = (kind: 'document' | 'database' | 'canvas') => () =>
    void state.createQuickPage(null, kind).catch(state.setError);
  const actions = [
    {
      label: 'New page',
      hint: 'Write and structure ideas',
      kind: 'document',
      Icon: FileText,
      run: create('document'),
    },
    {
      label: 'New database',
      hint: 'Track records in views',
      kind: 'database',
      Icon: Database,
      run: create('database'),
    },
    {
      label: 'New canvas',
      hint: 'Think spatially',
      kind: 'canvas',
      Icon: Shapes,
      run: create('canvas'),
    },
    {
      label: 'Templates',
      hint: 'Start from a blueprint',
      kind: 'template',
      Icon: LayoutTemplate,
      run: () => state.navigate(null, 'templates'),
    },
  ] as const;
  return (
    <div className="home-scroll">
      <section className="home" aria-labelledby="home-title">
        <header className="home-hero">
          <p className="home-date">
            {now.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 id="home-title">
            {greeting(now.getHours())}
            {state.user ? (
              <>
                , <span className="spectrum-text">{state.user.name.split(' ')[0]}</span>
              </>
            ) : null}
          </h1>
          <p className="home-lede">
            Everything in <strong>{workspace?.name ?? 'your workspace'}</strong>, one keystroke
            away.
          </p>
          <button className="home-search" onClick={() => state.openDialog('search')}>
            <Search size={18} />
            <span>Search pages, records and ideas…</span>
            <kbd>Ctrl K</kbd>
          </button>
        </header>

        <div className="home-actions" role="group" aria-label="Create">
          {actions.map(({ label, hint, kind, Icon, run }) => (
            <button
              key={label}
              className="home-action"
              data-kind={kind}
              disabled={kind !== 'template' && !canWrite}
              onClick={run}
            >
              <span className="kind-tile" data-kind={kind} aria-hidden="true">
                <Icon size={18} />
              </span>
              <span>
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
            </button>
          ))}
        </div>

        <section className="home-section" aria-labelledby="home-recent">
          <div className="home-section-head">
            <h2 id="home-recent">Jump back in</h2>
            <button className="text-button" onClick={() => state.navigate(null, 'all')}>
              All pages <ArrowRight size={14} />
            </button>
          </div>
          {recent.length ? (
            <div className="home-cards">
              {recent.map((page) => (
                <button
                  key={page.id}
                  className="home-card"
                  data-kind={page.kind}
                  onClick={() => open(page)}
                >
                  <span className="home-card-head">
                    <PageGlyph page={page} size={16} />
                    <span className="home-card-kind">{kindLabel[page.kind]}</span>
                  </span>
                  <strong>{page.title || 'Untitled'}</strong>
                  {page.description && (
                    <span className="home-card-excerpt">{page.description}</span>
                  )}
                  <small>Edited {edited(page.updatedAt)}</small>
                </button>
              ))}
            </div>
          ) : (
            <p className="home-empty">Pages you edit will appear here.</p>
          )}
        </section>

        <div className="home-columns">
          <section className="home-section" aria-labelledby="home-favorites">
            <div className="home-section-head">
              <h2 id="home-favorites">Favorites</h2>
            </div>
            {favorites.length ? (
              <ul className="home-list">
                {favorites.map((page) => (
                  <li key={page.id}>
                    <button onClick={() => open(page)}>
                      <PageGlyph page={page} size={15} />
                      <span>{page.title || 'Untitled'}</span>
                      <small>{edited(page.updatedAt)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="home-empty">
                <Star size={15} /> Star a page to pin it here.
              </p>
            )}
          </section>
          <section className="home-section" aria-labelledby="home-overview">
            <div className="home-section-head">
              <h2 id="home-overview">Workspace</h2>
            </div>
            <dl className="home-stats">
              {(['document', 'database', 'canvas', 'record'] as const).map((kind) => (
                <div key={kind} data-kind={kind}>
                  <dt>{kindPlural[kind]}</dt>
                  <dd>{count(kind)}</dd>
                </div>
              ))}
            </dl>
            <div className="home-shortcuts">
              <button onClick={state.showCommands}>
                <Command size={15} /> Command palette <kbd>Ctrl Shift P</kbd>
              </button>
              <button onClick={() => state.navigate(state.selectedId, 'graph')}>
                <Network size={15} /> Explore the knowledge graph
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
