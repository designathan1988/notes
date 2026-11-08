import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { TextSelection, type Transaction } from '@tiptap/pm/state';
import type { JSONContent } from '@tiptap/core';
import type { Page } from '../../../../packages/contracts/src/index.js';
import {
  addCanvasCard,
  canvasDescendants,
  canvasItems,
  connectCanvas,
  deleteCanvas,
  duplicateCanvas,
  groupCanvas,
  moveCanvas,
  orderCanvas,
  resizeCanvas,
  type CanvasItem,
} from '../../../../packages/editor/src/canvas-commands.js';
import { useSpatialView } from '../spatial/useSpatialView.js';
import { freeRect, type Point } from '../spatial/geometry.js';
import { useWorkspace } from '../state/store.js';
import { isolatedDocumentEdit } from '../documents/history.js';
import { flushSync } from 'react-dom';

export interface CanvasApi {
  addNote(point?: Point, content?: JSONContent[], focus?: boolean): string | undefined;
  preparePaste(): void;
  key(event: KeyboardEvent): boolean;
}
type Box = Point & { width: number; height: number };
interface Context extends CanvasApi {
  editor: Editor;
  page: Page;
  readOnly: boolean;
  items: CanvasItem[];
  selected: string[];
  select(id: string, extend?: boolean): void;
  clear(): void;
  tool: 'select' | 'hand' | 'connect';
  setTool(tool: Context['tool']): void;
  space: boolean;
  view: ReturnType<typeof useSpatialView>;
  box(id: string): Box | undefined;
  marquee: { start: Point; current: Point } | null;
  connection: { source: string; point: Point } | null;
  gesture(id: string, event: ReactPointerEvent<HTMLElement>, resize?: boolean): void;
  run(command: (tr: Transaction) => Transaction): boolean;
  remove(): void;
  duplicate(): void;
  group(): void;
  order(direction: 'front' | 'back'): void;
  inspector: boolean;
  setInspector(value: boolean): void;
  media(): void;
  link(): void;
}
const CanvasContext = createContext<Context | null>(null);
export function useCanvas() {
  const value = useContext(CanvasContext);
  if (!value) throw new Error('Canvas context is unavailable.');
  return value;
}
export function CanvasProvider({
  editor,
  page,
  readOnly,
  api,
  media,
  link,
  children,
}: {
  editor: Editor;
  page: Page;
  readOnly: boolean;
  api: { current: CanvasApi | null };
  media(): void;
  link(): void;
  children: ReactNode;
}) {
  const doc = useEditorState({ editor, selector: ({ editor }) => editor.state.doc });
  const items = canvasItems(doc),
    byId = new Map(items.map((item) => [item.id, item]));
  const saved = useWorkspace((state) => state.canvasCameras[page.id]);
  const [selected, setSelected] = useState<string[]>([]),
    [tool, setTool] = useState<Context['tool']>('select');
  const [inspector, setInspector] = useState(false),
    [space, setSpace] = useState(false);
  const [marquee, setMarquee] = useState<Context['marquee']>(null),
    [connection, setConnection] = useState<Context['connection']>(null);
  const [resizing, setResizing] = useState<{ id: string; width: number; height: number } | null>(
    null,
  );
  const cleanup = useRef<(() => void) | null>(null),
    selectionStart = useRef<Point | null>(null);
  const fresh = useRef({ readOnly });
  fresh.current = { readOnly };
  function run(command: (tr: Transaction) => Transaction) {
    if (fresh.current.readOnly || editor.isDestroyed) return false;
    try {
      isolatedDocumentEdit(editor, () => editor.view.dispatch(command(editor.state.tr)));
      return true;
    } catch (error) {
      useWorkspace.getState().setError(error);
      return false;
    }
  }
  function select(id: string, extend = false) {
    setSelected((ids) => (extend ? [...new Set([...ids, id])] : [id]));
    setInspector(true);
  }
  const view = useSpatialView({
    saved: saved ?? (!items.length ? { x: 0, y: 0, zoom: 1 } : undefined),
    points: items
      .filter((item) => item.node.type.name !== 'canvasEdge')
      .flatMap((item) => [
        { x: item.node.attrs.x, y: item.node.attrs.y },
        {
          x: item.node.attrs.x + item.node.attrs.width,
          y: item.node.attrs.y + item.node.attrs.height,
        },
      ]),
    itemPosition: (id) => {
      const item = byId.get(id);
      return item ? { x: item.node.attrs.x, y: item.node.attrs.y } : undefined;
    },
    contentAt: (target) => {
      const root = target.closest<HTMLElement>('[data-canvas-rich]');
      if (!root) return null;
      let element = target instanceof HTMLElement ? target : target.parentElement;
      while (element && root.contains(element)) {
        const style = getComputedStyle(element);
        if (
          (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight) ||
          (/(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth)
        )
          return element;
        if (element === root) break;
        element = element.parentElement;
      }
      return root;
    },
    commitCamera: (camera) => useWorkspace.getState().setCanvasCamera(page.id, camera),
    commitItem: (id, point) => {
      const item = canvasItems(editor.state.doc).find((item) => item.id === id);
      if (item)
        run((tr) =>
          moveCanvas(
            tr,
            selected.includes(id) ? selected : [id],
            point.x - item.node.attrs.x,
            point.y - item.node.attrs.y,
          ),
        );
    },
    select:
      tool === 'select' && !space
        ? {
            start(point) {
              selectionStart.current = point;
              setMarquee({ start: point, current: point });
            },
            move(point) {
              const start = selectionStart.current!;
              setMarquee({ start, current: point });
              const left = Math.min(start.x, point.x),
                right = Math.max(start.x, point.x),
                top = Math.min(start.y, point.y),
                bottom = Math.max(start.y, point.y);
              setSelected(
                items
                  .filter(
                    (item) =>
                      item.node.type.name === 'canvasCard' &&
                      item.node.attrs.x < right &&
                      item.node.attrs.x + item.node.attrs.width > left &&
                      item.node.attrs.y < bottom &&
                      item.node.attrs.y + item.node.attrs.height > top,
                  )
                  .map((item) => item.id),
              );
            },
            end(moved) {
              if (!moved) {
                setSelected([]);
                setInspector(false);
              } else setInspector(true);
              setMarquee(null);
            },
            cancel() {
              setMarquee(null);
            },
          }
        : undefined,
  });
  function box(id: string): Box | undefined {
    const item = byId.get(id);
    if (!item || item.node.type.name === 'canvasEdge') return;
    let x = item.node.attrs.x,
      y = item.node.attrs.y;
    if (view.draft) {
      const dragged = byId.get(view.draft.id),
        affected = canvasDescendants(
          items,
          selected.includes(view.draft.id) ? selected : [view.draft.id],
        );
      if (dragged && affected.has(id)) {
        x += view.draft.point.x - dragged.node.attrs.x;
        y += view.draft.point.y - dragged.node.attrs.y;
      }
    }
    return {
      x,
      y,
      width: resizing?.id === id ? resizing.width : item.node.attrs.width,
      height: resizing?.id === id ? resizing.height : item.node.attrs.height,
    };
  }
  function addNote(point?: Point, content?: JSONContent[], focus = true) {
    if (fresh.current.readOnly || editor.isDestroyed) return;
    const id = crypto.randomUUID(),
      available = Math.max(0, view.size.width - (view.size.width > 900 ? 220 : 0));
    const center =
      point ??
      view.toWorld({ x: available / 2, y: Math.min(220, Math.max(120, view.size.height * 0.35)) });
    let origin = { x: center.x - 150, y: center.y - 100 };
    if (!point) {
      const minimum = view.toWorld({ x: 24, y: 24 }),
        maximum = view.toWorld({ x: available - 24, y: view.size.height - 24 });
      try {
        origin = freeRect(
          { ...origin, width: 300, height: 200 },
          canvasItems(editor.state.doc)
            .filter((item) => item.node.type.name !== 'canvasEdge')
            .map((item) => ({
              x: item.node.attrs.x,
              y: item.node.attrs.y,
              width: item.node.attrs.width,
              height: item.node.attrs.height,
            })),
          { ...minimum, width: maximum.x - minimum.x, height: maximum.y - minimum.y },
        );
      } catch (error) {
        useWorkspace.getState().setError(error);
        return;
      }
    }
    let added = false;
    flushSync(() => {
      added = run((tr) => addCanvasCard(tr, id, origin.x, origin.y, content));
    });
    if (!added) return;
    if (!point) {
      const minimum = view.toWorld({ x: 24, y: 24 }),
        maximum = view.toWorld({ x: available - 24, y: view.size.height - 64 });
      if (
        origin.x < minimum.x ||
        origin.y < minimum.y ||
        origin.x + 300 > maximum.x ||
        origin.y + 200 > maximum.y
      ) {
        const zoom = Math.min(
          view.camera.zoom,
          Math.max(0.03, (available - 48) / 300),
          Math.max(0.03, (view.size.height - 96) / 200),
        );
        view.changeCamera({
          x: origin.x + 150 + (view.size.width - available) / 2 / zoom,
          y: origin.y + 100,
          zoom,
        });
      }
    }
    select(id);
    setTool('select');
    if (focus) {
      const item = canvasItems(editor.state.doc).find((item) => item.id === id);
      if (item) {
        editor.commands.setTextSelection(item.pos + 2);
        editor.view.dom.focus({ preventScroll: true });
        editor.view.focus();
      }
    }
    return id;
  }
  function preparePaste() {
    const $from = editor.state.selection.$from;
    for (let depth = $from.depth; depth > 0; depth--)
      if ($from.node(depth).type.name === 'canvasCard') return;
    const id = addNote(undefined, undefined, false),
      item = canvasItems(editor.state.doc).find((item) => item.id === id);
    if (item) editor.commands.setTextSelection(item.pos + 2);
  }
  function remove() {
    run((tr) => deleteCanvas(tr, selected));
    setSelected([]);
    setInspector(false);
  }
  function duplicate() {
    const before = new Set(canvasItems(editor.state.doc).map((item) => item.id));
    run((tr) => duplicateCanvas(tr, selected, () => crypto.randomUUID()));
    setSelected(
      canvasItems(editor.state.doc)
        .filter((item) => !before.has(item.id))
        .map((item) => item.id),
    );
  }
  function group() {
    const id = crypto.randomUUID();
    run((tr) => groupCanvas(tr, selected, id, 'Untitled group'));
    select(id);
  }
  function key(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target?.closest('input,textarea,select')) return false;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      if (target === editor.view.dom || target?.closest('[data-canvas-rich]')) {
        const { doc, selection } = editor.state;
        for (let depth = selection.$from.depth; depth > 0; depth--) {
          if (
            !['canvasCard', 'canvasGroup', 'canvasEdge'].includes(
              selection.$from.node(depth).type.name,
            )
          )
            continue;
          editor.view.dispatch(
            editor.state.tr.setSelection(
              TextSelection.between(
                doc.resolve(selection.$from.before(depth) + 1),
                doc.resolve(selection.$from.after(depth) - 1),
              ),
            ),
          );
          return true;
        }
      }
      setSelected(items.map((item) => item.id));
      setInspector(items.length > 0);
      return true;
    }
    const typing =
      !!target?.closest('input,textarea,[data-canvas-rich]') ||
      (target === editor.view.dom && editor.state.selection.$from.parent.isTextblock);
    if (event.key === 'Escape') {
      cleanup.current?.();
      setSelected([]);
      setInspector(false);
      setTool('select');
      setSpace(false);
      view.ref.current?.focus({ preventScroll: true });
      return true;
    }
    if (typing) return false;
    if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
      if (!readOnly) {
        if (event.shiftKey || event.key.toLowerCase() === 'y') editor.commands.redo();
        else editor.commands.undo();
      }
      return true;
    }
    if (event.code === 'Space') {
      setSpace(true);
      return true;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      remove();
      return true;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
      duplicate();
      return true;
    }
    if (event.key.toLowerCase() === 'n' && !event.ctrlKey && !event.metaKey) {
      addNote();
      return true;
    }
    if (event.key.toLowerCase() === 'h') {
      setTool('hand');
      return true;
    }
    if (event.key.toLowerCase() === 'v') {
      setTool('select');
      return true;
    }
    if (event.key.toLowerCase() === 'c' && !event.ctrlKey && !event.metaKey) {
      if (!readOnly) setTool('connect');
      return true;
    }
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      event.key
    ];
    if (delta && selected.length) {
      run((tr) =>
        moveCanvas(
          tr,
          selected,
          delta[0] * (event.shiftKey ? 80 : 20),
          delta[1] * (event.shiftKey ? 80 : 20),
        ),
      );
      return true;
    }
    return false;
  }
  function gesture(id: string, event: ReactPointerEvent<HTMLElement>, resize = false) {
    if (readOnly) return;
    select(id, event.shiftKey);
    if (!resize && tool !== 'connect') return;
    event.preventDefault();
    event.stopPropagation();
    cleanup.current?.();
    const initial = box(id);
    if (!initial) return;
    const element = event.currentTarget,
      pointer = event.pointerId,
      start = { x: event.clientX, y: event.clientY },
      zoom = view.camera.zoom;
    element.setPointerCapture(pointer);
    let last = { width: initial.width, height: initial.height };
    const point = (next: PointerEvent) => {
      const bounds = view.ref.current!.getBoundingClientRect();
      return view.toWorld({ x: next.clientX - bounds.left, y: next.clientY - bounds.top });
    };
    if (!resize) setConnection({ source: id, point: point(event.nativeEvent) });
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      if (resize) {
        last = {
          width: Math.max(120, initial.width + (next.clientX - start.x) / zoom),
          height: Math.max(80, initial.height + (next.clientY - start.y) / zoom),
        };
        setResizing({ id, ...last });
      } else setConnection({ source: id, point: point(next) });
    };
    const stop = () => {
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', end);
      element.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
      cleanup.current = null;
      setResizing(null);
      setConnection(null);
    };
    const end = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      if (resize) run((tr) => resizeCanvas(tr, id, last.width, last.height));
      else {
        const target = document
          .elementFromPoint(next.clientX, next.clientY)
          ?.closest<HTMLElement>('[data-canvas-element]')?.dataset.canvasElement;
        if (target) {
          const edge = crypto.randomUUID();
          run((tr) => connectCanvas(tr, edge, id, target));
          select(edge);
        }
      }
      stop();
    };
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    cleanup.current = stop;
  }
  useEffect(
    () => () => {
      cleanup.current?.();
      api.current = null;
    },
    [],
  );
  useEffect(() => {
    const release = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpace(false);
    };
    const blur = () => setSpace(false);
    window.addEventListener('keyup', release);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keyup', release);
      window.removeEventListener('blur', blur);
    };
  }, []);
  useEffect(() => {
    if (
      !saved &&
      view.size.width > 0 &&
      view.size.height > 0 &&
      useWorkspace.getState().workspaceId === page.workspaceId
    )
      useWorkspace.getState().setCanvasCamera(page.id, view.camera);
  }, [saved, view.size.width, view.size.height, page.id]);
  useEffect(() => {
    if (readOnly) cleanup.current?.();
  }, [readOnly]);
  useEffect(() => {
    setSelected((ids) =>
      ids.every((id) => byId.has(id)) ? ids : ids.filter((id) => byId.has(id)),
    );
  }, [doc]);
  const value: Context = {
    editor,
    page,
    readOnly,
    items,
    selected,
    select,
    clear: () => {
      setSelected([]);
      setInspector(false);
    },
    tool,
    setTool,
    space,
    view,
    box,
    marquee,
    connection,
    gesture,
    run,
    remove,
    duplicate,
    group,
    order: (direction) => run((tr) => orderCanvas(tr, selected, direction)),
    addNote,
    preparePaste,
    key,
    inspector,
    setInspector,
    media,
    link,
  };
  api.current = value;
  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}
