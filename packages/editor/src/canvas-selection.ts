import { Extension } from '@tiptap/core';
import { Plugin, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';

/** Canvas elements (notes, groups, connections) sit at depth 2: doc > canvasRoot > element. */
const ELEMENT_DEPTH = 2;

/**
 * A text selection on a canvas must stay inside one element. Dragging across notes would
 * otherwise select the notes and connections in between, and the next keystroke would delete
 * them. Returns the transaction that clamps the selection to the element it started in.
 */
export function confineCanvasSelection(state: EditorState): Transaction | null {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || selection.empty) return null;
  const { $anchor, $head } = selection;
  if ($anchor.depth < ELEMENT_DEPTH || $head.depth < ELEMENT_DEPTH) return null;
  const start = $anchor.before(ELEMENT_DEPTH);
  if (start === $head.before(ELEMENT_DEPTH)) return null;
  const element = $anchor.node(ELEMENT_DEPTH);
  const forward = $head.pos > $anchor.pos;
  // The clamped end is the element's first or last text position, toward the drag direction.
  const edge = forward ? start + element.nodeSize - 1 : start + 1;
  const clamped = TextSelection.between($anchor, state.doc.resolve(edge), forward ? -1 : 1);
  return state.tr.setSelection(clamped);
}

/** Keeps every canvas text selection inside a single element. */
export const CanvasSelectionBoundary = Extension.create({
  name: 'canvasSelectionBoundary',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _old, state) =>
          transactions.some((tr) => tr.selectionSet || tr.docChanged)
            ? confineCanvasSelection(state)
            : null,
      }),
    ];
  },
});
