import { t } from '../i18n/index.js';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, Plus } from 'lucide-react';
import { ySyncPluginKey } from '@tiptap/y-tiptap';
import type { Editor } from '@tiptap/react';
import { blockAt, moveBlockTo } from '@note/editor/blocks';
import { blocksInRange, moveBlocksTo } from '@note/editor/block-selection';

type Hover = { from: number; left: number; top: number };
type Drop = { position: number; left: number; top: number; width: number };
type Gesture = {
  pointer: number;
  x: number;
  y: number;
  active: boolean;
  source: unknown;
  fallback: number;
  target: Drop | null;
  label: string;
};
export function BlockGutter({
  editor,
  insert,
  actions,
}: {
  editor: Editor;
  insert(position: number, target: HTMLElement): void;
  actions(position: number, target: HTMLElement): void;
}) {
  const [hover, setHover] = useState<Hover | null>(null);
  const [preview, setPreview] = useState<{
    x: number;
    y: number;
    label: string;
    drop: Drop | null;
  } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => {
    const root = editor.view.dom;
    const locate = (element: Node) => {
      let found: number | null = null;
      editor.state.doc.forEach((_node, from) => {
        const dom = editor.view.nodeDOM(from);
        if (dom && (dom === element || dom.contains(element))) found = from;
      });
      return found;
    };
    const show = (from: number) => {
      const node = editor.view.nodeDOM(from);
      if (!(node instanceof HTMLElement)) return;
      const rect = node.getBoundingClientRect();
      setHover((current) =>
        current?.from === from && current.left === rect.left && current.top === rect.top
          ? current
          : { from, left: rect.left, top: rect.top },
      );
    };
    const pointer = (event: PointerEvent) => {
      if (gesture.current) return;
      const target = event.target as HTMLElement;
      if (target.closest('.block-gutter,.block-popover')) return;
      if (!root.contains(target)) {
        setHover(null);
        return;
      }
      const from = locate(target);
      if (from !== null) show(from);
    };
    const selection = () => {
      if (!gesture.current && root.contains(document.activeElement)) {
        const block = blockAt(editor.state.doc, editor.state.selection.from);
        if (block) show(block.from);
      }
    };
    const scroll = () => {
      if (!gesture.current) setHover(null);
    };
    document.addEventListener('pointermove', pointer);
    document.addEventListener('scroll', scroll, true);
    editor.on('selectionUpdate', selection);
    return () => {
      document.removeEventListener('pointermove', pointer);
      document.removeEventListener('scroll', scroll, true);
      editor.off('selectionUpdate', selection);
      cleanup.current?.();
    };
  }, [editor]);
  function start(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !hover || !editor.isEditable) return;
    event.preventDefault();
    event.stopPropagation();
    const block = blockAt(editor.state.doc, hover.from);
    if (!block) return;
    const binding = ySyncPluginKey.getState(editor.state);
    // Dragging any block of a block selection carries the whole selection.
    const group = blocksInRange(editor.state.selection);
    const carriesGroup = group.includes(block.index);
    if (!carriesGroup) group.length = 0;
    gesture.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      active: false,
      source: binding?.type.toArray()[block.index],
      fallback: block.from,
      target: null,
      label:
        group.length > 1
          ? `${group.length} blocks`
          : block.node.textContent.slice(0, 85) || block.node.type.name,
    };
    const button = event.currentTarget;
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      /* Document listeners also support embedded pointer-only engines. */
    }
    const previousSelect = document.body.style.userSelect,
      previousCursor = document.body.style.cursor;
    const scroller = editor.view.dom.closest<HTMLElement>('.document-scroll');
    const sourcePosition = () => {
      const current = gesture.current;
      if (!current) return null;
      const ystate = ySyncPluginKey.getState(editor.state);
      if (ystate && current.source) {
        const index = ystate.type.toArray().findIndex((item) => item === current.source);
        if (index < 0 || index >= editor.state.doc.childCount) return null;
        let from = 0;
        for (let i = 0; i < index; i++) from += editor.state.doc.child(i).nodeSize;
        return from;
      }
      return current.fallback;
    };
    const findDrop = (x: number, y: number): Drop | null => {
      const root = editor.view.dom.getBoundingClientRect();
      if (x < root.left - 65 || x > root.right + 30) return null;
      let drop: Drop | null = null;
      let lastBottom = root.top;
      editor.state.doc.forEach((node, from) => {
        const element = editor.view.nodeDOM(from);
        if (!(element instanceof HTMLElement)) return;
        const rect = element.getBoundingClientRect();
        lastBottom = rect.bottom;
        if (!drop && y < rect.top + rect.height / 2)
          drop = { position: from, left: root.left, top: rect.top, width: root.width };
      });
      return (
        drop ?? {
          position: editor.state.doc.content.size,
          left: root.left,
          top: lastBottom,
          width: root.width,
        }
      );
    };
    const move = (next: PointerEvent) => {
      const current = gesture.current;
      if (!current || next.pointerId !== current.pointer) return;
      if (!current.active && Math.hypot(next.clientX - current.x, next.clientY - current.y) < 5)
        return;
      current.active = true;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      if (scroller) {
        const rect = scroller.getBoundingClientRect();
        if (next.clientY > rect.bottom - 45) scroller.scrollTop += 18;
        else if (next.clientY < rect.top + 45) scroller.scrollTop -= 18;
      }
      current.target = findDrop(next.clientX, next.clientY);
      setPreview({ x: next.clientX, y: next.clientY, label: current.label, drop: current.target });
    };
    const finish = (next: PointerEvent) => {
      const current = gesture.current;
      if (!current || next.pointerId !== current.pointer) return;
      const source = sourcePosition();
      const target = current.target;
      const dragged = current.active;
      stop();
      if (source === null) return;
      if (dragged && target) {
        const tr = carriesGroup
          ? moveBlocksTo(editor.state, target.position)
          : moveBlockTo(editor.state, source, target.position);
        if (tr) editor.view.dispatch(tr);
        editor.view.focus();
      } else if (!dragged) actions(source, button);
    };
    const cancel = () => stop();
    const escape = (key: KeyboardEvent) => {
      if (key.key === 'Escape') {
        key.preventDefault();
        stop();
      }
    };
    function stop() {
      gesture.current = null;
      setPreview(null);
      document.body.style.userSelect = previousSelect;
      document.body.style.cursor = previousCursor;
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', finish, true);
      document.removeEventListener('pointercancel', cancel, true);
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('blur', cancel);
      try {
        button.releasePointerCapture(event.pointerId);
      } catch {
        /* The pointer may already have been released. */
      }
      cleanup.current = null;
    }
    cleanup.current = stop;
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', finish, true);
    document.addEventListener('pointercancel', cancel, true);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('blur', cancel);
  }
  return createPortal(
    <>
      {hover && (
        <div className="block-gutter" style={{ left: hover.left - 51, top: hover.top + 1 }}>
          <button
            aria-label={t('Insert block here')}
            onClick={(event) => insert(hover.from, event.currentTarget)}
          >
            <Plus size={16} />
          </button>
          <button
            aria-label={t('Drag or open block actions')}
            draggable={false}
            onPointerDown={start}
            onClick={(event) => {
              if (event.detail === 0) actions(hover.from, event.currentTarget);
            }}
          >
            <GripVertical size={17} />
          </button>
        </div>
      )}
      {preview && (
        <>
          <div className="block-drag-preview" style={{ left: preview.x + 16, top: preview.y + 12 }}>
            {preview.label}
          </div>
          {preview.drop && (
            <div
              className="block-drop-indicator"
              style={{
                left: preview.drop.left,
                top: preview.drop.top - 1,
                width: preview.drop.width,
              }}
            />
          )}
        </>
      )}
    </>,
    document.body,
  );
}
