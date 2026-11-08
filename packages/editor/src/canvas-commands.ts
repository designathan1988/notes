import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { validateCanvas } from './canvas.js';
import type { JSONContent } from '@tiptap/core';
import type { CanvasSide, CanvasEnd } from './canvas-geometry.js';
import type { CanvasBox } from './canvas-geometry.js';
import { canvasBoxes, canvasContains, canvasGroupPadding } from './canvas-containment.js';
export interface CanvasStyle {
  color?: string;
  fromSide?: CanvasSide;
  toSide?: CanvasSide;
  fromEnd?: CanvasEnd;
  toEnd?: CanvasEnd;
}
export function styleCanvas(tr: Transaction, ids: string[], patch: CanvasStyle) {
  if (
    Object.keys(patch).some(
      (key) => !['color', 'fromSide', 'toSide', 'fromEnd', 'toEnd'].includes(key),
    )
  )
    throw new Error('Unsupported canvas style.');
  for (const item of canvasItems(tr.doc)) {
    if (!ids.includes(item.id)) continue;
    const style =
      item.node.type.name === 'canvasEdge'
        ? patch
        : patch.color === undefined
          ? {}
          : { color: patch.color };
    tr.setNodeMarkup(item.pos, undefined, { ...item.node.attrs, ...style });
  }
  return checked(tr);
}
export function addCanvasCard(
  tr: Transaction,
  id: string,
  x: number,
  y: number,
  content: JSONContent[] = [{ type: 'paragraph' }],
) {
  const before = canvasItems(tr.doc),
    boxes = canvasBoxes(before);
  const z = Math.max(0, ...before.map((item) => Number(item.node.attrs.z) || 0)) + 1;
  tr.insert(
    tr.doc.content.size - 1,
    tr.doc.type.schema.nodeFromJSON({ type: 'canvasCard', attrs: { id, x, y, z }, content }),
  );
  adoptCanvas(tr, [id], boxes);
  return checked(tr);
}
export function connectCanvas(
  tr: Transaction,
  id: string,
  fromNode: string,
  toNode: string,
  label = '',
) {
  const schema = tr.doc.type.schema;
  tr.insert(
    tr.doc.content.size - 1,
    schema.nodes.canvasEdge.create(
      { id, fromNode, toNode },
      label ? schema.text(label) : undefined,
    ),
  );
  return checked(tr);
}
export function resizeCanvas(tr: Transaction, id: string, width: number, height: number) {
  const items = canvasItems(tr.doc),
    item = items.find((item) => item.id === id);
  if (!item || item.node.type.name === 'canvasEdge') return tr;
  const frame = item.node.type.name === 'canvasGroup' ? canvasBoxes(items).get(id) : undefined;
  tr.setNodeMarkup(item.pos, undefined, {
    ...item.node.attrs,
    ...(frame ? { x: frame.x, y: frame.y } : {}),
    width: Math.max(120, width),
    height: Math.max(80, height),
  });
  return checked(tr);
}
export function orderCanvas(tr: Transaction, ids: string[], direction: 'front' | 'back') {
  const items = canvasItems(tr.doc).filter((item) => item.node.type.name !== 'canvasEdge'),
    values = items.map((item) => Number(item.node.attrs.z));
  let z = direction === 'front' ? Math.max(0, ...values) : Math.min(0, ...values);
  for (const item of items
    .filter((item) => ids.includes(item.id))
    .sort((a, b) => a.node.attrs.z - b.node.attrs.z)) {
    z += direction === 'front' ? 1 : -1;
    tr.setNodeMarkup(item.pos, undefined, { ...item.node.attrs, z });
  }
  return checked(tr);
}
export interface CanvasItem {
  id: string;
  node: ProseMirrorNode;
  pos: number;
}
export function canvasItems(doc: ProseMirrorNode): CanvasItem[] {
  if (doc.firstChild?.type.name !== 'canvasRoot')
    throw new Error('Open a canvas before editing spatial content.');
  const items: CanvasItem[] = [];
  doc.firstChild.forEach((node, offset) =>
    items.push({ id: node.attrs.id, node, pos: offset + 1 }),
  );
  return items;
}
const checked = (tr: Transaction) => {
  tr.doc.check();
  validateCanvas(tr.doc.toJSON());
  return tr;
};
export function canvasDescendants(items: CanvasItem[], ids: string[]) {
  const result = new Set(ids);
  const children = new Map<string, string[]>();
  for (const item of items) {
    const parent = item.node.attrs.groupId;
    if (parent) {
      const siblings = children.get(parent);
      if (siblings) siblings.push(item.id);
      else children.set(parent, [item.id]);
    }
  }
  const queue = [...result];
  for (let i = 0; i < queue.length; i++) {
    for (const child of children.get(queue[i]) ?? []) {
      if (result.has(child)) continue;
      result.add(child);
      queue.push(child);
    }
  }
  return result;
}
export function moveCanvas(tr: Transaction, ids: string[], dx: number, dy: number) {
  const items = canvasItems(tr.doc),
    selected = canvasDescendants(items, ids),
    boxes = canvasBoxes(items);
  for (const item of items)
    if (selected.has(item.id) && item.node.type.name !== 'canvasEdge')
      tr.setNodeMarkup(item.pos, undefined, {
        ...item.node.attrs,
        x: item.node.attrs.x + dx,
        y: item.node.attrs.y + dy,
      });
  adoptCanvas(tr, ids, boxes);
  return checked(tr);
}

