import { useId, useMemo, useState, type CSSProperties } from 'react';
import {
  EditorContent,
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  type NodeViewProps,
} from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Expand, Focus, ZoomIn, ZoomOut } from 'lucide-react';
import { editorExtensions } from '../../../../packages/editor/src/schema.js';
import { canvasItems } from '../../../../packages/editor/src/canvas-commands.js';
import {
  canvasRoot,
  canvasCard,
  canvasGroup,
  canvasEdge,
} from '../../../../packages/editor/src/canvas.js';
import {
  canvasConnection,
  type CanvasBox,
} from '../../../../packages/editor/src/canvas-geometry.js';
import { useSpatialView } from '../spatial/useSpatialView.js';
import { BlockSurface } from '../documents/BlockSurface.js';
import { IconButton } from '../ui/IconButton.js';
import { Dialog } from '../ui/Dialog.js';
import { CanvasConnections, canvasElementColor } from './CanvasConnections.js';

// Immutable document identity keys this disposable geometry projection, not another body.
const geometry = new WeakMap<ProseMirrorNode, ReadonlyMap<string, CanvasBox>>();
function snapshotBoxes(doc: ProseMirrorNode) {
  let boxes = geometry.get(doc);
  if (!boxes) {
    boxes = new Map(
      canvasItems(doc)
        .filter((item) => item.node.type.name !== 'canvasEdge')
        .map((item) => {
          const { x, y, width, height } = item.node.attrs;
          return [item.id, { x, y, width, height }];
        }),
    );
    geometry.set(doc, boxes);
  }
  return boxes;
}

/** Ephemeral camera only. A saved scene never attaches to a document session or store. */
function SavedRoot({ editor }: NodeViewProps) {
  const scope = useId().replace(/[^\w-]/g, ''),
    help = `${scope}-help`;
  const items = useMemo(() => canvasItems(editor.state.doc), [editor]);
  const boxes = useMemo(() => snapshotBoxes(editor.state.doc), [editor]);
  const points = useMemo(
    () =>
      [...boxes.values()].flatMap((box) => [
        { x: box.x, y: box.y - 20 },
        { x: box.x + box.width, y: box.y + box.height },
      ]),
    [boxes],
  );
  const view = useSpatialView({
    points,
    fitPadding: 24,
    commitCamera() {},
    commitItem() {},
    itemPosition: () => undefined,
    contentAt: (target) => target.closest<HTMLElement>('.canvas-card-rich'),
  });
  const { camera, size } = view;
  return (
    <NodeViewWrapper className="canvas-document canvas-snapshot">
      <div
        ref={view.attach}
        className="canvas-stage"
        data-tool="hand"
        role="application"
        aria-label="Saved canvas"
        aria-describedby={help}
        tabIndex={0}
        {...view.handlers}
        onPointerDown={(event) => {
          if (!(event.target as Element).closest('[data-canvas-rich],button,a,input'))
            event.currentTarget.focus();
          view.handlers.onPointerDown(event);
        }}
        onKeyDown={(event) => {
          if (
            event.target !== event.currentTarget ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey
          )
            return;
          const step = 48 / camera.zoom;
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
          };
          if (moves[event.key]) {
            const [x, y] = moves[event.key];
            view.changeCamera({ ...camera, x: camera.x + x, y: camera.y + y });
          } else if (event.key === '+' || event.key === '=') view.zoom(1.2);
          else if (event.key === '-') view.zoom(1 / 1.2);
          else if (event.key === 'Home' || event.key === '0') view.fit();
          else return;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <div
          className="canvas-world"
          style={
            {
              transform: `translate(${size.width / 2 - camera.x * camera.zoom}px,${size.height / 2 - camera.y * camera.zoom}px) scale(${camera.zoom})`,
              '--canvas-zoom': camera.zoom,
              '--canvas-label-layer':
                20 + Math.max(0, ...items.map((item) => Number(item.node.attrs.z) || 0)),
            } as CSSProperties
          }
        >
          <CanvasConnections
            items={items}
            box={(id) => boxes.get(id)}
            zoom={camera.zoom}
            scope={scope}
          />
          <NodeViewContent className="canvas-items" />
        </div>
        {!items.length && (
          <div className="canvas-empty">
            <p>This saved canvas is empty.</p>
          </div>
        )}
        <div className="canvas-zoom" data-spatial-control>
          <IconButton label="Zoom out saved canvas" onClick={() => view.zoom(1 / 1.2)}>
            <ZoomOut />
          </IconButton>
          <output aria-label="Saved canvas zoom">{Math.round(camera.zoom * 100)}%</output>
          <IconButton label="Zoom in saved canvas" onClick={() => view.zoom(1.2)}>
            <ZoomIn />
          </IconButton>
          <IconButton label="Fit saved canvas" onClick={() => view.fit()}>
            <Focus />
          </IconButton>
        </div>
        <p className="sr-only" id={help}>
          Read-only saved layout. Drag the background to pan. Use arrow keys to pan, plus and minus
          to zoom, and Home to fit. Note content can be selected and scrolled.
        </p>
      </div>
    </NodeViewWrapper>
  );
}

function SavedBox({ node }: NodeViewProps) {
  const attrs = node.attrs,
    group = node.type.name === 'canvasGroup';
  return (
    <NodeViewWrapper
      className={group ? 'canvas-group' : 'canvas-card'}
      {...(group ? { 'data-canvas-group': attrs.id } : { 'data-canvas-card': attrs.id })}
      data-canvas-colored={attrs.color !== 'neutral' || undefined}
      style={
        {
          left: attrs.x,
          top: attrs.y,
          width: attrs.width,
          height: attrs.height,
          ...(!group ? { zIndex: 10 + Number(attrs.z) } : {}),
          '--canvas-item-color': canvasElementColor(attrs.color),
        } as CSSProperties
      }
    >
      {group ? (
        <div className="canvas-group-heading">
          <NodeViewContent data-canvas-rich />
        </div>
      ) : (
        <NodeViewContent
          className="canvas-card-rich note-editor"
          data-canvas-rich
          data-spatial-control
          tabIndex={0}
          role="textbox"
          aria-label="Saved note content"
          aria-readonly="true"
          aria-multiline="true"
        />
      )}
    </NodeViewWrapper>
  );
}

function SavedEdge({ node, editor }: NodeViewProps) {
  const boxes = snapshotBoxes(editor.state.doc),
    a = boxes.get(node.attrs.fromNode),
    b = boxes.get(node.attrs.toNode);
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
      className="canvas-edge-label"
      style={{ left: label.x, top: label.y }}
    >
      <NodeViewContent data-canvas-rich />
    </NodeViewWrapper>
  );
}

