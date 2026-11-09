import { expect, test } from 'vitest';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { editorSchema } from '@note/editor/schema';
import { confineCanvasSelection } from '@note/editor/canvas-selection';

const schema = editorSchema();
const card = (id: string, text: string) => ({
  type: 'canvasCard',
  attrs: { id },
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
function canvas() {
  return EditorState.create({
    schema,
    doc: schema.nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'canvasRoot',
          content: [
            card('a', 'Interview themes'),
            card('b', 'Pricing questions'),
            { type: 'canvasEdge', attrs: { id: 'e', source: 'a', target: 'b' } },
          ],
        },
      ],
    }),
  });
}
const texts = (state: EditorState) => {
  const out: string[] = [];
  state.doc.firstChild!.forEach((node) => out.push(`${node.type.name}:${node.textContent}`));
  return out;
};

test('a text selection dragged across two canvas notes stays inside the note it started in', () => {
  const state = canvas();
  const inFirst = 3 + 'Interview them'.length;
  const inSecond = state.doc.content.size - 8;
  const confined = confineCanvasSelection(
    state.apply(state.tr.setSelection(TextSelection.create(state.doc, inFirst, inSecond))),
  );
  expect(confined).not.toBeNull();
  const next = canvas().apply(confined!);
  const { $from, $to } = next.selection;
  expect($from.node(2)).toBe($to.node(2));
  expect(next.doc.textBetween(next.selection.from, next.selection.to)).toBe('es');
});

test('typing over a confined selection never deletes the other notes or connections', () => {
  const state = canvas();
  const crossing = state.apply(
    state.tr.setSelection(TextSelection.create(state.doc, 5, state.doc.content.size - 8)),
  );
  const confined = crossing.apply(confineCanvasSelection(crossing)!);
  const typed = confined.apply(confined.tr.insertText('X'));
  const after = texts(typed);
  expect(after).toHaveLength(3);
  expect(after[0]).toMatch(/^canvasCard:InX/);
  expect(after.slice(1)).toEqual(['canvasCard:Pricing questions', 'canvasEdge:']);
});

test('a selection inside one note is left alone', () => {
  const state = canvas();
  const inside = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 4, 9)));
  expect(confineCanvasSelection(inside)).toBeNull();
});
