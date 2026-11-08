import { FileText, Link2, Network } from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import { useEffect } from 'react';
export function ContextPanel() {
  const outline = useWorkspace((state) => state.outline);
  const links = useWorkspace((state) => state.linkedPageIds);
  const pages = useWorkspace((state) => state.pages);
  const selectedId = useWorkspace((state) => state.selectedId);
  const mentions = useWorkspace((state) => state.mentions[selectedId ?? '']);
  const load = useWorkspace((state) => state.loadMentions);
  const version = useWorkspace((state) => state.knowledgeVersion);
  const workspace = useWorkspace((state) => state.workspaceId);
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
  return (
    <div className="details-content">
      <dl className="page-facts">
        <div>
          <dt>Edited</dt>
          <dd>
            {current &&
              new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
                new Date(current.updatedAt),
              )}
          </dd>
        </div>
        <div>
          <dt>Access</dt>
          <dd>{current?.visibility === 'private' ? 'Private' : 'Workspace'}</dd>
        </div>
      </dl>
      <details className="context-section" open>
        <summary>
          On this page <span>{outline.length}</span>
        </summary>
        <nav className="context-outline">
          {outline.map((heading, index) => (
            <button
              key={index}
              style={{ paddingLeft: `${Math.max(0, heading.level - 1) * 12}px` }}
              onClick={() =>
                document
                  .querySelectorAll('.note-editor h1,.note-editor h2,.note-editor h3')
                  [index]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            >
              {heading.text}
            </button>
          ))}
          {!outline.length && <p className="muted-text">Add headings to navigate this page.</p>}
        </nav>
      </details>
      <details className="context-section" open>
        <summary>
          Connections <span>{connected.length}</span>
        </summary>
        <div className="connected-list">
          {connected.map((page) => (
            <button key={page.id} onClick={() => useWorkspace.getState().navigate(page.id)}>
              <FileText size={14} />
              {page.title}
            </button>
          ))}
        </div>
        {!connected.length && <p className="muted-text">No outgoing page links.</p>}
        <details className="context-graph-preview">
          <summary>Graph preview</summary>
          <div className="local-graph">
            <svg viewBox="0 0 300 180" role="img" aria-label="Connected pages">
              {connected.slice(0, 3).map((page, index) => {
                const [x, y] = [
                  [150, 25],
                  [65, 145],
                  [235, 145],
                ][index];
                return (
                  <g key={page.id}>
                    <path d={`M150 85L${x} ${y}`} stroke="var(--rule)" />
                    <g
                      role="button"
                      tabIndex={0}
                      aria-label={page.title}
                      onClick={() => useWorkspace.getState().navigate(page.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          useWorkspace.getState().navigate(page.id);
                        }
                      }}
                    >
                      <rect
                        x={x - 52}
                        y={y - 15}
                        width="104"
                        height="30"
                        rx="3"
                        fill="var(--canvas)"
                        stroke="var(--rule)"
                      />
                      <text x={x} y={y + 4} textAnchor="middle">
                        {page.title.length > 18 ? page.title.slice(0, 16) + '…' : page.title}
                      </text>
                    </g>
                  </g>
                );
              })}
              <rect
                x="70"
                y="70"
                width="160"
                height="30"
                rx="3"
                fill="var(--selected)"
                stroke="var(--rule)"
              />
              <text x="150" y="89" textAnchor="middle">
                {current?.title.slice(0, 23)}
              </text>
            </svg>
          </div>
        </details>
        <button
          className="details-graph-link"
          onClick={() => useWorkspace.getState().navigate(selectedId, 'graph')}
        >
          <Network size={13} />
          Explore knowledge graph
        </button>
      </details>
      <details className="context-section mentions-section" open>
        <summary>
          Linked mentions <span>{mentions?.length ?? 0}</span>
        </summary>
        {mentions?.length ? (
          mentions.map((mention) => (
            <button
              className="mention"
              key={mention.sourceId}
              onClick={() => useWorkspace.getState().navigate(mention.sourceId)}
            >
              <FileText />
              <span>
                <strong>{mention.title}</strong>
                <small>{mention.excerpt}</small>
              </span>
            </button>
          ))
        ) : (
          <p className="muted-text">No linked mentions yet.</p>
        )}
      </details>
      <button
        className="context-connect"
        onClick={() =>
          document.querySelector<HTMLButtonElement>('[aria-label="Insert link"]')?.click()
        }
      >
        <Link2 />
        Connect an idea
      </button>
    </div>
  );
}
