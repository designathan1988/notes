import { t, formatDate, formatNumber, formatRelative } from '../i18n/index.js';
import { Database, FileText, LayoutTemplate, Shapes, Star } from 'lucide-react';
import type { Page, PageKind } from '@note/contracts';
import { useEffect, useState } from 'react';
import { useWorkspace } from '../state/store.js';
import { api } from '../state/api.js';
import { pageView } from '../workbench/route.js';
import { PageGlyph } from '../ui/PageGlyph.js';

const kindPlural: Record<PageKind, string> = {
  document: 'Pages',
  database: 'Databases',
  canvas: 'Canvases',
  record: 'Records',
};

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
    if (Math.abs(seconds) >= size) return formatRelative(Math.round(seconds / size), unit);
  return t('just now');
}

function greeting(hour: number) {
  return hour < 5
    ? t('Working late')
    : hour < 12
      ? t('Good morning')
      : hour < 18
        ? t('Good afternoon')
        : t('Good evening');
}

/** Untitled work is still recent work and must remain easy to recover. */
export function recentPages(pages: Page[], limit = 8) {
  return pages
    .filter((page) => !page.deletedAt && !page.templateRootId && page.kind !== 'record')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

type Overview = { counts: Record<PageKind, number>; editedSince: number };
function useOverview(workspaceId: string | null, version: number, pages: Page[]) {
  const [overview, setOverview] = useState<Overview | null>(null);
  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    void api<Overview>(
      `/workspaces/${workspaceId}/overview?since=${encodeURIComponent(midnight.toISOString())}`,
    )
      .then((result) => active && setOverview(result))
      .catch(() => active && setOverview(null));
    return () => {
      active = false;
    };
  }, [workspaceId, version, pages]);
  return overview;
}

export function Home() {
  const state = useWorkspace();
  const workspace = state.workspaces.find((item) => item.id === state.workspaceId);
  const canWrite = !!workspace && workspace.role !== 'viewer';
  const now = new Date();
  const live = state.pages.filter((page) => !page.deletedAt && !page.templateRootId);
  const recent = recentPages(live);
  // The sidebar holds only the loaded part of the tree, so totals come from the server.
  const overview = useOverview(state.workspaceId, state.knowledgeVersion, state.pages);
  const today = overview?.editedSince;
  const favorites = live.filter((page) => state.favorites.includes(page.id)).slice(0, 6);
  const titleOf = (id: string | null) => state.pages.find((page) => page.id === id)?.title;
  const open = (page: Page) => state.navigate(page.id, pageView(page.kind));
  const create = (kind: 'document' | 'database' | 'canvas') => () =>
    void state.createQuickPage(null, kind).catch(state.setError);
  const actions = [
    { label: 'Page', kind: 'document', Icon: FileText, run: create('document') },
    { label: 'Database', kind: 'database', Icon: Database, run: create('database') },
    { label: 'Canvas', kind: 'canvas', Icon: Shapes, run: create('canvas') },
    {
      label: 'From template',
      kind: 'template',
      Icon: LayoutTemplate,
      run: () => state.navigate(null, 'templates'),
    },
  ] as const;
  return (
    <div className="home-scroll">
      <section className="home" aria-labelledby="home-title">
        <header className="home-head">
          <div>
            <h1 id="home-title">
              {greeting(now.getHours())}
              {state.user ? `, ${state.user.name.split(' ')[0]}` : ''}
            </h1>
            <p>
              {formatDate(now, { weekday: 'long', month: 'long', day: 'numeric' })}
              {' · '}
              {today === undefined
                ? ''
                : today === 1
                  ? t('1 page edited today')
                  : t('{{count}} pages edited today', { count: formatNumber(today) })}
            </p>
          </div>
          <div className="home-actions" role="group" aria-label={t('Create')}>
            {actions.map(({ label, kind, Icon, run }) => (
              <button
                key={t(label)}
                type="button"
                className="home-action"
                data-kind={kind}
                aria-label={
                  kind === 'template'
                    ? t('New from template')
                    : t(
                        kind === 'document'
                          ? 'New page'
                          : kind === 'database'
                            ? 'New database'
                            : 'New canvas',
                      )
                }
                disabled={kind !== 'template' && !canWrite}
                onClick={run}
              >
                <Icon size={14} />
                {t(label)}
              </button>
            ))}
          </div>
        </header>

        <div className="home-grid">
          <section className="home-section" aria-labelledby="home-recent">
            <div className="home-section-head">
              <h2 id="home-recent">{t('Recent')}</h2>
              <button className="text-button" onClick={() => state.navigate(null, 'all')}>
                {t('View all')}
              </button>
            </div>
            {recent.length ? (
              <ul className="home-recent">
                {recent.map((page) => (
                  <li key={page.id}>
                    <button type="button" data-kind={page.kind} onClick={() => open(page)}>
                      <PageGlyph page={page} size={15} />
                      <span className="home-recent-text">
                        <strong>{page.title || t('Untitled')}</strong>
                        <small>
                          {titleOf(page.parentId) ?? workspace?.name ?? t('Workspace')}
                          {page.description ? ` · ${page.description}` : ''}
                        </small>
                      </span>
                      <time dateTime={page.updatedAt}>{edited(page.updatedAt)}</time>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="home-empty">{t('Pages you edit will appear here.')}</p>
            )}
          </section>

          <aside className="home-aside">
            <section className="home-section" aria-labelledby="home-favorites">
              <h2 id="home-favorites">{t('Favorites')}</h2>
              {favorites.length ? (
                <ul className="home-links">
                  {favorites.map((page) => (
                    <li key={page.id}>
                      <button type="button" data-kind={page.kind} onClick={() => open(page)}>
                        <PageGlyph page={page} size={14} />
                        <span>{page.title || t('Untitled')}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="home-empty">
                  <Star size={14} />
                  {t('Star a page to pin it here.')}
                </p>
              )}
            </section>

            <section className="home-section" aria-labelledby="home-overview">
              <h2 id="home-overview">{t('Workspace')}</h2>
              <dl className="home-stats">
                {(['document', 'database', 'canvas', 'record'] as const).map((kind) => (
                  <div key={kind}>
                    <dd>{overview ? formatNumber(overview.counts[kind]) : '—'}</dd>
                    <dt>{t(kindPlural[kind])}</dt>
                  </div>
                ))}
              </dl>
            </section>

            <section className="home-section" aria-labelledby="home-keys">
              <h2 id="home-keys">{t('Shortcuts')}</h2>
              <div className="home-keys">
                <button type="button" onClick={() => state.openDialog('search')}>
                  {t('Search')} <kbd>Ctrl K</kbd>
                </button>
                <button type="button" onClick={state.showCommands}>
                  {t('Commands')} <kbd>Ctrl Shift P</kbd>
                </button>
                <button
                  type="button"
                  disabled={!canWrite}
                  onClick={() => void state.createQuickPage().catch(state.setError)}
                >
                  {t('New page')} <kbd>Ctrl Alt N</kbd>
                </button>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
}
