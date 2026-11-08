import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { ZoomIn, ZoomOut, Focus, Search, RotateCcw } from 'lucide-react';
import type { GraphData } from '@note/contracts';
import { useWorkspace } from '../state/store.js';
import { IconButton } from '../ui/IconButton.js';
import { useGraphLayout } from './useGraphLayout.js';
import { GraphInspector } from './GraphInspector.js';
import { useSpatialView } from '../spatial/useSpatialView.js';
import { graphLabels } from './labels.js';

export default function Graph() {
  const workspace = useWorkspace((state) => state.workspaceId);
  const selected = useWorkspace((state) => state.selectedId);
  const load = useWorkspace((state) => state.loadGraph);
  const version = useWorkspace((state) => state.knowledgeVersion);
  const [local, setLocal] = useState(false);
  const [localId, setLocalId] = useState<string | null>(null);
  const center = local ? (localId ?? selected ?? undefined) : undefined;
  const data = useWorkspace((state) => state.graphs[`${workspace}:${center ?? 'all'}`]);
  useEffect(() => {
    let current = true;
    void load(center).catch((error) => {
      if (!current) return;
      if (center) {
        setLocal(false);
        setLocalId(null);
      }
      useWorkspace.getState().setError(error);
    });
    return () => {
      current = false;
    };
  }, [workspace, center, load, version]);
  return (
    <GraphSurface
      key={`${workspace}:${center ?? 'all'}`}
      data={data}
      center={center}
      selected={selected}
      onLocal={(value) => {
        setLocalId(selected);
        setLocal(value);
      }}
      local={local}
      onFocusNode={(id) => {
        setLocalId(id);
        setLocal(true);
      }}
    />
  );
}