function canvasRoots(items: CanvasItem[], ids: string[]) {
  const selected = new Set(ids),
    byId = new Map(items.map((item) => [item.id, item]));
  return items.filter((item) => {
    if (!selected.has(item.id) || item.node.type.name === 'canvasEdge') return false;
    let parent = item.node.attrs.groupId;
    const seen = new Set<string>();
    while (parent && !seen.has(parent)) {
      if (selected.has(parent)) return false;
      seen.add(parent);
      parent = byId.get(parent)?.node.attrs.groupId;
    }
    return true;
  });
}

/** Drop against stationary pre-move frames, so a parent cannot follow a departing child. */
function adoptCanvas(tr: Transaction, ids: string[], destination: Map<string, CanvasBox>) {
  const items = canvasItems(tr.doc),
    moved = canvasDescendants(items, ids),
    boxes = canvasBoxes(items);
  for (const item of canvasRoots(items, ids)) {
    const frame = boxes.get(item.id)!;
    const candidates = items.filter(
      (group) =>
        group.node.type.name === 'canvasGroup' &&
        !moved.has(group.id) &&
        destination.has(group.id) &&
        canvasContains(destination.get(group.id)!, frame),
    );
    candidates.sort((a, b) => {
      const one = destination.get(a.id)!,
        two = destination.get(b.id)!;
      return (
        one.width * one.height - two.width * two.height ||
        (a.id < b.id ? -1 : a.id === b.id ? 0 : 1)
      );
    });
    const groupId = candidates[0]?.id ?? null;
    if (item.node.attrs.groupId !== groupId)
      tr.setNodeMarkup(item.pos, undefined, { ...item.node.attrs, groupId });
  }
}
export function groupCanvas(tr: Transaction, ids: string[], id: string, label: string) {
  const items = canvasItems(tr.doc),
    selected = items.filter(
      (item) => ids.includes(item.id) && item.node.type.name !== 'canvasEdge',
    );
  if (!selected.length) throw new Error('Select notes or groups first.');
  const boxes = canvasBoxes(items);
  const roots = canvasRoots(items, ids);
  const parent = roots.every((item) => item.node.attrs.groupId === roots[0].node.attrs.groupId)
    ? roots[0].node.attrs.groupId
    : null;
  const frames = selected.map((item) => boxes.get(item.id)!);
  const left = Math.min(...frames.map((frame) => frame.x)) - canvasGroupPadding.side,
    top = Math.min(...frames.map((frame) => frame.y)) - canvasGroupPadding.top;
  const right = Math.max(...frames.map((frame) => frame.x + frame.width)) + canvasGroupPadding.side,
    bottom = Math.max(...frames.map((frame) => frame.y + frame.height)) + canvasGroupPadding.side;
  for (const item of roots)
    tr.setNodeMarkup(item.pos, undefined, { ...item.node.attrs, groupId: id });
  tr.insert(
    tr.doc.content.size - 1,
    tr.doc.type.schema.nodes.canvasGroup.create(
      { id, x: left, y: top, width: right - left, height: bottom - top, z: 0, groupId: parent },
      label ? tr.doc.type.schema.text(label) : undefined,
    ),
  );
  return checked(tr);
}
export function deleteCanvas(tr: Transaction, ids: string[]) {
  const items = canvasItems(tr.doc),
    selected = new Set(ids),
    byId = new Map(items.map((item) => [item.id, item]));
  for (const item of items)
    if (!selected.has(item.id) && selected.has(item.node.attrs.groupId)) {
      let parent = item.node.attrs.groupId;
      const seen = new Set<string>();
      while (parent && selected.has(parent) && !seen.has(parent)) {
        seen.add(parent);
        parent = byId.get(parent)?.node.attrs.groupId ?? null;
      }
      tr.setNodeMarkup(item.pos, undefined, { ...item.node.attrs, groupId: parent });
    }
  const removed = items.filter(
    (item) =>
      selected.has(item.id) ||
      (item.node.type.name === 'canvasEdge' &&
        (selected.has(item.node.attrs.fromNode) || selected.has(item.node.attrs.toNode))),
  );
  for (const item of removed.sort((a, b) => b.pos - a.pos))
    tr.delete(item.pos, item.pos + item.node.nodeSize);
  return checked(tr);
}
export function duplicateCanvas(tr: Transaction, ids: string[], newId: () => string) {
  const items = canvasItems(tr.doc),
    selected = canvasDescendants(items, ids);
  const copied = items.filter(
    (item) =>
      selected.has(item.id) ||
      (item.node.type.name === 'canvasEdge' &&
        selected.has(item.node.attrs.fromNode) &&
        selected.has(item.node.attrs.toNode)),
  );
  const mapping = new Map(copied.map((item) => [item.id, newId()]));
  for (const item of copied) {
    const attrs: Record<string, unknown> = { ...item.node.attrs, id: mapping.get(item.id)! };
    if (item.node.type.name === 'canvasEdge') {
      attrs.fromNode = mapping.get(String(attrs.fromNode)) ?? attrs.fromNode;
      attrs.toNode = mapping.get(String(attrs.toNode)) ?? attrs.toNode;
    } else {
      attrs.x = Number(attrs.x) + 32;
      attrs.y = Number(attrs.y) + 32;
      attrs.groupId = attrs.groupId ? (mapping.get(String(attrs.groupId)) ?? attrs.groupId) : null;
    }
    tr.insert(
      tr.doc.content.size - 1,
      item.node.type.create(attrs, item.node.content, item.node.marks),
    );
  }
  return checked(tr);
}
