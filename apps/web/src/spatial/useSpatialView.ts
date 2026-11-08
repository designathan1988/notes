import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  fitCamera,
  pinchCamera,
  screenToWorld,
  validPoint,
  zoomAt,
  type Camera,
  type Point,
  type Size,
} from './geometry.js';

interface Options {
  saved?: Camera;
  points: Point[];
  commitCamera(camera: Camera): void;
  commitItem(id: string, point: Point): void;
  itemPosition(id: string): Point | undefined;
  contentAt?(target: Element): HTMLElement | null;
  select?: {
    start(point: Point): void;
    move(point: Point): void;
    end(moved: boolean): void;
    cancel(): void;
  };
}
type Gesture =
  | { type: 'pan'; start: Point; camera: Camera }
  | { type: 'item'; id: string; start: Point; position: Point; camera: Camera }
  | { type: 'select'; start: Point; camera: Camera; selection: NonNullable<Options['select']> }
  | {
      type: 'content';
      start: Point;
      camera: Camera;
      element: HTMLElement;
      left: number;
      top: number;
    }
  | { type: 'pinch'; start: [Point, Point]; camera: Camera };

/** Transient pointer state belongs here. Durable preferences/content stay with their capability owner. */
export function useSpatialView(options: Options) {
  const ref = useRef<HTMLDivElement>(null);
  const [attached, setAttached] = useState<HTMLDivElement | null>(null);
  const attach = useCallback((element: HTMLDivElement | null) => {
    ref.current = element;
    setAttached(element);
  }, []);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [ownCamera, setOwnCamera] = useState<Camera | null>(options.saved ?? null);
  const camera = ownCamera ?? fitCamera(options.points, size);
  const [draft, setDraft] = useState<{ id: string; point: Point } | null>(null);
  const [dragging, setDragging] = useState(false);
  const live = useRef({ options, size, camera });
  live.current = { options, size, camera };
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const moved = useRef(false),
    draftRef = useRef(draft),
    ignoreClick = useRef(false);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateCamera = (next: Camera) => {
    live.current.camera = next;
    setOwnCamera(next);
  };
  const setItemDraft = (next: typeof draft) => {
    draftRef.current = next;
    setDraft(next);
  };
  const pointAt = (event: { clientX: number; clientY: number }) => {
    const bounds = ref.current!.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [attached]);
  useEffect(() => {
    if (ownCamera === null && options.points.length && size.width > 0 && size.height > 0)
      setOwnCamera(fitCamera(options.points, size));
  }, [ownCamera, options.points, size]);
  const cancel = () => {
    if (gesture.current?.type === 'select') gesture.current.selection.cancel();
    if (gesture.current) {
      updateCamera(gesture.current.camera);
      ignoreClick.current = true;
    }
    pointers.current.clear();
    gesture.current = null;
    setItemDraft(null);
    setDragging(false);
  };
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  useEffect(() => {
    const blur = () => cancelRef.current();
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('blur', blur);
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
    };
  }, []);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      const content = live.current.options.contentAt?.(event.target as Element);
      if (
        content &&
        !event.ctrlKey &&
        !event.metaKey &&
        (content.scrollHeight > content.clientHeight || content.scrollWidth > content.clientWidth)
      )
        return;
      event.preventDefault();
      if (pointers.current.size) return;
      const { camera, size } = live.current;
      const delta =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1);
      updateCamera(
        zoomAt(
          camera,
          size,
          pointAt(event),
          camera.zoom * Math.exp(-Math.max(-400, Math.min(400, delta)) * 0.002),
        ),
      );
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => {
        wheelTimer.current = null;
        live.current.options.commitCamera(live.current.camera);
      }, 180);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [attached]);
  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as Element;
    const content = event.pointerType === 'touch' ? live.current.options.contentAt?.(target) : null;
    if (
      event.button !== 0 ||
      (target.closest('button, input, select, [data-spatial-control]') && !content)
    )
      return;
    if (wheelTimer.current) {
      clearTimeout(wheelTimer.current);
      wheelTimer.current = null;
    }
    const point = pointAt(event);
    pointers.current.set(event.pointerId, point);
    ignoreClick.current = false;
    const item = target.closest<SVGElement>('[data-spatial-item]');
    if (!content) (item ?? event.currentTarget).setPointerCapture(event.pointerId);
    if (pointers.current.size >= 2) {
      event.preventDefault();
      for (const pointer of pointers.current.keys()) event.currentTarget.setPointerCapture(pointer);
      if (gesture.current?.type === 'select') gesture.current.selection.cancel();
      setItemDraft(null);
      moved.current = true;
      ignoreClick.current = true;
      gesture.current = {
        type: 'pinch',
        start: [...pointers.current.values()].slice(0, 2) as [Point, Point],
        camera: live.current.camera,
      };
      setDragging(true);
    } else {
      moved.current = false;
      const id = item?.dataset.spatialItem,
        position = id ? live.current.options.itemPosition(id) : undefined;
      const selection = live.current.options.select;
      gesture.current = content
        ? {
            type: 'content',
            start: point,
            camera: live.current.camera,
            element: content,
            left: content.scrollLeft,
            top: content.scrollTop,
          }
        : id && position
          ? { type: 'item', id, start: point, position, camera: live.current.camera }
          : selection
            ? { type: 'select', start: point, camera: live.current.camera, selection }
            : { type: 'pan', start: point, camera: live.current.camera };
      if (gesture.current.type === 'select')
        selection!.start(screenToWorld(point, live.current.camera, live.current.size));
    }
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const point = pointAt(event),
      active = gesture.current;
    pointers.current.set(event.pointerId, point);
    if (!active) return;
    if (active.type === 'pinch') {
      event.preventDefault();
      if (pointers.current.size >= 2)
        updateCamera(
          pinchCamera(
            active.camera,
            live.current.size,
            active.start,
            [...pointers.current.values()].slice(0, 2) as [Point, Point],
          ),
        );
      return;
    }
    const dx = point.x - active.start.x,
      dy = point.y - active.start.y;
    if (!moved.current && Math.hypot(dx, dy) < 5) return;
    moved.current = true;
    ignoreClick.current = true;
    setDragging(true);
    if (active.type === 'content') {
      event.preventDefault();
      active.element.scrollLeft = active.left - dx / active.camera.zoom;
      active.element.scrollTop = active.top - dy / active.camera.zoom;
    } else if (active.type === 'pan')
      updateCamera({
        ...active.camera,
        x: active.camera.x - dx / active.camera.zoom,
        y: active.camera.y - dy / active.camera.zoom,
      });
    else if (active.type === 'select')
      active.selection.move(screenToWorld(point, active.camera, live.current.size));
    else {
      const next = {
        x: active.position.x + dx / active.camera.zoom,
        y: active.position.y + dy / active.camera.zoom,
      };
      if (validPoint(next)) setItemDraft({ id: active.id, point: next });
    }
  }
  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    const active = gesture.current;
    if (active?.type === 'item' && moved.current && draftRef.current)
      live.current.options.commitItem(active.id, draftRef.current.point);
    if (active?.type === 'select') active.selection.end(moved.current);
    if ((active?.type === 'pan' || active?.type === 'pinch') && moved.current)
      live.current.options.commitCamera(live.current.camera);
    setItemDraft(null);
    setDragging(false);
    if (pointers.current.size) {
      gesture.current = {
        type: 'pan',
        start: [...pointers.current.values()][0],
        camera: live.current.camera,
      };
      // A remaining finger after a pinch must never become a tap on a note.
      moved.current = true;
      ignoreClick.current = true;
    } else gesture.current = null;
  }
  function changeCamera(next: Camera) {
    updateCamera(next);
    live.current.options.commitCamera(next);
  }
  function zoom(factor: number) {
    const { size, camera } = live.current;
    changeCamera(
      zoomAt(camera, size, { x: size.width / 2, y: size.height / 2 }, camera.zoom * factor),
    );
  }
  return {
    ref,
    attach,
    size,
    camera,
    draft,
    dragging,
    changeCamera,
    zoom,
    fit: (points = live.current.options.points) =>
      changeCamera(fitCamera(points, live.current.size)),
    toWorld: (point: Point) => screenToWorld(point, live.current.camera, live.current.size),
    suppressClick: () => ignoreClick.current,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: cancel,
      onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => {
        if (pointers.current.has(event.pointerId)) cancel();
      },
    },
  };
}
