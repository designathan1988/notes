export interface Point {
  x: number;
  y: number;
}
export interface Size {
  width: number;
  height: number;
}
export interface Camera extends Point {
  zoom: number;
}
export const MIN_ZOOM = 0.03,
  MAX_ZOOM = 3;
export const clampZoom = (zoom: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
export const validPoint = (point: unknown): point is Point => {
  const value = point as Point | null;
  return (
    !!value &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Math.abs(value.x) <= 1e6 &&
    Math.abs(value.y) <= 1e6
  );
};
export const validCamera = (camera: unknown): camera is Camera =>
  validPoint(camera) &&
  Number.isFinite((camera as Camera).zoom) &&
  (camera as Camera).zoom >= MIN_ZOOM &&
  (camera as Camera).zoom <= MAX_ZOOM;
export const screenToWorld = (point: Point, camera: Camera, size: Size): Point => ({
  x: camera.x + (point.x - size.width / 2) / camera.zoom,
  y: camera.y + (point.y - size.height / 2) / camera.zoom,
});
export const worldToScreen = (point: Point, camera: Camera, size: Size): Point => ({
  x: (point.x - camera.x) * camera.zoom + size.width / 2,
  y: (point.y - camera.y) * camera.zoom + size.height / 2,
});
export function zoomAt(camera: Camera, size: Size, point: Point, requested: number): Camera {
  const anchor = screenToWorld(point, camera, size),
    zoom = clampZoom(requested);
  return {
    x: anchor.x - (point.x - size.width / 2) / zoom,
    y: anchor.y - (point.y - size.height / 2) / zoom,
    zoom,
  };
}
export function fitCamera(points: Point[], size: Size, padding = 80): Camera {
  if (!points.length || size.width <= 0 || size.height <= 0) return { x: 0, y: 0, zoom: 1 };
  const xs = points.map((point) => point.x),
    ys = points.map((point) => point.y);
  const left = Math.min(...xs),
    right = Math.max(...xs),
    top = Math.min(...ys),
    bottom = Math.max(...ys);
  return {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    zoom: Math.min(
      1,
      clampZoom(
        Math.min(
          Math.max(1, size.width - padding * 2) / Math.max(1, right - left),
          Math.max(1, size.height - padding * 2) / Math.max(1, bottom - top),
        ),
      ),
    ),
  };
}
export function pinchCamera(
  camera: Camera,
  size: Size,
  start: readonly [Point, Point],
  current: readonly [Point, Point],
): Camera {
  const midpoint = (pair: readonly [Point, Point]) => ({
    x: (pair[0].x + pair[1].x) / 2,
    y: (pair[0].y + pair[1].y) / 2,
  });
  const distance = (pair: readonly [Point, Point]) =>
    Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
  const anchor = screenToWorld(midpoint(start), camera, size),
    middle = midpoint(current);
  const zoom = clampZoom((camera.zoom * distance(current)) / Math.max(1, distance(start)));
  return {
    x: anchor.x - (middle.x - size.width / 2) / zoom,
    y: anchor.y - (middle.y - size.height / 2) / zoom,
    zoom,
  };
}
