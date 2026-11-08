import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { validateCanvas } from './canvas.js';
import type { JSONContent } from '@tiptap/core';
import type { CanvasSide, CanvasEnd } from './canvas-geometry.js';
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
  const z = Math.max(0, ...canvasItems(tr.doc).map((item) => Number(item.node.attrs.z) || 0)) + 1;
  tr.insert(
    tr.doc.content.size - 1,
    tr.doc.type.schema.nodeFromJSON({ type: 'canvasCard', attrs: { id, x, y, z }, content }),
  );
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
  const item = canvasItems(tr.doc).find((item) => item.id === id);
  if (!item || item.node.type.name === 'canvasEdge') return tr;
  tr.setNodeMarkup(item.pos, undefined, {
    ...item.node.attrs,
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
  for (let pass = 0; pass < items.length; pass++) {
    const before = result.size;
    for (const item of items)
      if (item.node.attrs.groupId && result.has(item.node.attrs.groupId)) result.add(item.id);
    if (result.size === before) break;
  }
  return result;
}
export function moveCanvas(tr: Transaction, ids: string[], dx: number, dy: number) {
  const items = canvasItems(tr.doc),
    selected = canvasDescendants(items, ids);
  for (const item of items)
    if (selected.has(item.id) && item.node.type.name !== 'canvasEdge')
      tr.setNodeMarkup(item.pos, undefined, {
        ...item.node.attrs,
        x: item.node.attrs.x + dx,
        y: item.node.attrs.y + dy,
      });
  return checked(tr);
}
export function groupCanvas(tr: Transaction, ids: string[], id: string, label: string) {
  const items = canvasItems(tr.doc),
    selected = items.filter(
      (item) => ids.includes(item.id) && item.node.type.name !== 'canvasEdge',
    );
  if (!selected.length) throw new Error('Select notes or groups first.');
  const roots = selected.filter(
    (item) => !selected.some((parent) => parent.id === item.node.attrs.groupId),
  );
  const parent = roots.every((item) => item.node.attrs.groupId === roots[0].node.attrs.groupId)
    ? roots[0].node.attrs.groupId
    : null;
  const left = Math.min(...selected.map((item) => item.node.attrs.x)) - 24,
    top = Math.min(...selected.map((item) => item.node.attrs.y)) - 40;
  const right = Math.max(...selected.map((item) => item.node.attrs.x + item.node.attrs.width)) + 24,
    bottom = Math.max(...selected.map((item) => item.node.attrs.y + item.node.attrs.height)) + 24;
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
