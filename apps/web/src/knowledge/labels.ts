import { worldToScreen, type Camera, type Point, type Size } from '../spatial/geometry.js';
export interface LabelNode extends Point {
  id: string;
  title: string;
  priority: number;
}
export function graphLabels(nodes: LabelNode[], camera: Camera, size: Size): Map<string, number> {
  const accepted: { left: number; right: number; top: number; bottom: number }[] = [];
  const visible = new Map<string, number>();
  const points = nodes.map((node) => ({ ...node, ...worldToScreen(node, camera, size) }));
  for (const node of [...points].sort(
    (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
  )) {
    const width = Math.min(28, node.title.length) * 7 + 8;
    const candidates = node.priority === 0 ? [25, -18, 45, -38, 65, -58, 85, -78, 105, -98] : [25];
    for (const baseline of candidates) {
      const bounds = {
        left: node.x - width / 2,
        right: node.x + width / 2,
        top: node.y + baseline - 13,
        bottom: node.y + baseline + 4,
      };
      if (
        bounds.right < 0 ||
        bounds.left > size.width ||
        bounds.bottom < 0 ||
        bounds.top > size.height
      )
        continue;
      const overlapping = accepted.some(
        (other) =>
          bounds.left < other.right + 5 &&
          bounds.right > other.left - 5 &&
          bounds.top < other.bottom + 4 &&
          bounds.bottom > other.top - 4,
      );
      const overNode = points.some(
        (other) =>
          other.id !== node.id &&
          other.x + 9 > bounds.left &&
          other.x - 9 < bounds.right &&
          other.y + 9 > bounds.top &&
          other.y - 9 < bounds.bottom,
      );
      if (!overlapping && !overNode) {
        visible.set(node.id, baseline);
        accepted.push(bounds);
        break;
      }
    }
  }
  return visible;
}
