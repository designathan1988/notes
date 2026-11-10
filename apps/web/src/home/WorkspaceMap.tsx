import { t, formatNumber } from '../i18n/index.js';
import type { GraphData, PageKind } from '@note/contracts';
import { useEffect } from 'react';
import { useWorkspace } from '../state/store.js';

const W = 300,
  H = 200,
  CX = 150,
  CY = 98;

/** A small, real picture of the workspace graph: the most connected page and its neighbours. */
export function layoutMap(graph: GraphData) {
  const degree = new Map<string, number>();
  for (const edge of graph.edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  const hub = [...graph.nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))[0];
  if (!hub || !degree.get(hub.id)) return null;
  const neighbourIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.source === hub.id) neighbourIds.add(edge.target);
    if (edge.target === hub.id) neighbourIds.add(edge.source);
  }
  const neighbours = graph.nodes.filter((node) => neighbourIds.has(node.id)).slice(0, 8);
  const placed = neighbours.map((node, index) => {
    const angle = -Math.PI / 2 + (index / neighbours.length) * Math.PI * 2;
    return { ...node, x: CX + Math.cos(angle) * 108, y: CY + Math.sin(angle) * 68 };
  });
  // Pages without any link are shown as faint points on a wider ring: counted, not hidden.
  const loose = graph.nodes.filter((node) => !degree.get(node.id)).slice(0, 14);
  const scattered = loose.map((node, index) => {
    const angle = index * 2.399963;
    const radius = 0.86 + ((index * 37) % 13) / 100;
    return {
      ...node,
      x: CX + Math.cos(angle) * 140 * radius,
      y: CY + Math.sin(angle) * 92 * radius,
    };
  });
  const looseCount = graph.nodes.length - degree.size;
  return { hub, placed, scattered, looseCount };
}

const fill: Record<PageKind, string> = {
  document: 'var(--map-document)',
  database: 'var(--map-database)',
  canvas: 'var(--map-canvas)',
  record: 'var(--map-record)',
};

export function WorkspaceMap() {
  const workspaceId = useWorkspace((state) => state.workspaceId);
  const version = useWorkspace((state) => state.knowledgeVersion);
  const graph = useWorkspace((state) => state.graphs[`${state.workspaceId}:all`]);
  const loadGraph = useWorkspace((state) => state.loadGraph);
  const navigate = useWorkspace((state) => state.navigate);
  useEffect(() => {
    if (workspaceId) void loadGraph().catch(() => {});
  }, [workspaceId, version, loadGraph]);
  const map = graph ? layoutMap(graph) : null;
  return (
    <div className="workspace-map">
      {map ? (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={t('{{title}} and {{count}} connected pages', {
            title: map.hub.title || t('Untitled'),
            count: formatNumber(map.placed.length),
          })}
        >
          <defs>
            <filter id="workspace-map-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          {map.scattered.map((node) => (
            <circle key={node.id} cx={node.x} cy={node.y} r={2.4} className="map-loose" />
          ))}
          {map.placed.map((node) => (
            <line key={node.id} x1={CX} y1={CY} x2={node.x} y2={node.y} className="map-edge" />
          ))}
          <circle
            cx={CX}
            cy={CY}
            r={13}
            fill={fill[map.hub.kind]}
            opacity={0.75}
            filter="url(#workspace-map-glow)"
          />
          <circle cx={CX} cy={CY} r={6.5} fill={fill[map.hub.kind]} />
          {map.placed.map((node) => (
            <circle key={node.id} cx={node.x} cy={node.y} r={4} fill={fill[node.kind]} />
          ))}
          <text x={CX} y={CY + 22} textAnchor="middle" className="map-hub-label">
            {map.hub.title || t('Untitled')}
          </text>
        </svg>
      ) : (
        <p className="workspace-map-empty">
          {graph ? t('Link pages with @ or [[ to see how they connect.') : t('Opening graph…')}
        </p>
      )}
      <footer>
        <span>{t('{{count}} pages', { count: formatNumber(graph?.nodes.length ?? 0) })}</span>
        <span>{t('{{count}} links', { count: formatNumber(graph?.edges.length ?? 0) })}</span>
        {map && map.looseCount > 0 && (
          <span>{t('{{count}} unlinked', { count: formatNumber(map.looseCount) })}</span>
        )}
      </footer>
      <button className="workspace-map-open" onClick={() => navigate(null, 'graph')}>
        <span className="sr-only">{t('Open knowledge graph')}</span>
      </button>
    </div>
  );
}
