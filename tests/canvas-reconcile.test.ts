import { afterAll, beforeAll, expect, test } from 'vitest';
import * as Y from 'yjs';
import { fixture, rawPage } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import { Documents } from '../apps/server/src/documents/service.js';
import { documentFromJSON, documentJSON, validateDocument } from '@note/editor/schema';
import { reconcileCanvasTopology } from '@note/editor/canvas-reconcile';

let db: Database;
beforeAll(async () => {
  db = await fixture();
});
afterAll(async () => {
  await db.close();
});
const actor = { userId: 'owner' };
const card = (id: string, groupId: string | null = null) => ({
  type: 'canvasCard',
  attrs: { id, groupId },
  content: [{ type: 'paragraph', content: [{ type: 'text', text: `${id} original` }] }],
});
const group = (id: string) => ({ type: 'canvasGroup', attrs: { id } });
function clone(document: Y.Doc) {
  const copy = new Y.Doc();
  Y.applyUpdate(copy, Y.encodeStateAsUpdate(document));
  return copy;
}
function root(document: Y.Doc) {
  return document.getXmlFragment('default').get(0) as Y.XmlElement;
}
function find(document: Y.Doc, id: string) {
  return root(document)
    .toArray()
    .find(
      (value) => value instanceof Y.XmlElement && value.getAttribute('id') === id,
    ) as Y.XmlElement;
}
function remove(document: Y.Doc, id: string) {
  const index = root(document)
    .toArray()
    .findIndex((value) => value instanceof Y.XmlElement && value.getAttribute('id') === id);
  root(document).delete(index, 1);
}
function append(document: Y.Doc, content: Record<string, unknown>) {
  const temporary = documentFromJSON({
    type: 'doc',
    content: [
      {
        type: 'canvasRoot',
        content: [...(documentJSON(document).content![0].content ?? []), content],
      },
    ],
  });
  try {
    root(document).push([
      (root(temporary).get(root(temporary).length - 1) as Y.XmlElement).clone(),
    ]);
  } finally {
    temporary.destroy();
  }
}

test('a concurrent endpoint deletion and new connection settle without rejecting unrelated rich edits', async () => {
  const id = await rawPage(db, { kind: 'canvas' }),
    documents = new Documents(db);
  const seed = documentFromJSON({
    type: 'doc',
    content: [{ type: 'canvasRoot', content: [card('a'), card('b')] }],
  });
  await documents.importContent(actor, id, seed, 1);
  const alice = await documents.load(id),
    bob = clone(alice),
    hub = clone(alice);
  try {
    remove(alice, 'a');
    append(bob, {
      type: 'canvasEdge',
      attrs: { id: 'new-edge', fromNode: 'a', toNode: 'b' },
      content: [{ type: 'text', text: 'New connection' }],
    });
    const richText = (find(bob, 'b').get(0) as Y.XmlElement).get(0) as Y.XmlText;
    richText.insert(richText.length, ' — keep the concurrent edit');
    validateDocument(documentJSON(alice), 'canvas');
    validateDocument(documentJSON(bob), 'canvas');
    await documents.save(actor, id, Y.encodeStateAsUpdate(alice), 1);
    const committed = await documents.merge(actor, id, Y.encodeStateAsUpdate(bob), 1);
    expect(committed.repair).toBeDefined();
    Y.applyUpdate(
      hub,
      Y.mergeUpdates([Y.encodeStateAsUpdate(alice), Y.encodeStateAsUpdate(bob), committed.repair!]),
    );
    Y.applyUpdate(bob, Y.mergeUpdates([Y.encodeStateAsUpdate(alice), committed.repair!]));
    expect((find(bob, 'b').get(0) as Y.XmlElement).get(0)).toBe(richText);
    const reopened = await documents.load(id);
    try {
      const expected = documentJSON(reopened);
      expect(expected.content![0].content!.map((node) => node.attrs!.id)).toEqual(['b']);
      expect(JSON.stringify(expected)).toContain('keep the concurrent edit');
      expect(documentJSON(hub)).toEqual(expected);
      expect(documentJSON(bob)).toEqual(expected);
      expect(() => validateDocument(expected, 'canvas')).not.toThrow();
      expect(committed.acknowledgement.type).toBe('durable');
    } finally {
      reopened.destroy();
    }
  } finally {
    for (const document of [seed, alice, bob, hub]) document.destroy();
  }
});

test('deleted groups release concurrently added notes while preserving their canonical text objects', () => {
  const base = documentFromJSON({
      type: 'doc',
      content: [{ type: 'canvasRoot', content: [group('parent'), card('a', 'parent')] }],
    }),
    alice = clone(base),
    bob = clone(base);
  try {
    find(alice, 'a').setAttribute('groupId', null as unknown as string);
    remove(alice, 'parent');
    append(bob, card('b', 'parent'));
    const original = find(bob, 'b').get(0);
    Y.applyUpdate(bob, Y.encodeStateAsUpdate(alice));
    expect(() => validateDocument(documentJSON(bob), 'canvas')).toThrow();
    expect(reconcileCanvasTopology(bob)).toBeGreaterThan(0);
    expect(find(bob, 'b').getAttribute('groupId')).toBeNull();
    expect(find(bob, 'b').get(0)).toBe(original);
    expect(() => validateDocument(documentJSON(bob), 'canvas')).not.toThrow();
    expect(reconcileCanvasTopology(bob)).toBe(0);
  } finally {
    for (const document of [base, alice, bob]) document.destroy();
  }
});

test('concurrent valid group moves resolve cycles deterministically without discarding groups or notes', () => {
  const base = documentFromJSON({
      type: 'doc',
      content: [{ type: 'canvasRoot', content: [group('one'), group('two'), card('a', 'one')] }],
    }),
    alice = clone(base),
    bob = clone(base),
    left = clone(base),
    right = clone(base);
  try {
    find(alice, 'one').setAttribute('groupId', 'two');
    find(bob, 'two').setAttribute('groupId', 'one');
    validateDocument(documentJSON(alice), 'canvas');
    validateDocument(documentJSON(bob), 'canvas');
    Y.applyUpdate(left, Y.encodeStateAsUpdate(alice));
    Y.applyUpdate(left, Y.encodeStateAsUpdate(bob));
    Y.applyUpdate(right, Y.encodeStateAsUpdate(bob));
    Y.applyUpdate(right, Y.encodeStateAsUpdate(alice));
    reconcileCanvasTopology(left);
    reconcileCanvasTopology(right);
    expect(documentJSON(left)).toEqual(documentJSON(right));
    expect(find(left, 'two').getAttribute('groupId')).toBeNull();
    expect(root(left).length).toBe(3);
    expect(() => validateDocument(documentJSON(left), 'canvas')).not.toThrow();
  } finally {
    for (const document of [base, alice, bob, left, right]) document.destroy();
  }
});
