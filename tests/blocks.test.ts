import { expect, test } from 'vitest';
import { EditorState, NodeSelection } from '@tiptap/pm/state';
import { editorSchema } from '@note/editor/schema';
import {
  blockAt,
  changeBlock,
  duplicateBlock,
  moveBlock,
  moveBlockTo,
  removeBlock,
} from '@note/editor/blocks';

const schema = editorSchema();
test('drops a whole block at an arbitrary document boundary and rejects an interior drop', () => {
  const current = state();
  const last = current.doc.content.size - current.doc.lastChild!.nodeSize;
  const moved = current.apply(moveBlockTo(current, last, 0)!);
  expect(moved.doc.firstChild?.textContent).toBe('Last');
  expect(moved.doc.lastChild?.type.name).toBe('bulletList');
  expect(moveBlockTo(current, 0, 2)).toBeNull();
});
function state() {
  return EditorState.create({
    schema,
    doc: schema.nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First', marks: [{ type: 'bold' }] }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nested item' }] }],
            },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Last' }] },
      ],
    }),
  });
}
test('moves an entire nested block without flattening its content or marks', () => {
  const initial = state();
  const listPosition = initial.doc.child(0).nodeSize;
  const moved = initial.apply(moveBlock(initial, listPosition, -1)!);
  expect(moved.doc.child(0).type.name).toBe('bulletList');
  expect(moved.doc.child(0).textContent).toBe('Nested item');
  expect(moved.doc.child(1).firstChild?.marks[0].type.name).toBe('bold');
  expect(moved.selection).toBeInstanceOf(NodeSelection);
  expect(moveBlock(moved, 0, -1)).toBeNull();
  expect(blockAt(moved.doc, 2)?.index).toBe(0);
});
test('duplicates the selected block and removes only that complete block', () => {
  let current = state();
  current = current.apply(duplicateBlock(current, 0)!);
  expect(current.doc.childCount).toBe(4);
  expect(current.doc.child(0).toJSON()).toEqual(current.doc.child(1).toJSON());
  current = current.apply(removeBlock(current, 0)!);
  expect(current.doc.childCount).toBe(3);
  expect(current.doc.child(0).textContent).toBe('First');
  const empty = EditorState.create({
    schema,
    doc: schema.nodes.doc.create(null, schema.nodes.paragraph.create()),
  });
  expect(empty.apply(removeBlock(empty, 0)!).doc.childCount).toBe(1);
});
test('transforms text into headings, callouts and checklists while preserving rich content', () => {
  const initial = state();
  const heading = initial.apply(changeBlock(initial, 0, 'heading')!);
  expect(heading.doc.firstChild?.attrs.level).toBe(2);
  expect(heading.doc.firstChild?.firstChild?.marks[0].type.name).toBe('bold');
  const callout = heading.apply(changeBlock(heading, 0, 'callout')!);
  expect(callout.doc.firstChild?.type.name).toBe('callout');
  expect(callout.doc.firstChild?.textContent).toBe('First');
  const list = callout.apply(changeBlock(callout, 0, 'taskList')!);
  expect(list.doc.firstChild?.firstChild?.attrs.checked).toBe(false);
  expect(list.doc.firstChild?.textContent).toBe('First');
});
