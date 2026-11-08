import { expect, test } from 'vitest';
import * as Y from 'yjs';
import type { JSONContent } from '@tiptap/core';
import { documentFromJSON, documentJSON, projectDocument } from '../packages/editor/src/schema.js';
import { editorSchema } from '../packages/editor/src/schema.js';
import { EditorState } from '@tiptap/pm/state';
import {
  canvasItems,
  moveCanvas,
  groupCanvas,
  deleteCanvas,
  duplicateCanvas,
  addCanvasCard,
  connectCanvas,
  resizeCanvas,
  orderCanvas,
} from '../packages/editor/src/canvas-commands.js';

const paragraph = (text: string): JSONContent => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});
function board(): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'canvasRoot',
        content: [
          {
            type: 'canvasGroup',
            attrs: { id: 'group', x: -40, y: -80, width: 760, height: 480, z: 0, color: 'neutral' },
            content: [{ type: 'text', text: 'Evidence' }],
          },
          {
            type: 'canvasCard',
            attrs: {
              id: 'note',
              x: 0,
              y: 0,
              width: 300,
              height: 240,
              z: 1,
              groupId: 'group',
              color: 'neutral',
            },
            content: [
              paragraph('Keep the original evidence.'),
              { type: 'pageLink', attrs: { targetId: 'linked-page', label: 'Linked page' } },
            ],
          },
          {
            type: 'canvasCard',
            attrs: {
              id: 'media',
              x: 360,
              y: 0,
              width: 280,
              height: 220,
              z: 2,
              groupId: 'group',
              color: 'blue',
            },
            content: [
              {
                type: 'attachment',
                attrs: {
                  id: 'asset',
                  filename: 'reference.png',
                  mediaType: 'image/png',
                  caption: 'Source image',
                },
              },
            ],
          },
          {
            type: 'canvasEdge',
            attrs: {
              id: 'connection',
              fromNode: 'note',
              toNode: 'media',
              fromSide: 'right',
              toSide: 'left',
              fromEnd: 'none',
              toEnd: 'arrow',
              color: 'neutral',
            },
            content: [{ type: 'text', text: 'Supports' }],
          },
        ],
      },
    ],
  };
}

test('canvas rich cards, media, groups and connections share the canonical Yjs document and read projections', () => {
  const source = board(),
    doc = documentFromJSON(source);
  try {
    expect(documentJSON(doc)).toEqual(source);
    const projection = projectDocument(documentJSON(doc));
    expect(projection.links).toEqual(['linked-page']);
    expect(projection.text).toContain('Evidence');
    expect(projection.text).toContain('Keep the original evidence.');
    expect(projection.text).toContain('Supports');
    expect(projection.text).toContain('reference.png');
    expect(projection.text).toContain('Source image');
    const reopened = new Y.Doc();
    try {
      Y.applyUpdate(reopened, Y.encodeStateAsUpdate(doc));
      expect(documentJSON(reopened)).toEqual(source);
    } finally {
      reopened.destroy();
    }
  } finally {
    doc.destroy();
  }
});

test('canvas roots cannot mix with document blocks or nest inside rich cards', () => {
  const source = board();
  expect(() =>
    documentFromJSON({ type: 'doc', content: [...source.content!, paragraph('Mixed root')] }),
  ).toThrow();
  const nested = structuredClone(source);
  nested.content![0].content![1].content!.push({ type: 'canvasRoot' });
  expect(() => documentFromJSON(nested)).toThrow();
});

test('canvas validation rejects duplicate IDs, invalid geometry, missing endpoints and group cycles', () => {
  for (const change of [
    (items: JSONContent[]) => {
      items[2].attrs!.id = 'note';
    },
    (items: JSONContent[]) => {
      items[1].attrs!.x = Infinity;
    },
    (items: JSONContent[]) => {
      items[1].attrs!.width = -10;
    },
    (items: JSONContent[]) => {
      items[1].attrs!.z = NaN;
    },
    (items: JSONContent[]) => {
      items[3].attrs!.toNode = 'missing';
    },
    (items: JSONContent[]) => {
      items[0].attrs!.groupId = 'group';
    },
    (items: JSONContent[]) => {
      items[1].attrs!.groupId = 'media';
    },
    (items: JSONContent[]) => {
      items[3].attrs!.fromSide = 'diagonal';
    },
    (items: JSONContent[]) => {
      items[0].attrs!.color = 'url(javascript:alert(1))';
    },
  ]) {
    const content = board();
    change(content.content![0].content!);
    expect(() => documentFromJSON(content)).toThrow();
  }
  const content = board(),
    items = content.content![0].content!;
  items[0].attrs!.groupId = 'second-group';
  items.push({
    ...structuredClone(items[0]),
    attrs: { ...items[0].attrs, id: 'second-group', groupId: 'group' },
  });
  expect(() => documentFromJSON(content)).toThrow();
});

