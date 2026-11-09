import { expect, test } from 'vitest';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { editorSchema } from '@note/editor/schema';
import {
  BlockRangeSelection,
  blocksInRange,
  changeBlocks,
  duplicateBlocks,
  extendBlockSelection,
  moveBlocks,
  moveBlocksTo,
  removeBlocks,
  selectBlocks,
} from '@note/editor/block-selection';

const schema = editorSchema();
const paragraphs = (...texts: string[]) =>
  EditorState.create({
    schema,
    doc: schema.nodeFromJSON({
      type: 'doc',
      content: texts.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
    }),
  });
const texts = (state: EditorState) => {
  const out: string[] = [];
  state.doc.forEach((node) => out.push(node.textContent));
  return out;
};

test('selects whole top-level blocks by index and reports them back', () => {
  const state = paragraphs('One', 'Two', 'Three', 'Four', 'Five');
  const next = state.apply(selectBlocks(state, 1, 3)!);
  expect(next.selection).toBeInstanceOf(BlockRangeSelection);
  expect(blocksInRange(next.selection)).toEqual([1, 2, 3]);
});

test('deleting a block selection removes the blocks entirely, leaving no empty paragraph', () => {
  const state = paragraphs('One', 'Two', 'Three', 'Four', 'Five');
  const selected = state.apply(selectBlocks(state, 1, 3)!);
  const deleted = selected.apply(selected.tr.deleteSelection());
  expect(texts(deleted)).toEqual(['One', 'Five']);
});

test('copying a block selection yields the whole blocks', () => {
  const state = paragraphs('One', 'Two', 'Three');
  const selected = state.apply(selectBlocks(state, 0, 1)!);
  const slice = selected.selection.content();
  expect(slice.openStart).toBe(0);
  expect(slice.content.childCount).toBe(2);
  expect(slice.content.child(1).textContent).toBe('Two');
});

test('a block selection survives edits elsewhere and collapses when its blocks are gone', () => {
  const state = paragraphs('One', 'Two', 'Three');
  const selected = state.apply(selectBlocks(state, 1, 2)!);
  const typed = selected.apply(selected.tr.insertText('Z', 1));
  expect(typed.selection).toBeInstanceOf(BlockRangeSelection);
  expect(blocksInRange(typed.selection)).toEqual([1, 2]);
  const emptied = state.apply(selectBlocks(state, 0, 2)!);
  const gone = emptied.apply(emptied.tr.deleteSelection());
  expect(gone.selection).not.toBeInstanceOf(BlockRangeSelection);
});

test('shift+arrow grows and shrinks the selection from its anchor block', () => {
  const state = paragraphs('One', 'Two', 'Three', 'Four');
  let current = state.apply(selectBlocks(state, 1, 1)!);
  current = current.apply(extendBlockSelection(current, 1)!);
  expect(blocksInRange(current.selection)).toEqual([1, 2]);
  current = current.apply(extendBlockSelection(current, -1)!);
  current = current.apply(extendBlockSelection(current, -1)!);
  expect(blocksInRange(current.selection)).toEqual([0, 1]);
  expect(extendBlockSelection(current, -1)).toBeNull();
});

test('block actions apply to every selected block and keep them selected', () => {
  const state = paragraphs('One', 'Two', 'Three', 'Four');
  const selected = state.apply(selectBlocks(state, 1, 2)!);
  const up = selected.apply(moveBlocks(selected, -1)!);
  expect(texts(up)).toEqual(['Two', 'Three', 'One', 'Four']);
  expect(blocksInRange(up.selection)).toEqual([0, 1]);
  expect(moveBlocks(up, -1)).toBeNull();
  const down = selected.apply(moveBlocks(selected, 1)!);
  expect(texts(down)).toEqual(['One', 'Four', 'Two', 'Three']);
  const copied = selected.apply(duplicateBlocks(selected)!);
  expect(texts(copied)).toEqual(['One', 'Two', 'Three', 'Two', 'Three', 'Four']);
  expect(blocksInRange(copied.selection)).toEqual([3, 4]);
  const removed = selected.apply(removeBlocks(selected)!);
  expect(texts(removed)).toEqual(['One', 'Four']);
  const headings = selected.apply(changeBlocks(selected, 'heading', 2)!);
  expect([1, 2].map((i) => headings.doc.child(i).type.name)).toEqual(['heading', 'heading']);
  expect(blocksInRange(headings.selection)).toEqual([1, 2]);
});

test('dragging a block selection moves the whole group to a boundary outside it', () => {
  const state = paragraphs('One', 'Two', 'Three', 'Four');
  const selected = state.apply(selectBlocks(state, 0, 1)!);
  const end = selected.doc.content.size;
  const moved = selected.apply(moveBlocksTo(selected, end)!);
  expect(texts(moved)).toEqual(['Three', 'Four', 'One', 'Two']);
  expect(blocksInRange(moved.selection)).toEqual([2, 3]);
  const inside = selected.selection.from + selected.doc.child(0).nodeSize;
  expect(moveBlocksTo(selected, inside)).toBeNull();
});

test('without a block selection the actions fall back to the block at the cursor', () => {
  const state = paragraphs('One', 'Two');
  const cursor = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1)));
  expect(texts(cursor.apply(moveBlocks(cursor, 1)!))).toEqual(['Two', 'One']);
  expect(texts(cursor.apply(removeBlocks(cursor)!))).toEqual(['Two']);
});

test('round-trips through JSON so history and collaboration can restore it', () => {
  const state = paragraphs('One', 'Two', 'Three');
  const selected = state.apply(selectBlocks(state, 0, 1)!);
  const restored = BlockRangeSelection.fromJSON(selected.doc, selected.selection.toJSON());
  expect(restored.eq(selected.selection)).toBe(true);
  expect(selected.selection.eq(TextSelection.create(selected.doc, 1))).toBe(false);
});
