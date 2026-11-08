export const canvasSides = ['auto', 'top', 'right', 'bottom', 'left'] as const;
export const canvasEnds = ['none', 'arrow'] as const;
export type CanvasSide = (typeof canvasSides)[number];
export type CanvasEnd = (typeof canvasEnds)[number];
export interface CanvasBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
type Side = Exclude<CanvasSide, 'auto'>;
const vectors: Record<Side, { x: number; y: number }> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
function facing(a: CanvasBox, b: CanvasBox): Side {
  const dx = b.x + b.width / 2 - a.x - a.width / 2,
    dy = b.y + b.height / 2 - a.y - a.height / 2;
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top';
}
function anchor(box: CanvasBox, side: Side) {
  return {
    x: box.x + (side === 'left' ? 0 : side === 'right' ? box.width : box.width / 2),
    y: box.y + (side === 'top' ? 0 : side === 'bottom' ? box.height : box.height / 2),
  };
}
/** Shared route for the connection and its label; never a persisted geometry copy. */
export function canvasConnection(
  a: CanvasBox,
  b: CanvasBox,
  options: { fromSide?: CanvasSide; toSide?: CanvasSide; self?: boolean; label?: string } = {},
) {
  const fromSide =
    !options.fromSide || options.fromSide === 'auto'
      ? options.self
        ? 'right'
        : facing(a, b)
      : options.fromSide;
  const toSide =
    !options.toSide || options.toSide === 'auto'
      ? options.self
        ? 'top'
        : facing(b, a)
      : options.toSide;
  const from = anchor(a, fromSide),
    to = anchor(b, toSide);
  const bend = options.self ? 120 : Math.max(48, Math.hypot(to.x - from.x, to.y - from.y) / 2);
  const control1 = {
    x: from.x + vectors[fromSide].x * bend,
    y: from.y + vectors[fromSide].y * bend,
  };
  const control2 = { x: to.x + vectors[toSide].x * bend, y: to.y + vectors[toSide].y * bend };
  if (options.self && fromSide === toSide) {
    const tangent = { x: -vectors[fromSide].y, y: vectors[fromSide].x },
      gap = Math.min(12, a.width / 4, a.height / 4);
    from.x -= tangent.x * gap;
    from.y -= tangent.y * gap;
    to.x += tangent.x * gap;
    to.y += tangent.y * gap;
    control1.x -= tangent.x * 60;
    control1.y -= tangent.y * 60;
    control2.x += tangent.x * 60;
    control2.y += tangent.y * 60;
  }
  const point = (t: number) => {
    const u = 1 - t;
    return {
      x:
        u ** 3 * from.x + 3 * u ** 2 * t * control1.x + 3 * u * t ** 2 * control2.x + t ** 3 * to.x,
      y:
        u ** 3 * from.y + 3 * u ** 2 * t * control1.y + 3 * u * t ** 2 * control2.y + t ** 3 * to.y,
    };
  };
  const halfWidth = Math.max(40, Math.min(170, (options.label?.length ?? 0) * 4 + 10));
  const clear = (candidate: { x: number; y: number }) =>
    [a, b].every(
      (box) =>
        candidate.x + halfWidth <= box.x ||
        candidate.x - halfWidth >= box.x + box.width ||
        candidate.y + 14 <= box.y ||
        candidate.y - 14 >= box.y + box.height,
    );
  const label = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9].map(point).find(clear) ?? point(0.5);
  return {
    from,
    to,
    control1,
    control2,
    path: `M${from.x},${from.y} C${control1.x},${control1.y} ${control2.x},${control2.y} ${to.x},${to.y}`,
    label,
  };
}