test('moving a canvas card and concurrently editing its text converge without replacing its content identity', () => {
  const one = documentFromJSON(board()),
    two = new Y.Doc();
  try {
    Y.applyUpdate(two, Y.encodeStateAsUpdate(one));
    const firstCard = (one.getXmlFragment('default').get(0) as Y.XmlElement).get(1) as Y.XmlElement;
    const secondCard = (two.getXmlFragment('default').get(0) as Y.XmlElement).get(
      1,
    ) as Y.XmlElement;
    firstCard.setAttribute('x', 490 as unknown as string);
    firstCard.setAttribute('y', 210 as unknown as string);
    const text = (secondCard.get(0) as Y.XmlElement).get(0) as Y.XmlText;
    text.insert(text.length, ' Verified by a colleague.');
    Y.applyUpdate(one, Y.encodeStateAsUpdate(two));
    Y.applyUpdate(two, Y.encodeStateAsUpdate(one));
    expect(documentJSON(one)).toEqual(documentJSON(two));
    const moved = documentJSON(one).content![0].content![1];
    expect(moved.attrs).toMatchObject({ x: 490, y: 210 });
    expect(projectDocument(moved).text).toContain('Verified by a colleague.');
  } finally {
    one.destroy();
    two.destroy();
  }
});

test('canvas geometry transactions keep rich content identity and move groups with each descendant once', () => {
  const state = EditorState.create({
    schema: editorSchema(),
    doc: editorSchema().nodeFromJSON(board()),
  });
  const original = state.doc.firstChild!.child(1).content;
  const tr = moveCanvas(state.tr, ['group', 'note'], 40, 80);
  const items = canvasItems(tr.doc);
  expect(items.find((item) => item.id === 'note')!.node.attrs).toMatchObject({ x: 40, y: 80 });
  expect(items.find((item) => item.id === 'media')!.node.attrs).toMatchObject({ x: 400, y: 80 });
  expect(items.find((item) => item.id === 'note')!.node.content).toBe(original);
  expect(state.doc.firstChild!.child(1).attrs.x).toBe(0);
});

test('canvas grouping and duplication remap local identities and connections while leaving page links connected', () => {
  const state = EditorState.create({
    schema: editorSchema(),
    doc: editorSchema().nodeFromJSON(board()),
  });
  const grouped = groupCanvas(state.tr, ['note', 'media'], 'new-group', 'Sources');
  expect(canvasItems(grouped.doc).find((item) => item.id === 'note')!.node.attrs.groupId).toBe(
    'new-group',
  );
  let serial = 0;
  const cloned = duplicateCanvas(grouped, ['new-group'], () => `copy-${++serial}`);
  const items = canvasItems(cloned.doc),
    copies = items.filter((item) => item.id.startsWith('copy-'));
  expect(copies.filter((item) => item.node.type.name === 'canvasCard')).toHaveLength(2);
  const copiedGroup = copies.find((item) => item.node.type.name === 'canvasGroup')!;
  expect(
    copies
      .filter((item) => item.node.type.name === 'canvasCard')
      .every((item) => item.node.attrs.groupId === copiedGroup.id),
  ).toBe(true);
  const edge = copies.find((item) => item.node.type.name === 'canvasEdge')!;
  expect(copies.some((item) => item.id === edge.node.attrs.fromNode)).toBe(true);
  expect(copies.some((item) => item.id === edge.node.attrs.toNode)).toBe(true);
  expect(
    projectDocument({
      type: 'doc',
      content: [{ type: 'canvasRoot', content: copies.map((item) => item.node.toJSON()) }],
    }).links,
  ).toEqual(['linked-page']);
});

test('deleting a group keeps its notes, while deleting a note also removes its incident connectors', () => {
  const state = EditorState.create({
    schema: editorSchema(),
    doc: editorSchema().nodeFromJSON(board()),
  });
  const ungrouped = deleteCanvas(state.tr, ['group']);
  expect(
    canvasItems(ungrouped.doc)
      .map((item) => item.id)
      .sort(),
  ).toEqual(['connection', 'media', 'note']);
  expect(
    canvasItems(ungrouped.doc).find((item) => item.id === 'note')!.node.attrs.groupId,
  ).toBeNull();
  const removed = deleteCanvas(ungrouped, ['note']);
  expect(canvasItems(removed.doc).map((item) => item.id)).toEqual(['media']);
});

test('canvas insertion, connection, resize and stacking operate on the same typed document', () => {
  const schema = editorSchema(),
    state = EditorState.create({ schema, doc: schema.nodeFromJSON(board()) });
  const tr = addCanvasCard(state.tr, 'new-note', 850, 120, [paragraph('New idea')]);
  connectCanvas(tr, 'new-edge', 'media', 'new-note', 'Informs');
  resizeCanvas(tr, 'new-note', 460, 300);
  orderCanvas(tr, ['new-note'], 'front');
  const items = canvasItems(tr.doc),
    added = items.find((item) => item.id === 'new-note')!;
  expect(added.node.attrs).toMatchObject({ x: 850, y: 120, width: 460, height: 300 });
  expect(added.node.textContent).toBe('New idea');
  expect(added.node.attrs.z).toBeGreaterThan(
    items.find((item) => item.id === 'media')!.node.attrs.z,
  );
  expect(items.find((item) => item.id === 'new-edge')!.node.attrs).toMatchObject({
    fromNode: 'media',
    toNode: 'new-note',
  });
  expect(() => connectCanvas(tr, 'bad-edge', 'missing', 'new-note')).toThrow();
});
