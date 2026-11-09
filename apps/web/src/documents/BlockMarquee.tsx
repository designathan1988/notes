import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { BlockRangeSelection, selectBlocks } from '@note/editor/block-selection';

type Box = { left: number; top: number; width: number; height: number };
// Anything a person can operate keeps its own pointer behavior.
const OWN_POINTER =
  'button, a[href], input, select, textarea, label, summary, [role="button"], [role="menuitem"], [role="tab"], [contenteditable="true"], dialog, .block-gutter, .block-popover, .app-popover, .document-tools, .document-utilities, .selection-toolbar';
const EMPTY_SPACE = '.document-canvas, .editor-wrap, .record-document, .record-inspector-scroll';
const THRESHOLD = 4;

/**
 * Drag a box from the empty space around the document to select every block it touches,
 * like Notion. The selection is a real editor selection, so Delete, copy, cut and the
 * block actions all act on the selected blocks.
 */
export function BlockMarquee({ editor }: { editor: Editor }) {
  const [box, setBox] = useState<Box | null>(null);
  useEffect(() => {
    const view = editor.view;
    const surface =
      view.dom.closest<HTMLElement>('.document-scroll, .record-inspector-scroll') ??
      view.dom.parentElement;
    if (!surface) return;
    let stop: (() => void) | null = null;
    const down = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        !editor.isEditable ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      const target = event.target as HTMLElement;
      // Only the empty space around the blocks starts a box; text elsewhere stays selectable.
      if (target !== surface && !target.matches(EMPTY_SPACE)) return;
      if (view.dom.contains(target) || target.closest(OWN_POINTER)) return;
      // Keep focus and the text caret where they are until the drag really starts.
      event.preventDefault();
      const origin = { x: event.clientX, y: event.clientY + surface.scrollTop };
      let active = false,
        last = { x: event.clientX, y: event.clientY },
        selected = '';
      const previousSelect = document.body.style.userSelect;
      const update = () => {
        const top = Math.min(origin.y - surface.scrollTop, last.y),
          bottom = Math.max(origin.y - surface.scrollTop, last.y),
          left = Math.min(origin.x, last.x),
          right = Math.max(origin.x, last.x);
        setBox({ left, top, width: right - left, height: bottom - top });
        const hits: number[] = [];
        let index = 0;
        editor.state.doc.forEach((_node, position) => {
          const element = view.nodeDOM(position);
          if (element instanceof HTMLElement) {
            const rect = element.getBoundingClientRect();
            if (rect.bottom > top && rect.top < bottom && rect.right > left && rect.left < right)
              hits.push(index);
          }
          index++;
        });
        const key = hits.length ? `${hits[0]}-${hits.at(-1)}` : '';
        if (key === selected) return;
        selected = key;
        if (!hits.length) return;
        const forward = last.y >= origin.y - surface.scrollTop;
        const transaction = forward
          ? selectBlocks(editor.state, hits[0]!, hits.at(-1)!)
          : selectBlocks(editor.state, hits.at(-1)!, hits[0]!);
        if (transaction) view.dispatch(transaction);
      };
      const move = (next: PointerEvent) => {
        if (next.pointerId !== event.pointerId) return;
        last = { x: next.clientX, y: next.clientY };
        if (!active && Math.hypot(last.x - event.clientX, last.y - event.clientY) < THRESHOLD)
          return;
        if (!active) {
          active = true;
          document.body.style.userSelect = 'none';
          document.body.dataset.blockMarquee = '';
          if (!view.hasFocus()) view.focus();
        }
        const rect = surface.getBoundingClientRect();
        if (last.y > rect.bottom - 40) surface.scrollTop += 16;
        else if (last.y < rect.top + 40) surface.scrollTop -= 16;
        update();
      };
      const end = (next: PointerEvent) => {
        if (next.pointerId !== event.pointerId) return;
        const dragged = active;
        stop?.();
        if (dragged) view.focus();
        else if (editor.state.selection instanceof BlockRangeSelection) {
          // A plain click on empty space clears the block selection, as in Notion.
          const { state } = editor;
          view.dispatch(
            state.tr.setSelection(TextSelection.near(state.doc.resolve(state.selection.to), -1)),
          );
          view.dom.blur();
        }
      };
      const escape = (key: KeyboardEvent) => {
        if (key.key === 'Escape' && active) stop?.();
      };
      const scroll = () => active && update();
      stop = () => {
        setBox(null);
        document.body.style.userSelect = previousSelect;
        delete document.body.dataset.blockMarquee;
        document.removeEventListener('pointermove', move, true);
        document.removeEventListener('pointerup', end, true);
        document.removeEventListener('pointercancel', end, true);
        document.removeEventListener('keydown', escape, true);
        surface.removeEventListener('scroll', scroll);
        stop = null;
      };
      document.addEventListener('pointermove', move, true);
      document.addEventListener('pointerup', end, true);
      document.addEventListener('pointercancel', end, true);
      document.addEventListener('keydown', escape, true);
      surface.addEventListener('scroll', scroll);
    };
    surface.addEventListener('pointerdown', down);
    return () => {
      surface.removeEventListener('pointerdown', down);
      stop?.();
    };
  }, [editor]);
  return box
    ? createPortal(<div className="block-marquee" aria-hidden="true" style={box} />, document.body)
    : null;
}
