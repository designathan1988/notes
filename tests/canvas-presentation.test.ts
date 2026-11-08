import { expect, test } from 'vitest';
import { EditorState } from '@tiptap/pm/state';
import { editorSchema } from '@note/editor/schema';
import { canvasConnection } from '@note/editor/canvas-geometry';
import { styleCanvas, canvasItems } from '@note/editor/canvas-commands';

const a = { x: 0, y: 0, width: 120, height: 60 },
  b = { x: 300, y: 200, width: 120, height: 60 };
test('automatic connections face their destination while explicit attachment sides stay on their chosen edges', () => {
  expect(canvasConnection(a, { ...b, y: 0 }).from).toEqual({ x: 120, y: 30 });
  expect(canvasConnection(a, { ...b, y: 0 }).to).toEqual({ x: 300, y: 30 });
  const route = canvasConnection(a, b, { fromSide: 'left', toSide: 'bottom' });
  expect(route.from).toEqual({ x: 0, y: 30 });
  expect(route.to).toEqual({ x: 360, y: 260 });
  expect(route.path).toMatch(/^M0,30 C-/);
});
test('a connection label uses the actual cubic midpoint and self-connections remain visible', () => {
  const route = canvasConnection(a, b, { fromSide: 'top', toSide: 'right' });
  const midpoint = (key: 'x' | 'y') =>
    (route.from[key] + 3 * route.control1[key] + 3 * route.control2[key] + route.to[key]) / 8;
  expect(route.label).toEqual({ x: midpoint('x'), y: midpoint('y') });
  const self = canvasConnection(a, a, { fromSide: 'right', toSide: 'right', self: true });
  expect(self.from).not.toEqual(self.to);
  expect(self.label.x).toBeGreaterThan(120);
  expect(self.path).not.toMatch(/NaN|Infinity/);
});
test('a routed label avoids the cards when the curve midpoint enters an endpoint', () => {
  const first = { x: 0, y: 0, width: 310, height: 230 },
    second = { ...first, x: 420 };
  const route = canvasConnection(first, second, { fromSide: 'top', toSide: 'left' });
  for (const box of [first, second]) {
    const intersects =
      route.label.x + 40 > box.x &&
      route.label.x - 40 < box.x + box.width &&
      route.label.y + 14 > box.y &&
      route.label.y - 14 < box.y + box.height;
    expect(intersects).toBe(false);
  }
});
function state() {
  return EditorState.create({
    schema: editorSchema(),
    doc: editorSchema().nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'canvasRoot',
          content: [
            {
              type: 'canvasCard',
              attrs: { id: 'a', ...a },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep my text.' }] }],
            },
            { type: 'canvasCard', attrs: { id: 'b', ...b }, content: [{ type: 'paragraph' }] },
            {
              type: 'canvasEdge',
              attrs: { id: 'edge', fromNode: 'a', toNode: 'b' },
              content: [{ type: 'text', text: 'A connection' }],
            },
          ],
        },
      ],
    }),
  });
}
test('canvas styling updates the canonical attributes without changing geometry or rich content', () => {
  const initial = state(),
    before = canvasItems(initial.doc),
    next = styleCanvas(initial.tr, ['a', 'edge'], {
      color: '#b65d96',
      fromSide: 'left',
      toSide: 'bottom',
      fromEnd: 'arrow',
      toEnd: 'none',
    });
  const styled = canvasItems(next.doc);
  expect(styled[0].node.attrs).toEqual({ ...before[0].node.attrs, color: '#b65d96' });
  expect(styled[0].node.content.eq(before[0].node.content)).toBe(true);
  expect(styled[1].node.eq(before[1].node)).toBe(true);
  expect(styled[2].node.attrs).toMatchObject({
    color: '#b65d96',
    fromSide: 'left',
    toSide: 'bottom',
    fromEnd: 'arrow',
    toEnd: 'none',
  });
  expect(styled[2].node.textContent).toBe('A connection');
  expect(() => styleCanvas(initial.tr, ['a'], { color: 'url(https://example.com)' })).toThrow();
  expect(() => styleCanvas(initial.tr, ['edge'], { fromSide: 'diagonal' as 'left' })).toThrow();
});
