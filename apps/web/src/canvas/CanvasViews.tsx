import { t, useLocale } from '../i18n/index.js';
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
} from 'lucide-react';
import { useCanvas } from './context.js';
import { IconButton } from '../ui/IconButton.js';
import { PageHeader } from '../workspace/PageHeader.js';
import { canvasConnection } from '@note/editor/canvas-geometry';
import { CanvasSelection } from './CanvasSelection.js';
import { CanvasConnections, canvasElementColor as elementColor } from './CanvasConnections.js';
export function CanvasRootView() {
  useLocale();
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
      {/* The board's title and hint sit on the stage; the tools float at the bottom. */}
      <div className="canvas-heading" contentEditable={false} data-spatial-control>
        <PageHeader page={c.page} compact />
        <p className="canvas-help">{t('Double-click to add a note · Space to pan')}</p>
      </div>
      <div
        className="canvas-toolbar"
        role="toolbar"
        aria-label={t('Canvas tools')}
        contentEditable={false}
      >
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
              aria-label={t(label)}
              title={t(label)}
              aria-pressed={c.tool === tool}
              disabled={c.readOnly && tool === 'connect'}
              onClick={() => c.setTool(tool)}
            >
              <Icon />
              <span>{t(label)}</span>
            </button>
          ))}
        </div>
        <button
          aria-label={t('Add note')}
          title={t('Add note')}
          disabled={c.readOnly}
          onClick={() => c.addNote()}
        >
          <Plus />
          <span>{t('Note')}</span>
        </button>
        <button
          aria-label={t('Link page')}
          title={t('Link page')}
          disabled={c.readOnly}
          onClick={c.link}
        >
          <Link />
          <span>{t('Link page')}</span>
        </button>
        <button
          aria-label={t('Add media')}
          title={t('Add media')}
          disabled={c.readOnly}
          onClick={c.media}
        >
          <Image />
          <span>{t('Media')}</span>
        </button>
        <button
          aria-label={t('Group selection')}
          title={t('Group selection')}
          disabled={c.readOnly || !c.selected.length}
          onClick={c.group}
        >
          <Group />
          <span>{t('Group')}</span>
        </button>
      </div>
      <div
        className="canvas-stage"
        data-tool={c.space ? 'hand' : c.tool}
        ref={c.view.attach}
        onPasteCapture={(event) => {
          if (
            c.readOnly ||
            (event.target as Element).closest('[data-canvas-rich],input,textarea,select')
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          c.capture({
            text: event.clipboardData.getData('text/plain'),
            html: event.clipboardData.getData('text/html'),
            files: [...event.clipboardData.files],
          });
        }}
        onDragOver={(event) => {
          if (!c.readOnly && !(event.target as Element).closest('[data-canvas-rich]'))
            event.preventDefault();
        }}
        onDropCapture={(event) => {
          if (
            c.readOnly ||
            (event.target as Element).closest('[data-canvas-rich],input,textarea,select')
          )
            return;
          const input = {
            text:
              event.dataTransfer.getData('text/plain') ||
              event.dataTransfer.getData('text/uri-list'),
            html: event.dataTransfer.getData('text/html'),
            files: [...event.dataTransfer.files],
          };
          if (!input.text && !input.html && !input.files.length) return;
          event.preventDefault();
          event.stopPropagation();
          const bounds = event.currentTarget.getBoundingClientRect();
          c.capture(
            input,
            c.view.toWorld({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }),
          );
        }}
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
          aria-label={t('Canvas stage')}
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
          <CanvasConnections
            items={c.items}
            box={c.box}
            zoom={camera.zoom}
            scope={c.page.id}
            selected={c.selected}
            draft={c.connection}
            select={(id, event) => {
              event.stopPropagation();
              event.preventDefault();
              c.select(id, event.shiftKey);
            }}
          />
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
            <h2>{t('Make room for your ideas.')}</h2>
            <p>{t('Add a note, connect a page, or paste something here.')}</p>
            <button className="button" disabled={c.readOnly} onClick={() => c.addNote()}>
              {t('Add your first note')}
            </button>
          </div>
        )}
        <CanvasSelection />
        <div className="canvas-zoom" contentEditable={false} data-spatial-control>
          <IconButton label={t('Zoom out canvas')} onClick={() => c.view.zoom(1 / 1.2)}>
            <ZoomOut />
          </IconButton>
          <output aria-label={t('Canvas zoom')}>{Math.round(camera.zoom * 100)}%</output>
          <IconButton label={t('Zoom in canvas')} onClick={() => c.view.zoom(1.2)}>
            <ZoomIn />
          </IconButton>
          <IconButton label={t('Fit canvas')} onClick={() => c.view.fit()}>
            <Focus />
          </IconButton>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
export function CanvasCardView({ node }: NodeViewProps) {
  useLocale();
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
        aria-label={t('Move note')}
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
        aria-label={t('Note content')}
        contentEditable={c.readOnly ? false : undefined}
        aria-readonly={c.readOnly}
        aria-multiline="true"
        onPointerDown={(event) => {
          // With the Connect tool the whole note is the connection source, not just its grip.
          if (c.tool === 'connect' && !c.readOnly) c.gesture(id, event);
          else c.select(id, false, false);
        }}
      />
      {c.selected.includes(id) && !c.readOnly && (
        <span
          className="canvas-resize"
          role="button"
          tabIndex={0}
          aria-label={t('Resize note')}
          title={t('Drag to resize. Arrow keys resize; Shift uses larger steps.')}
          contentEditable={false}
          data-spatial-control
          onPointerDown={(event) => c.gesture(id, event, true)}
        />
      )}
    </NodeViewWrapper>
  );
}
export function CanvasGroupView({ node }: NodeViewProps) {
  useLocale();
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
          aria-label={t('Move group')}
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
          aria-label={t('Group name')}
          contentEditable={c.readOnly ? false : undefined}
          aria-readonly={c.readOnly}
        />
      </div>
      {c.selected.includes(id) && !c.readOnly && (
        <span
          className="canvas-resize"
          role="button"
          tabIndex={0}
          aria-label={t('Resize group')}
          title={t('Drag to resize. Arrow keys resize; Shift uses larger steps.')}
          contentEditable={false}
          data-spatial-control
          onPointerDown={(event) => c.gesture(id, event, true)}
        />
      )}
    </NodeViewWrapper>
  );
}
export function CanvasEdgeView({ node }: NodeViewProps) {
  useLocale();
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
      data-empty={node.textContent ? undefined : ''}
      className={`canvas-edge-label${c.selected.includes(node.attrs.id) ? ' selected' : ''}`}
      style={{ left: label.x, top: label.y }}
    >
      <NodeViewContent
        data-canvas-rich
        tabIndex={c.readOnly ? 0 : undefined}
        data-spatial-control
        role="textbox"
        aria-label={t('Connection label')}
        contentEditable={c.readOnly ? false : undefined}
        aria-readonly={c.readOnly}
        onPointerDown={() => c.select(node.attrs.id)}
      />
    </NodeViewWrapper>
  );
}
