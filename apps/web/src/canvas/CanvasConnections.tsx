import type { PointerEvent } from 'react';
import {
  canvasConnection,
  type CanvasBox,
} from '../../../../packages/editor/src/canvas-geometry.js';
import type { CanvasItem } from '../../../../packages/editor/src/canvas-commands.js';
import type { Point } from '../spatial/geometry.js';

export const canvasElementColor = (color: string) =>
  /^#[a-f0-9]{6}$/i.test(color) ? color : `var(--canvas-color-${color})`;

/** Shared presentation for live and immutable scenes. Geometry remains schema-owned. */
export function CanvasConnections({
  items,
  box,
  zoom,
  scope,
  selected = [],
  select,
  draft,
}: {
  items: CanvasItem[];
  box(id: string): CanvasBox | undefined;
  zoom: number;
  scope: string;
  selected?: string[];
  select?(id: string, event: PointerEvent<SVGPathElement>): void;
  draft?: { source: string; point: Point } | null;
}) {
  return (
    <svg className="canvas-connections" aria-label="Canvas connections">
      {items
        .filter((item) => item.node.type.name === 'canvasEdge')
        .map((item) => {
          const attrs = item.node.attrs,
            a = box(attrs.fromNode),
            b = box(attrs.toNode);
          if (!a || !b) return null;
          const marker = `canvas-${scope}-${item.id}`;
          return (
            <g key={item.id} style={{ color: canvasElementColor(attrs.color) }}>
              <defs>
                {(['start', 'end'] as const).map((end) => (
                  <marker
                    key={end}
                    id={`${marker}-${end}`}
                    viewBox="0 -4 8 8"
                    refX="8"
                    markerWidth={8 / zoom}
                    markerHeight={8 / zoom}
                    orient="auto-start-reverse"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M0,-3L8,0L0,3Z" fill="currentColor" />
                  </marker>
                ))}
              </defs>
              <path
                data-canvas-connection={item.id}
                data-spatial-control={select ? '' : undefined}
                className={selected.includes(item.id) ? 'selected' : ''}
                d={
                  canvasConnection(a, b, {
                    fromSide: attrs.fromSide,
                    toSide: attrs.toSide,
                    self: attrs.fromNode === attrs.toNode,
                  }).path
                }
                markerStart={attrs.fromEnd === 'arrow' ? `url(#${marker}-start)` : undefined}
                markerEnd={attrs.toEnd === 'arrow' ? `url(#${marker}-end)` : undefined}
                vectorEffect="non-scaling-stroke"
                onPointerDown={select ? (event) => select(item.id, event) : undefined}
              />
            </g>
          );
        })}
      {draft && box(draft.source) && (
        <path
          className="canvas-connection-draft"
          d={canvasConnection(box(draft.source)!, { ...draft.point, width: 0, height: 0 }).path}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
