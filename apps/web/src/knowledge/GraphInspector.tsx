import { Crosshair, ExternalLink, PinOff, FileText, Database, X } from 'lucide-react';
import type { GraphData } from '@note/contracts';
export function GraphInspector({
  node,
  nodes,
  edges,
  placed,
  onOpen,
  onFocus,
  onRelease,
  onClose,
}: {
  node: GraphData['nodes'][number];
  nodes: GraphData['nodes'];
  edges: GraphData['edges'];
  placed: boolean;
  onOpen(node: GraphData['nodes'][number]): void;
  onFocus(): void;
  onRelease(): void;
  onClose(): void;
}) {
  const incoming = edges.filter((edge) => edge.target === node.id);
  const outgoing = edges.filter((edge) => edge.source === node.id);
  const related = new Set([
    ...incoming.map((edge) => edge.source),
    ...outgoing.map((edge) => edge.target),
  ]);
  return (
    <aside className="graph-inspector" data-spatial-control aria-label="Graph connections">
      <header>
        <strong>{node.title}</strong>
        <span>{related.size} connections</span>
        <button
          aria-label="Close graph connections"
          title="Close graph connections"
          onClick={onClose}
        >
          <X />
        </button>
      </header>
      <div className="graph-inspector-actions">
        <button onClick={() => onOpen(node)}>
          <ExternalLink />
          Open page
        </button>
        <button onClick={onFocus}>
          <Crosshair />
          Focus connections
        </button>
        {placed && (
          <button
            aria-label="Release node position"
            title="Release node position"
            onClick={onRelease}
          >
            <PinOff />
          </button>
        )}
      </div>
      {related.size > 0 ? (
        <ul>
          {nodes
            .filter((item) => related.has(item.id))
            .slice(0, 5)
            .map((item) => (
              <li key={item.id}>
                <button onClick={() => onOpen(item)}>
                  {item.kind === 'database' ? <Database /> : <FileText />}
                  <span>{item.title}</span>
                  <small>
                    {incoming.some((edge) => edge.source === item.id) &&
                    outgoing.some((edge) => edge.target === item.id)
                      ? 'Both'
                      : incoming.some((edge) => edge.source === item.id)
                        ? 'Incoming'
                        : 'Outgoing'}
                  </small>
                </button>
              </li>
            ))}
        </ul>
      ) : (
        <p>No links yet. Link this page from another note to connect it.</p>
      )}
      {related.size > 5 && <p>{related.size - 5} more · Focus connections to explore</p>}
    </aside>
  );
}
