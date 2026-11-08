import type { CanvasItem } from './canvas-commands.js';
import type { CanvasBox } from './canvas-geometry.js';

export const canvasGroupPadding = { side: 24, top: 40 } as const;

/** Group rectangles are canonical minimum frames. Descendants expand their projection.
 * This converges for concurrent member edits without writing derived geometry to Yjs. */
export function canvasBoxes(
  items: CanvasItem[],
  overrides?: ReadonlyMap<string, CanvasBox>,
): Map<string, CanvasBox> {
  const boxes = new Map<string, CanvasBox>(),
    groups = new Map<string, CanvasItem>();
  const pending = new Map<string, number>();
  for (const item of items) {
    if (item.node.type.name === 'canvasEdge') continue;
    const { x, y, width, height } = item.node.attrs;
    boxes.set(item.id, overrides?.get(item.id) ?? { x, y, width, height });
    if (item.node.type.name === 'canvasGroup') {
      groups.set(item.id, item);
      pending.set(item.id, 0);
    }
  }
  const enclose = (parent: string, child: string) => {
    const a = boxes.get(parent),
      b = boxes.get(child);
    if (!a || !b || !groups.has(parent)) return;
    const x = Math.min(a.x, b.x - canvasGroupPadding.side),
      y = Math.min(a.y, b.y - canvasGroupPadding.top);
    boxes.set(parent, {
      x,
      y,
      width: Math.max(a.x + a.width, b.x + b.width + canvasGroupPadding.side) - x,
      height: Math.max(a.y + a.height, b.y + b.height + canvasGroupPadding.side) - y,
    });
  };
  for (const item of items) {
    const parent = item.node.attrs.groupId;
    if (!parent || !groups.has(parent)) continue;
    if (groups.has(item.id)) pending.set(parent, pending.get(parent)! + 1);
    else enclose(parent, item.id);
  }
  const queue = [...groups.keys()].filter((id) => !pending.get(id));
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i],
      parent = groups.get(id)!.node.attrs.groupId;
    if (!parent || !groups.has(parent)) continue;
    enclose(parent, id);
    const count = pending.get(parent)! - 1;
    pending.set(parent, count);
    if (!count) queue.push(parent);
  }
  return boxes;
}

export function canvasContains(parent: CanvasBox, child: CanvasBox) {
  return (
    child.x >= parent.x &&
    child.y >= parent.y &&
    child.x + child.width <= parent.x + parent.width &&
    child.y + child.height <= parent.y + parent.height
  );
}