function GraphSurface({
  data,
  center,
  selected,
  local,
  onLocal,
  onFocusNode,
}: {
  data?: GraphData;
  center?: string;
  selected: string | null;
  local: boolean;
  onLocal(value: boolean): void;
  onFocusNode(id: string): void;
}) {
  const placements = useWorkspace((state) => state.graphPlacements);
  const viewKey = center ?? 'all';
  const saved = useWorkspace((state) => state.graphCameras[viewKey]);
  const [filter, setFilter] = useState(''),
    [hideUnlinked, setHideUnlinked] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const layout = useGraphLayout(data),
    base = layout.positions;
  const links = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of data?.edges ?? []) {
      if (!map.has(edge.source)) map.set(edge.source, new Set());
      if (!map.has(edge.target)) map.set(edge.target, new Set());
      map.get(edge.source)!.add(edge.target);
      map.get(edge.target)!.add(edge.source);
    }
    return map;
  }, [data]);
  const nodes = (data?.nodes ?? []).filter(
    (node) =>
      node.title.toLocaleLowerCase().includes(filter.toLocaleLowerCase()) &&
      (!hideUnlinked || links.has(node.id)),
  );
  const positions = Object.fromEntries(
    nodes
      .filter((node) => base[node.id])
      .map((node) => [node.id, placements[node.id] ?? base[node.id]]),
  );
  const visible = new Set(nodes.map((node) => node.id));
  const edges =
    data?.edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target)) ?? [];
  const active =
    nodes.find((node) => node.id === focused) ?? nodes.find((node) => node.id === selected);
  const neighbors = active ? (links.get(active.id) ?? new Set<string>()) : new Set<string>();
  const spatial = useSpatialView({
    saved,
    points: Object.values(positions),
    itemPosition: (id) => positions[id],
    commitItem: (id, point) => {
      if (visible.has(id)) useWorkspace.getState().placeGraphNode(id, point);
    },
    commitCamera: (camera) => useWorkspace.getState().setGraphCamera(viewKey, camera),
  });
  const { camera, size, draft } = spatial;
  const at = (id: string) => (draft?.id === id ? draft.point : positions[id]);
  const labelIds = graphLabels(
    nodes
      .filter(
        (node) =>
          !!at(node.id) &&
          (camera.zoom >= 0.55 ||
            nodes.length <= 12 ||
            !!filter ||
            node.id === active?.id ||
            neighbors.has(node.id)),
      )
      .map((node) => ({
        ...node,
        ...at(node.id),
        priority: node.id === active?.id ? 0 : neighbors.has(node.id) ? 1 : 2,
      })),
    camera,
    size,
  );
  const open = (node: GraphData['nodes'][number], newTab = false) => {
    const state = useWorkspace.getState(),
      view = node.kind === 'database' ? 'database' : 'document';
    if (newTab) state.openTab(node.id, view);
    else state.navigate(node.id, view);
  };
  const moveKey = (event: KeyboardEvent<SVGGElement>, id: string) => {
    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    event.stopPropagation();
    const point = at(id),
      step = event.shiftKey ? 80 : 20;
    if (point)
      useWorkspace
        .getState()
        .placeGraphNode(id, { x: point.x + direction[0] * step, y: point.y + direction[1] * step });
  };
  return (
    <section className="graph-screen" aria-label="Knowledge graph">
      <header className="graph-toolbar">
        <h1>Knowledge graph</h1>
        <label className="graph-search">
          <Search />
          <input
            aria-label="Filter graph"
            placeholder="Find a page…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
        <div className="graph-filters">
          <label className="graph-mode">
            <input
              type="checkbox"
              disabled={!selected && !local}
              checked={local}
              onChange={(event) => onLocal(event.target.checked)}
            />
            Local graph
          </label>
          <label className="graph-mode">
            <input
              type="checkbox"
              checked={hideUnlinked}
              onChange={(event) => setHideUnlinked(event.target.checked)}
            />
            Hide unlinked
          </label>
        </div>
      </header>
      <div
        className="graph-canvas"
        ref={spatial.ref}
        {...spatial.handlers}
        data-dragging={spatial.dragging || undefined}
        onClickCapture={(event) => {
          if ((event.target as Element).closest('[data-spatial-item]') && spatial.suppressClick()) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <svg
          viewBox={`0 0 ${Math.max(1, size.width)} ${Math.max(1, size.height)}`}
          role="img"
          aria-label="Workspace knowledge graph"
          tabIndex={0}
          aria-describedby="graph-help"
          data-camera-x={camera.x}
          data-camera-y={camera.y}
          data-zoom={camera.zoom}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === '+' || event.key === '=') {
              event.preventDefault();
              spatial.zoom(1.2);
            }
            if (event.key === '-') {
              event.preventDefault();
              spatial.zoom(1 / 1.2);
            }
            if (event.key === 'Home') {
              event.preventDefault();
              spatial.fit();
            }
            const delta = {
              ArrowLeft: [-1, 0],
              ArrowRight: [1, 0],
              ArrowUp: [0, -1],
              ArrowDown: [0, 1],
            }[event.key];
            if (delta) {
              event.preventDefault();
              const step = (event.shiftKey ? 160 : 50) / camera.zoom;
              spatial.changeCamera({
                ...camera,
                x: camera.x + delta[0] * step,
                y: camera.y + delta[1] * step,
              });
            }
          }}
        >
          <defs>
            <marker
              id="graph-arrow"
              viewBox="0 -4 8 8"
              refX="8"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path d="M0,-3L7,0L0,3" />
            </marker>
          </defs>
          <g
            transform={`translate(${size.width / 2} ${size.height / 2}) scale(${camera.zoom}) translate(${-camera.x} ${-camera.y})`}
          >
            {edges.map((edge) => {
              const source = at(edge.source),
                target = at(edge.target);
              if (!source || !target) return null;
              const dx = target.x - source.x,
                dy = target.y - source.y,
                length = Math.hypot(dx, dy) || 1,
                gap = 15 / camera.zoom;
              const d =
                edge.source === edge.target
                  ? `M${source.x - 4},${source.y - 5} C${source.x - 65},${source.y - 65} ${source.x + 65},${source.y - 65} ${source.x + 8},${source.y - 8}`
                  : `M${source.x + (dx / length) * gap},${source.y + (dy / length) * gap} L${target.x - (dx / length) * gap},${target.y - (dy / length) * gap}`;
              return (
                <path
                  key={`${edge.source}:${edge.target}`}
                  className="graph-edge"
                  data-active={
                    (!!active && (active.id === edge.source || active.id === edge.target)) ||
                    undefined
                  }
                  d={d}
                  markerEnd="url(#graph-arrow)"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {nodes.map((node) => {
              const point = at(node.id);
              if (!point) return null;
              const degree = links.get(node.id)?.size ?? 0,
                chosen = node.id === active?.id;
              const labelOffset = labelIds.get(node.id) ?? 25;
              return (
                <g
                  key={node.id}
                  data-node={node.id}
                  data-spatial-item={node.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open ${node.title}`}
                  aria-describedby="graph-help"
                  className="graph-point"
                  data-active={chosen || undefined}
                  data-related={neighbors.has(node.id) || undefined}
                  data-muted={(!!active && !chosen && !neighbors.has(node.id)) || undefined}
                  data-label={labelIds.has(node.id) || undefined}
                  onPointerEnter={() => {
                    if (!spatial.dragging) {
                      if (focused !== node.id) setInspectorOpen(true);
                      setFocused(node.id);
                    }
                  }}
                  onFocus={() => {
                    setFocused(node.id);
                    setInspectorOpen(true);
                  }}
                  onClick={(event) => {
                    if (!spatial.suppressClick()) open(node, event.ctrlKey || event.metaKey);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      open(node, event.ctrlKey || event.metaKey);
                    } else if (event.key === 'Escape') {
                      event.preventDefault();
                      setFocused(null);
                      event.currentTarget.ownerSVGElement?.focus();
                    } else moveKey(event, node.id);
                  }}
                >
                  <rect
                    x={point.x - 26 / camera.zoom}
                    y={point.y - 22 / camera.zoom}
                    width={52 / camera.zoom}
                    height={56 / camera.zoom}
                    className="graph-hit"
                  />
                  <title>{node.title}</title>
                  {labelIds.has(node.id) && labelOffset !== 25 && (
                    <line
                      className="graph-label-leader"
                      x1={point.x}
                      x2={point.x}
                      y1={point.y + (labelOffset > 0 ? 12 : -12) / camera.zoom}
                      y2={
                        point.y +
                        (labelOffset > 0 ? labelOffset - 14 : labelOffset + 6) / camera.zoom
                      }
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={(chosen ? 10 : 6 + Math.min(4, Math.sqrt(degree))) / camera.zoom}
                    vectorEffect="non-scaling-stroke"
                  />
                  {labelIds.has(node.id) && (
                    <rect
                      className="graph-label-hit"
                      x={point.x - (Math.min(28, node.title.length) * 7 + 8) / 2 / camera.zoom}
                      y={point.y + (labelOffset - 13) / camera.zoom}
                      width={(Math.min(28, node.title.length) * 7 + 8) / camera.zoom}
                      height={18 / camera.zoom}
                    />
                  )}
                  <text
                    x={point.x}
                    y={point.y + labelOffset / camera.zoom}
                    textAnchor="middle"
                    style={{ fontSize: 12 / camera.zoom }}
                  >
                    {node.title.length > 28 ? node.title.slice(0, 26) + '…' : node.title}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        {(!data || (layout.pending && !Object.keys(positions).length)) && (
          <p className="graph-empty" role="status">
            Loading graph…
          </p>
        )}
        {data && layout.error && (
          <div className="graph-empty" role="alert">
            <p>Graph layout could not be loaded.</p>
            <button className="button" onClick={layout.retry}>
              Retry graph layout
            </button>
          </div>
        )}
        {data && !nodes.length && <p className="graph-empty">No pages match this view.</p>}
        {active && inspectorOpen && (
          <GraphInspector
            node={active}
            nodes={data?.nodes ?? []}
            edges={data?.edges ?? []}
            placed={!!placements[active.id]}
            onOpen={(node) => open(node)}
            onFocus={() => {
              setFocused(null);
              if (center !== active.id) onFocusNode(active.id);
              else spatial.fit();
            }}
            onRelease={() => useWorkspace.getState().placeGraphNode(active.id, null)}
            onClose={() => {
              setInspectorOpen(false);
              spatial.ref.current?.querySelector('svg')?.focus();
            }}
          />
        )}
        <div className="graph-controls" data-spatial-control>
          <IconButton label="Zoom out" onClick={() => spatial.zoom(1 / 1.2)}>
            <ZoomOut />
          </IconButton>
          <output aria-label="Graph zoom">{Math.round(camera.zoom * 100)}%</output>
          <IconButton label="Zoom in" onClick={() => spatial.zoom(1.2)}>
            <ZoomIn />
          </IconButton>
          <IconButton label="Reset graph view" onClick={() => spatial.fit()}>
            <Focus />
          </IconButton>
          {Object.keys(placements).length > 0 && (
            <IconButton
              label="Reset all graph positions"
              onClick={() => {
                useWorkspace.getState().resetGraphPositions();
                spatial.fit(Object.values(base));
              }}
            >
              <RotateCcw />
            </IconButton>
          )}
        </div>
      </div>
      <footer>
        <span>
          {nodes.length} pages · {edges.length} connections
          {data?.truncated ? ' · Limited view' : ''}
        </span>
        <span id="graph-help">
          Drag nodes or background · Scroll to zoom · Enter to open · Arrow keys to move
        </span>
      </footer>
    </section>
  );
}
