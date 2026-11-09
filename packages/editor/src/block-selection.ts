import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import { Selection, type EditorState, type Transaction } from '@tiptap/pm/state';
import type { Mappable } from '@tiptap/pm/transform';
import {
  changeBlock,
  convertedBlock,
  duplicateBlock,
  moveBlock,
  moveBlockTo,
  removeBlock,
  type BlockKind,
} from './blocks.js';

/**
 * A selection of whole top-level blocks (Notion-style block selection). Its anchor and head sit on
 * block boundaries, so deleting, copying and cutting act on complete blocks, never on their text.
 */
export class BlockRangeSelection extends Selection {
  constructor($anchor: ResolvedPos, $head: ResolvedPos) {
    super($anchor, $head);
  }
  override map(doc: ProseMirrorNode, mapping: Mappable): Selection {
    const forward = this.anchor <= this.head;
    const from = mapping.map(this.from, 1),
      to = mapping.map(this.to, -1);
    return (
      blockRange(doc, from, to, forward) ??
      Selection.near(doc.resolve(Math.min(from, doc.content.size)))
    );
  }
  override eq(other: Selection): boolean {
    return (
      other instanceof BlockRangeSelection &&
      other.anchor === this.anchor &&
      other.head === this.head
    );
  }
  override toJSON() {
    return { type: 'blockRange', anchor: this.anchor, head: this.head };
  }
  override getBookmark() {
    return new BlockRangeBookmark(this.anchor, this.head);
  }
  static override fromJSON(doc: ProseMirrorNode, json: { anchor: number; head: number }) {
    return new BlockRangeSelection(doc.resolve(json.anchor), doc.resolve(json.head));
  }
}
// The blocks themselves are highlighted through decorations; the browser selection stays hidden.
BlockRangeSelection.prototype.visible = false;
Selection.jsonID('blockRange', BlockRangeSelection);

class BlockRangeBookmark {
  constructor(
    readonly anchor: number,
    readonly head: number,
  ) {}
  map(mapping: Mappable) {
    return new BlockRangeBookmark(mapping.map(this.anchor), mapping.map(this.head));
  }
  resolve(doc: ProseMirrorNode) {
    const forward = this.anchor <= this.head;
    const from = Math.min(this.anchor, this.head),
      to = Math.max(this.anchor, this.head);
    return (
      blockRange(doc, from, to, forward) ??
      Selection.near(doc.resolve(Math.min(from, doc.content.size)))
    );
  }
}

/** Snap a position range to the whole top-level blocks it touches; null when it covers none. */
function blockRange(doc: ProseMirrorNode, from: number, to: number, forward: boolean) {
  from = Math.max(0, Math.min(from, doc.content.size));
  to = Math.max(0, Math.min(to, doc.content.size));
  if (to <= from || doc.childCount === 0) return null;
  const first = doc.resolve(from).index(0),
    last = doc.resolve(to).index(0) - (atBoundary(doc, to) ? 1 : 0);
  if (last < first) return null;
  const start = offsetOf(doc, first),
    end = offsetOf(doc, last) + doc.child(last).nodeSize;
  return forward
    ? new BlockRangeSelection(doc.resolve(start), doc.resolve(end))
    : new BlockRangeSelection(doc.resolve(end), doc.resolve(start));
}
function atBoundary(doc: ProseMirrorNode, position: number) {
  return doc.resolve(position).depth === 0;
}
function offsetOf(doc: ProseMirrorNode, index: number) {
  let offset = 0;
  for (let i = 0; i < index; i++) offset += doc.child(i).nodeSize;
  return offset;
}

/** Indexes of the top-level blocks a block selection covers, in document order. */
export function blocksInRange(selection: Selection): number[] {
  if (!(selection instanceof BlockRangeSelection)) return [];
  const doc = selection.$from.doc;
  const first = selection.$from.index(0),
    last = selection.$to.index(0) - 1;
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => first + i).filter(
    (index) => index < doc.childCount,
  );
}

function rangeSelection(doc: ProseMirrorNode, anchor: number, head: number) {
  if (Math.min(anchor, head) < 0 || Math.max(anchor, head) >= doc.childCount) return null;
  const first = Math.min(anchor, head),
    last = Math.max(anchor, head);
  const start = offsetOf(doc, first),
    end = offsetOf(doc, last) + doc.child(last).nodeSize;
  return head >= anchor
    ? new BlockRangeSelection(doc.resolve(start), doc.resolve(end))
    : new BlockRangeSelection(doc.resolve(end), doc.resolve(start));
}

