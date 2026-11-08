import { FileText, Link2, Network } from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import { useEffect, useState } from 'react';
export function ContextPanel() {
  const [tab, setTab] = useState<'outline' | 'links'>('outline');
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
      <div className="details-tabs" role="tablist" aria-label="Page details view">
        <button role="tab" aria-selected={tab === 'outline'} onClick={() => setTab('outline')}>
          Outline
        </button>
        <button role="tab" aria-selected={tab === 'links'} onClick={() => setTab('links')}>
          Links <span>{connected.length}</span>
        </button>
      </div>
      {tab === 'outline' && (
        <section>
          <h3>On this page</h3>
          <nav>
            {outline.map((heading, index) => (
              <button
                key={index}
                onClick={() =>
                  document
                    .querySelectorAll('.note-editor h1,.note-editor h2,.note-editor h3')
                    [index]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              >
                <span className="outline-level">H{heading.level}</span>
                {heading.text}
              </button>
            ))}
            {!outline.length && (
              <p className="muted-text">Headings you add become your page outline.</p>
            )}
          </nav>
        </section>
      )}
      <section>
        <h3>Connections</h3>
        <div className="local-graph">
          <svg viewBox="0 0 300 210" role="img" aria-label="Connected pages">
            {connected.slice(0, 3).map((page, index) => {
              const positions = [
                [150, 30],
                [70, 175],
                [235, 175],
              ];
              const [x, y] = positions[index];
              return (
                <g key={page.id}>
                  <path d={`M150 105L${x} ${y}`} stroke="#bdc6e1" fill="none" />
                  <g
                    className="graph-node"
                    role="link"
                    tabIndex={0}
                    onClick={() => useWorkspace.getState().navigate(page.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') useWorkspace.getState().navigate(page.id);
                    }}
                  >
                    <rect
                      x={x - 60}
                      y={y - 13}
                      width="120"
                      height="27"
                      rx="6"
                      fill="#f7f8fd"
                      stroke="#d2d8e8"
                    />
                    <text x={x} y={y + 4} textAnchor="middle">
                      {page.title.length > 19 ? page.title.slice(0, 17) + '…' : page.title}
                    </text>
                  </g>
                </g>
              );
            })}
            <rect x="70" y="88" width="160" height="32" rx="6" fill="#edf0ff" stroke="#abb6ed" />
            <text x="150" y="109" textAnchor="middle">
              {current?.title.slice(0, 23)}
            </text>
          </svg>
        </div>
        <button
          className="details-graph-link"
          onClick={() => useWorkspace.getState().navigate(selectedId, 'graph')}
        >
          <Network size={13} />
          Explore knowledge graph
        </button>
        {tab === 'links' && (
          <div className="connected-list">
            {connected.map((page) => (
              <button key={page.id} onClick={() => useWorkspace.getState().navigate(page.id)}>
                <FileText size={14} />
                {page.title}
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="mentions-section">
        <h3>Linked mentions</h3>
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
      </section>
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
