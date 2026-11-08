import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import {
  MousePointer2,
  Hand,
  Spline,
  Plus,
  Link,
  Image,
  Group,
  ZoomIn,
  ZoomOut,
  Focus,
  GripVertical,
  Layers2,
} from 'lucide-react';
import { useCanvas } from './context.js';
import { IconButton } from '../ui/IconButton.js';
import { PageHeader } from '../workspace/PageHeader.js';
import { canvasConnection } from '../../../../packages/editor/src/canvas-geometry.js';
import { CanvasSelection } from './CanvasSelection.js';

const elementColor = (color: string) =>
  /^#[a-f0-9]{6}$/i.test(color) ? color : `var(--canvas-color-${color})`;
export function CanvasRootView() {
  const c = useCanvas(),
    { camera, size } = c.view;
  return (
    <NodeViewWrapper
      className="canvas-document"
      onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.defaultPrevented) return;
        if (c.key(event.nativeEvent)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <div
        className="canvas-toolbar"
        role="toolbar"
        aria-label="Canvas tools"
        contentEditable={false}
      >
        <PageHeader page={c.page} compact />
        <div className="canvas-tool-group">
          {(
            [
              ['select', MousePointer2, 'Select'],
              ['hand', Hand, 'Hand'],
              ['connect', Spline, 'Connect'],
            ] as const
          ).map(([tool, Icon, label]) => (
            <button
              key={tool}
              aria-label={label}
              aria-pressed={c.tool === tool}
              disabled={c.readOnly && tool === 'connect'}
              onClick={() => c.setTool(tool)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <button aria-label="Add note" disabled={c.readOnly} onClick={() => c.addNote()}>
          <Plus />
          <span>Note</span>
        </button>
        <button aria-label="Link page" disabled={c.readOnly} onClick={c.link}>
          <Link />
          <span>Link page</span>
        </button>
        <button aria-label="Add media" disabled={c.readOnly} onClick={c.media}>
          <Image />
          <span>Media</span>
        </button>
        <button
          aria-label="Group selection"
          disabled={c.readOnly || !c.selected.length}
          onClick={c.group}
        >
          <Group />
          <span>Group</span>
        </button>
      </div>
      <div
        className="canvas-stage"
        data-tool={c.space ? 'hand' : c.tool}
        ref={c.view.attach}
        onPointerDown={(event) => {
          if (!(event.target as Element).closest('[data-spatial-control],button,input,textarea')) {
            event.preventDefault();
            if (!(event.target as Element).closest('[data-canvas-element]')) c.focusStage();
          }
          c.view.handlers.onPointerDown(event);
        }}
        onPointerMove={c.view.handlers.onPointerMove}
        onPointerUp={c.view.handlers.onPointerUp}
        onPointerCancel={c.view.handlers.onPointerCancel}
        onLostPointerCapture={c.view.handlers.onLostPointerCapture}
        onDoubleClick={(event) => {
          if (!(event.target as Element).closest('[data-canvas-element], [data-spatial-control]')) {
            const box = event.currentTarget.getBoundingClientRect();
            c.addNote(c.view.toWorld({ x: event.clientX - box.left, y: event.clientY - box.top }));
          }
        }}
      >
        <div
          className="canvas-keyboard-target"
          data-canvas-focus
          tabIndex={0}
          aria-label="Canvas stage"
          role="application"
          aria-owns={`canvas-world-${c.page.id}`}
          contentEditable={false}
        />
        <div
          className="canvas-world"
          id={`canvas-world-${c.page.id}`}
          style={
            {
              transform: `translate(${size.width / 2 - camera.x * camera.zoom}px,${size.height / 2 - camera.y * camera.zoom}px) scale(${camera.zoom})`,
              '--canvas-zoom': camera.zoom,
              '--canvas-label-layer':
                20 + Math.max(0, ...c.items.map((item) => Number(item.node.attrs.z) || 0)),
            } as React.CSSProperties
          }
        >
          <svg className="canvas-connections" aria-label="Canvas connections">
            {c.items
              .filter((item) => item.node.type.name === 'canvasEdge')
              .map((item) => {
                const a = c.box(item.node.attrs.fromNode),
                  b = c.box(item.node.attrs.toNode);
                if (!a || !b) return null;
                const marker = `canvas-${c.page.id}-${item.id}`;
                return (
                  <g key={item.id} style={{ color: elementColor(item.node.attrs.color) }}>
                    <defs>
                      {(['start', 'end'] as const).map((end) => (
                        <marker
                          key={end}
                          id={`${marker}-${end}`}
                          viewBox="0 -4 8 8"
                          refX="8"
                          markerWidth={8 / camera.zoom}
                          markerHeight={8 / camera.zoom}
                          orient="auto-start-reverse"
                          markerUnits="userSpaceOnUse"
                        >
                          <path d="M0,-3L8,0L0,3Z" fill="currentColor" />
                        </marker>
                      ))}
                    </defs>
                    <path
                      key={item.id}
                      data-canvas-connection={item.id}
                      data-spatial-control
                      className={c.selected.includes(item.id) ? 'selected' : ''}
                      d={
                        canvasConnection(a, b, {
                          fromSide: item.node.attrs.fromSide,
                          toSide: item.node.attrs.toSide,
                          self: item.node.attrs.fromNode === item.node.attrs.toNode,
                        }).path
                      }
                      markerStart={
                        item.node.attrs.fromEnd === 'arrow' ? `url(#${marker}-start)` : undefined
                      }
                      markerEnd={
                        item.node.attrs.toEnd === 'arrow' ? `url(#${marker}-end)` : undefined
                      }
                      vectorEffect="non-scaling-stroke"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        c.select(item.id, event.shiftKey);
                      }}
                    />
                  </g>
                );
              })}
            {c.connection && c.box(c.connection.source) && (
              <path
                className="canvas-connection-draft"
                d={
                  canvasConnection(c.box(c.connection.source)!, {
                    ...c.connection.point,
                    width: 0,
                    height: 0,
                  }).path
                }
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          <NodeViewContent className="canvas-items" />
          {c.marquee && (
            <div
              className="canvas-marquee"
              style={{
                left: Math.min(c.marquee.start.x, c.marquee.current.x),
                top: Math.min(c.marquee.start.y, c.marquee.current.y),
                width: Math.abs(c.marquee.start.x - c.marquee.current.x),
                height: Math.abs(c.marquee.start.y - c.marquee.current.y),
              }}
            />
          )}
        </div>
        {!c.items.length && (
          <div className="canvas-empty" contentEditable={false} data-spatial-control>
            <h2>Make room for your ideas.</h2>
            <p>Add a note, connect a page, or paste something here.</p>
            <button className="button" disabled={c.readOnly} onClick={() => c.addNote()}>
              Add your first note
            </button>
          </div>
        )}
        <CanvasSelection />
        <div className="canvas-zoom" contentEditable={false} data-spatial-control>
          <IconButton label="Zoom out canvas" onClick={() => c.view.zoom(1 / 1.2)}>
            <ZoomOut />
          </IconButton>
          <output aria-label="Canvas zoom">{Math.round(camera.zoom * 100)}%</output>
          <IconButton label="Zoom in canvas" onClick={() => c.view.zoom(1.2)}>
            <ZoomIn />
          </IconButton>
          <IconButton label="Fit canvas" onClick={() => c.view.fit()}>
            <Focus />
          </IconButton>
        </div>
        <p className="canvas-help" contentEditable={false}>
          Double-click to add a note · Space to pan
        </p>
      </div>
    </NodeViewWrapper>
  );
}
export function CanvasCardView({ node }: NodeViewProps) {
  const c = useCanvas(),
    id = String(node.attrs.id),
    box = c.box(id) ?? {
      x: node.attrs.x,
      y: node.attrs.y,
      width: node.attrs.width,
      height: node.attrs.height,
    };
  return (
    <NodeViewWrapper
      data-canvas-card={id}
      data-canvas-element={id}
      data-selected={c.selected.includes(id) || undefined}
      data-canvas-colored={node.attrs.color !== 'neutral' || undefined}
      className="canvas-card"
      style={
        {
          left: box.x,
          top: box.y,
          width: box.width,
          height: box.height,
          zIndex: 10 + Number(node.attrs.z),
          '--canvas-item-color': elementColor(node.attrs.color),
        } as React.CSSProperties
      }
    >
      <span
        className="canvas-move"
        role="button"
        tabIndex={c.readOnly ? -1 : 0}
        aria-label="Move note"
        aria-disabled={c.readOnly}
        contentEditable={false}
        data-spatial-item={!c.readOnly && c.tool === 'select' && !c.space ? id : undefined}
        onPointerDown={(event) => {
          event.currentTarget.focus();
          c.gesture(id, event);
        }}
      >
        <GripVertical />
      </span>
      <NodeViewContent
        className="canvas-card-rich note-editor"
        tabIndex={c.readOnly ? 0 : undefined}
        data-canvas-rich
        data-spatial-control
        role="textbox"
        aria-label="Note content"
        contentEditable={c.readOnly ? false : undefined}
        aria-readonly={c.readOnly}
        aria-multiline="true"
        onPointerDown={() => c.select(id, false, false)}
      />
      {c.selected.includes(id) && !c.readOnly && (
        <span
          className="canvas-resize"
          role="button"
          tabIndex={0}
          aria-label="Resize note"
          contentEditable={false}
          data-spatial-control
          onPointerDown={(event) => c.gesture(id, event, true)}
        />
      )}
    </NodeViewWrapper>
  );
}
export function CanvasGroupView({ node }: NodeViewProps) {
  const c = useCanvas(),
    id = String(node.attrs.id),
    box = c.box(id);
  if (!box) return null;
  return (
    <NodeViewWrapper
      data-canvas-group={id}
      data-canvas-element={id}
      data-selected={c.selected.includes(id) || undefined}
      className="canvas-group"
      data-canvas-colored={node.attrs.color !== 'neutral' || undefined}
      style={
        {
          left: box.x,
          top: box.y,
          width: box.width,
          height: box.height,
          '--canvas-item-color': elementColor(node.attrs.color),
        } as React.CSSProperties
      }
    >
      <div className="canvas-group-heading">
        <span
          role="button"
          tabIndex={c.readOnly ? -1 : 0}
          aria-label="Move group"
          aria-disabled={c.readOnly}
          contentEditable={false}
          className="canvas-group-move"
          data-spatial-item={!c.readOnly && c.tool === 'select' && !c.space ? id : undefined}
          onPointerDown={(event) => {
            event.currentTarget.focus();
            c.gesture(id, event);
          }}
        >
          <GripVertical />
        </span>
        <NodeViewContent
          data-canvas-rich
          tabIndex={c.readOnly ? 0 : undefined}
          data-spatial-control
          role="textbox"
          aria-label="Group name"
          contentEditable={c.readOnly ? false : undefined}
          aria-readonly={c.readOnly}
        />
      </div>
    </NodeViewWrapper>
  );
}
export function CanvasEdgeView({ node }: NodeViewProps) {
  const c = useCanvas(),
    a = c.box(node.attrs.fromNode),
    b = c.box(node.attrs.toNode);
  if (!a || !b) return null;
  const label = canvasConnection(a, b, {
    fromSide: node.attrs.fromSide,
    toSide: node.attrs.toSide,
    self: node.attrs.fromNode === node.attrs.toNode,
    label: node.textContent,
  }).label;
  return (
    <NodeViewWrapper
      data-canvas-edge={node.attrs.id}
      className={`canvas-edge-label${c.selected.includes(node.attrs.id) ? ' selected' : ''}`}
      style={{ left: label.x, top: label.y }}
    >
      <NodeViewContent
        data-canvas-rich
        tabIndex={c.readOnly ? 0 : undefined}
        data-spatial-control
        role="textbox"
        aria-label="Connection label"
        contentEditable={c.readOnly ? false : undefined}
        aria-readonly={c.readOnly}
        onPointerDown={() => c.select(node.attrs.id)}
      />
    </NodeViewWrapper>
  );
}