/** Select the top-level blocks between two indexes; the first index is the anchor. */
export function selectBlocks(state: EditorState, anchor: number, head: number): Transaction | null {
  const selection = rangeSelection(state.doc, anchor, head);
  return selection ? state.tr.setSelection(selection) : null;
}

/** The selected block range as indexes, or null when the selection is not a block selection. */
function selectedRange(state: EditorState) {
  const covered = blocksInRange(state.selection);
  if (!covered.length) return null;
  const first = covered[0]!,
    last = covered[covered.length - 1]!;
  return {
    first,
    last,
    start: offsetOf(state.doc, first),
    end: offsetOf(state.doc, last) + state.doc.child(last).nodeSize,
  };
}
const reselect = (tr: Transaction, first: number, last: number) => {
  const selection = rangeSelection(tr.doc, first, last);
  return (selection ? tr.setSelection(selection) : tr).scrollIntoView();
};

/** Move the selected blocks (or the block at the cursor) one place up or down. */
export function moveBlocks(state: EditorState, direction: -1 | 1): Transaction | null {
  const range = selectedRange(state);
  if (!range) return moveBlock(state, state.selection.from, direction);
  const neighbor = direction === -1 ? range.first - 1 : range.last + 1;
  if (neighbor < 0 || neighbor >= state.doc.childCount) return null;
  const node = state.doc.child(neighbor);
  const tr =
    direction === -1
      ? state.tr
          .delete(range.start - node.nodeSize, range.start)
          .insert(range.end - node.nodeSize, node)
      : state.tr.delete(range.end, range.end + node.nodeSize).insert(range.start, node);
  return reselect(tr, range.first + direction, range.last + direction);
}

/** Duplicate the selected blocks (or the block at the cursor) right after themselves. */
export function duplicateBlocks(state: EditorState): Transaction | null {
  const range = selectedRange(state);
  if (!range) return duplicateBlock(state, state.selection.from);
  const tr = state.tr.insert(range.end, state.doc.slice(range.start, range.end).content);
  const count = range.last - range.first + 1;
  return reselect(tr, range.last + 1, range.last + count);
}

/** Delete the selected blocks (or the block at the cursor). */
export function removeBlocks(state: EditorState): Transaction | null {
  const range = selectedRange(state);
  if (!range) return removeBlock(state, state.selection.from);
  const tr = state.tr.delete(range.start, range.end);
  return tr
    .setSelection(Selection.near(tr.doc.resolve(Math.min(range.start, tr.doc.content.size))))
    .scrollIntoView();
}

/** Turn every selected block (or the block at the cursor) into another kind, all or nothing. */
export function changeBlocks(state: EditorState, kind: BlockKind, level = 2): Transaction | null {
  const range = selectedRange(state);
  if (!range) return changeBlock(state, state.selection.from, kind, level);
  const tr = state.tr;
  let position = range.end,
    added = 0;
  for (let index = range.last; index >= range.first; index--) {
    const node = state.doc.child(index);
    position -= node.nodeSize;
    const replacement = convertedBlock(node, kind, level);
    if (!replacement) return null;
    tr.replaceWith(position, position + node.nodeSize, replacement);
    added += replacement.length - 1;
  }
  // A converted toggle releases its contents as extra blocks; keep them in the selection.
  return reselect(tr, range.first, range.last + added);
}

/** Drop the selected blocks (or the block at the cursor) at a block boundary outside them. */
export function moveBlocksTo(state: EditorState, destination: number): Transaction | null {
  const range = selectedRange(state);
  if (!range) return moveBlockTo(state, state.selection.from, destination);
  if (
    destination < 0 ||
    destination > state.doc.content.size ||
    !atBoundary(state.doc, destination)
  )
    return null;
  if (destination >= range.start && destination <= range.end) return null;
  const content = state.doc.slice(range.start, range.end).content;
  const target = destination > range.start ? destination - content.size : destination;
  const tr = state.tr.delete(range.start, range.end).insert(target, content);
  const first = tr.doc.resolve(target).index(0);
  return reselect(tr, first, first + range.last - range.first);
}

/** Grow or shrink a block selection by one block from its head, keeping its anchor block. */
export function extendBlockSelection(state: EditorState, direction: -1 | 1): Transaction | null {
  const { selection } = state;
  if (!(selection instanceof BlockRangeSelection)) return null;
  const covered = blocksInRange(selection);
  const forward = selection.anchor <= selection.head;
  const anchor = forward ? covered[0]! : covered[covered.length - 1]!,
    head = forward ? covered[covered.length - 1]! : covered[0]!;
  return selectBlocks(state, anchor, head + direction);
}
