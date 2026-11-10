import { t, getLocale } from '../i18n/index.js';
import { FileText, Link2, Network } from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import { useEffect } from 'react';
import { PageTags } from '../pages/PagePresentation.js';
import { PageProperties } from '../pages/PageProperties.js';
export function ContextPanel() {
  const outline = useWorkspace((state) => state.outline);
  const links = useWorkspace((state) => state.linkedPageIds);
  const pages = useWorkspace((state) => state.pages);
  const selectedId = useWorkspace((state) => state.selectedId);
  const mentions = useWorkspace((state) => state.mentions[selectedId ?? '']);
  const load = useWorkspace((state) => state.loadMentions);
  const version = useWorkspace((state) => state.knowledgeVersion);
  const workspace = useWorkspace((state) => state.workspaceId);
  const role = useWorkspace(
    (state) => state.workspaces.find((item) => item.id === state.workspaceId)?.role,
  );
  const readOnly = !role || role === 'viewer';
  const graph = useWorkspace((state) => state.graphs[`${workspace}:${selectedId}`]);
  useEffect(() => {
    if (!selectedId) return;
    const refresh = () => {
      void load(selectedId).catch(() => {});
      void useWorkspace
        .getState()
        .loadGraph(selectedId)
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 3500);
    return () => clearInterval(timer);
  }, [selectedId, load, version]);
  const connected = links
    .map(
      (id) => graph?.nodes.find((page) => page.id === id) ?? pages.find((page) => page.id === id),
    )
    .filter((page): page is NonNullable<typeof page> => !!page);
  const current = pages.find((page) => page.id === selectedId);
  // The neighbourhood: pages this one links to and pages that cite it, around it.
  const neighbours = [
    ...connected.map((page) => ({ id: page.id, title: page.title, kind: page.kind })),
    ...(mentions ?? [])
      .filter((mention) => !connected.some((page) => page.id === mention.sourceId))
      .map((mention) => ({
        id: mention.sourceId,
        title: mention.title,
        kind: pages.find((page) => page.id === mention.sourceId)?.kind ?? 'document',
      })),
  ].slice(0, 6);
  const go = (id: string) => useWorkspace.getState().navigate(id);
  const title = current?.title ?? '';
  return (
    <div className="details-content">
      {current?.kind === 'canvas' && (
        <details className="context-section canvas-metadata">
          <summary>{t('Properties and tags')}</summary>
          <PageTags key={`tags-${current.id}`} page={current} readOnly={readOnly} />
          <PageProperties key={`properties-${current.id}`} page={current} readOnly={readOnly} />
        </details>
      )}
      <section className="context-block">
        <h3 className="context-heading">{t('Neighbourhood')}</h3>
        <div className="local-graph">
          <svg viewBox="0 0 300 168" role="img" aria-label={t('Connected pages')}>
            {neighbours.map((page, index) => {
              const angle = (index / Math.max(neighbours.length, 1)) * Math.PI * 2 - Math.PI / 2.6;
              const x = 150 + Math.cos(angle) * 88;
              const y = 84 + Math.sin(angle) * 56;
              return (
                <g key={page.id}>
                  <line x1="150" y1="84" x2={x} y2={y} className="local-edge" />
                  <g
                    role="button"
                    tabIndex={0}
                    aria-label={page.title}
                    className="local-node"
                    data-kind={page.kind}
                    onClick={() => go(page.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        go(page.id);
                      }
                    }}
                  >
                    <circle cx={x} cy={y} r="5" />
                    <text x={x} y={y < 84 ? y - 11 : y + 19} textAnchor="middle">
                      {page.title.length > 16 ? page.title.slice(0, 14) + '…' : page.title}
                    </text>
                  </g>
                </g>
              );
            })}
            <circle cx="150" cy="84" r="15" className="local-halo" />
            <circle cx="150" cy="84" r="8" className="local-center" />
          </svg>
        </div>
        <button
          className="details-graph-link"
          onClick={() => useWorkspace.getState().navigate(selectedId, 'graph')}
        >
          <Network size={13} />
          {t('Explore knowledge graph')}
        </button>
      </section>
      <section className="context-block mentions-section">
        <h3 className="context-heading">
          {t('Backlinks')} <span>{mentions?.length ?? 0}</span>
        </h3>
        {mentions?.length ? (
          mentions.map((mention) => (
            <button className="mention" key={mention.sourceId} onClick={() => go(mention.sourceId)}>
              <FileText />
              <span>
                <strong>{mention.title}</strong>
                <small>{highlight(mention.excerpt, title)}</small>
              </span>
            </button>
          ))
        ) : (
          <p className="muted-text">{t('No linked mentions yet.')}</p>
        )}
      </section>
      <section className="context-block">
        <h3 className="context-heading">
          {t('Mentions')} <span>{connected.length}</span>
        </h3>
        {connected.length ? (
          <div className="context-mentions">
            {connected.map((page) => (
              <button key={page.id} onClick={() => go(page.id)}>
                <span>{page.title}</span>
                <small>{t(kindName[page.kind ?? 'document'] ?? 'Page')}</small>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted-text">{t('No outgoing page links.')}</p>
        )}
      </section>
      {current?.kind !== 'database' && (
        <button
          className="context-connect"
          disabled={readOnly}
          onClick={() => {
            useWorkspace.getState().requestEditor('link');
            if (matchMedia('(max-width:1050px)').matches)
              useWorkspace.getState().setContextOpen(false);
          }}
        >
          <Link2 />
          {t('Connect an idea')}
        </button>
      )}
      {/* With the panel open the right-hand outline steps aside, so it lives here, open. */}
      <details className="context-section" open>
        <summary>
          {t('On this page')} <span>{outline.length}</span>
        </summary>
        <nav className="context-outline">
          {outline.map((heading, index) => (
            <button
              key={index}
              style={{ paddingLeft: `${Math.max(0, heading.level - 1) * 12}px` }}
              onClick={() => {
                useWorkspace.getState().requestEditor({ heading: index });
                if (matchMedia('(max-width:1050px)').matches)
                  useWorkspace.getState().setContextOpen(false);
              }}
            >
              {heading.text}
            </button>
          ))}
          {!outline.length && (
            <p className="muted-text">{t('Add headings to navigate this page.')}</p>
          )}
        </nav>
      </details>
      <dl className="page-facts">
        <div>
          <dt>{t('Edited')}</dt>
          <dd>
            {current &&
              new Intl.DateTimeFormat(getLocale(), {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(current.updatedAt))}
          </dd>
        </div>
        <div>
          <dt>{t('Access')}</dt>
          <dd>{current?.visibility === 'private' ? t('Private') : t('Workspace')}</dd>
        </div>
      </dl>
    </div>
  );
}

const kindName: Record<string, string> = {
  document: 'Page',
  database: 'Database',
  canvas: 'Canvas',
  record: 'Record',
};

/** The cited page's title, marked inside the snippet that cites it. */
function highlight(text: string, title: string) {
  const at = title ? text.toLowerCase().indexOf(title.toLowerCase()) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + title.length)}</mark>
      {text.slice(at + title.length)}
    </>
  );
}