function Snapshot({ content }: { content: JSONContent }) {
  const editor = useEditor(
    {
      extensions: [
        ...editorExtensions().filter(
          (extension) =>
            !['canvasRoot', 'canvasCard', 'canvasGroup', 'canvasEdge'].includes(extension.name),
        ),
        canvasRoot.extend({ addNodeView: () => ReactNodeViewRenderer(SavedRoot) }),
        canvasCard.extend({ addNodeView: () => ReactNodeViewRenderer(SavedBox) }),
        canvasGroup.extend({ addNodeView: () => ReactNodeViewRenderer(SavedBox) }),
        canvasEdge.extend({ addNodeView: () => ReactNodeViewRenderer(SavedEdge) }),
        BlockSurface,
      ],
      content,
      editable: false,
      editorProps: {
        attributes: { class: 'canvas-snapshot-editor', 'aria-label': 'Saved canvas content' },
      },
      onCreate: ({ editor }) =>
        editor.view.dom.querySelectorAll('input').forEach((input) => {
          input.disabled = true;
        }),
    },
    [content],
  );
  return (
    <div className="canvas-snapshot-host">
      <EditorContent editor={editor} />
    </div>
  );
}

export default function CanvasPreview({ content }: { content: JSONContent }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="version-canvas">
      <div className="canvas-preview-heading">
        <small>Saved canvas · Read only</small>
        <button className="text-button" onClick={() => setExpanded(true)}>
          <Expand size={14} />
          Expand canvas preview
        </button>
      </div>
      {expanded ? (
        <Dialog title="Canvas preview" wide onClose={() => setExpanded(false)}>
          <Snapshot content={content} />
        </Dialog>
      ) : (
        <Snapshot content={content} />
      )}
    </div>
  );
}
