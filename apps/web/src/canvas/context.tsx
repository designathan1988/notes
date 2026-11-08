import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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
import { freeRect, fitCamera, type Point } from '../spatial/geometry.js';
import { useWorkspace } from '../state/store.js';
import { isolatedDocumentEdit } from '../documents/history.js';
import { flushSync } from 'react-dom';
import type { ClipboardContent } from '../documents/capture.js';
import { canvasBoxes } from '../../../../packages/editor/src/canvas-containment.js';
import { headingPositions } from '../../../../packages/editor/src/outline.js';

export interface CanvasApi {
  addNote(point?: Point, content?: JSONContent[], focus?: boolean): string | undefined;
  preparePaste(): void;
  key(event: KeyboardEvent): boolean;
  revealHeading(index: number): void;
}
type Box = Point & { width: number; height: number };
interface Context extends CanvasApi {
  editor: Editor;
  page: Page;
  readOnly: boolean;
  items: CanvasItem[];
  selected: string[];
  select(id: string, extend?: boolean, inspect?: boolean): void;
  focusStage(): void;
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
  capture(input: ClipboardContent, point?: Point): void;
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
  capture,
  children,
}: {
  editor: Editor;
  page: Page;
  readOnly: boolean;
  api: { current: CanvasApi | null };
  media(): void;
  link(): void;
  capture(input: ClipboardContent, point?: Point): void;
  children: ReactNode;
}) {
  const doc = useEditorState({ editor, selector: ({ editor }) => editor.state.doc });
  const items = useMemo(() => canvasItems(doc), [doc]),
    byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]),
    frames = useMemo(() => canvasBoxes(items), [items]);
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
  const visibleFrames = useMemo(() => {
    const frame = resizing && frames.get(resizing.id);
    return resizing && frame
      ? canvasBoxes(
          items,
          new Map([[resizing.id, { ...frame, width: resizing.width, height: resizing.height }]]),
        )
      : frames;
  }, [items, frames, resizing]);
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
  function select(id: string, extend = false, inspect = true) {
    setSelected((ids) => (extend ? [...new Set([...ids, id])] : [id]));
    setInspector(inspect);
  }
  function focusStage() {
    view.ref.current
      ?.querySelector<HTMLElement>('[data-canvas-focus]')
      ?.focus({ preventScroll: true });
  }
  const view = useSpatialView({
    saved: saved ?? (!items.length ? { x: 0, y: 0, zoom: 1 } : undefined),
    points: [...frames.values()].flatMap((frame) => [
      { x: frame.x, y: frame.y },
      { x: frame.x + frame.width, y: frame.y + frame.height },
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
  const moving = useMemo(() => {
    const draft = view.draft,
      dragged = draft && byId.get(draft.id);
    if (!draft || !dragged) return null;
    return {
      dx: draft.point.x - dragged.node.attrs.x,
      dy: draft.point.y - dragged.node.attrs.y,
      affected: canvasDescendants(items, selected.includes(draft.id) ? selected : [draft.id]),
    };
  }, [view.draft, byId, items, selected]);
  function box(id: string): Box | undefined {
    const item = byId.get(id);
    const frame = visibleFrames.get(id);
    if (!item || !frame) return;
    let { x, y } = frame;
    if (moving?.affected.has(id)) {
      x += moving.dx;
      y += moving.dy;
    }
    return {
      x,
      y,
      width: frame.width,
      height: frame.height,
    };
  }
  function revealHeading(index: number) {
    const position = headingPositions(editor.state.doc)[index];
    const target = position === undefined ? null : editor.view.nodeDOM(position);
    if (!(target instanceof HTMLElement)) return;
    const card = target.closest<HTMLElement>('[data-canvas-card]'),
      id = card?.dataset.canvasCard;
    const frame = id && box(id);
    if (!frame) return;
    const rich = target.closest<HTMLElement>('.canvas-card-rich');
    if (rich) {
      const bounds = target.getBoundingClientRect(),
        container = rich.getBoundingClientRect();
      rich.scrollTop +=
        (bounds.top - container.top) / view.camera.zoom -
        (rich.clientHeight - bounds.height / view.camera.zoom) / 2;
    }
    select(id, false, false);
    setTool('select');
    view.changeCamera(
      fitCamera(
        [
          { x: frame.x, y: frame.y },
          { x: frame.x + frame.width, y: frame.y + frame.height },
        ],
        view.size,
        24,
      ),
    );
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
    select(id, false, !focus);
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
  function currentTextSelection() {
    const { view, state } = editor,
      native = view.dom.ownerDocument.getSelection();
    // A click can move the native caret before its selectionchange event reaches
    // ProseMirror. Resolve this shortcut from that caret, not the previous note.
    if (
      !native?.anchorNode ||
      !native.focusNode ||
      !view.dom.contains(native.anchorNode) ||
      !view.dom.contains(native.focusNode)
    )
      return state.selection;
    return TextSelection.between(
      state.doc.resolve(view.posAtDOM(native.anchorNode, native.anchorOffset)),
      state.doc.resolve(view.posAtDOM(native.focusNode, native.focusOffset)),
    );
  }
  function key(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target?.closest('input,textarea,select,.cm-editor,[data-web-workspace]')) return false;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      if (target === editor.view.dom || target?.closest('[data-canvas-rich]')) {
        const { doc } = editor.state,
          selection = currentTextSelection();
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
          if (readOnly) {
            const surface = target.closest<HTMLElement>('[data-canvas-rich]');
            if (surface) {
              const range = surface.ownerDocument.createRange();
              range.selectNodeContents(surface);
              const selection = surface.ownerDocument.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
          }
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
    const boundary =
      (event.ctrlKey || event.metaKey) &&
      (event.key === 'Home' || (event.metaKey && event.key === 'ArrowUp'))
        ? 'start'
        : (event.ctrlKey || event.metaKey) &&
            (event.key === 'End' || (event.metaKey && event.key === 'ArrowDown'))
          ? 'end'
          : null;
    if (!readOnly && typing && boundary) {
      const { doc } = editor.state,
        selection = currentTextSelection();
      for (let depth = selection.$from.depth; depth > 0; depth--) {
        if (
          !['canvasCard', 'canvasGroup', 'canvasEdge'].includes(
            selection.$from.node(depth).type.name,
          )
        )
          continue;
        const position = selection.$from.before(depth),
          range = TextSelection.between(
            doc.resolve(position + 1),
            doc.resolve(selection.$from.after(depth) - 1),
          ),
          endpoint = boundary === 'start' ? range.from : range.to,
          anchor = event.shiftKey
            ? Math.max(range.from, Math.min(range.to, selection.anchor))
            : endpoint;
        editor.view.dispatch(
          editor.state.tr.setSelection(
            TextSelection.between(doc.resolve(anchor), doc.resolve(endpoint)),
          ),
        );
        editor.view.focus();
        const wrapper = editor.view.nodeDOM(position),
          surface =
            wrapper instanceof HTMLElement
              ? wrapper.querySelector<HTMLElement>('[data-canvas-rich]')
              : null;
        if (surface) surface.scrollTop = boundary === 'start' ? 0 : surface.scrollHeight;
        return true;
      }
    }
    if (event.key === 'Escape') {
      cleanup.current?.();
      setSelected([]);
      setInspector(false);
      setTool('select');
      setSpace(false);
      focusStage();
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
    const toolKey = !event.ctrlKey && !event.metaKey && !event.altKey;
    if (event.key.toLowerCase() === 'n' && toolKey) {
      addNote();
      return true;
    }
    if (event.key.toLowerCase() === 'h' && toolKey) {
      setTool('hand');
      return true;
    }
    if (event.key.toLowerCase() === 'v' && toolKey) {
      setTool('select');
      return true;
    }
    if (event.key.toLowerCase() === 'c' && toolKey) {
      if (!readOnly) setTool('connect');
      return true;
    }
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      event.key
    ];
    const resizingId = target
      .closest('.canvas-resize')
      ?.closest<HTMLElement>('[data-canvas-element]')?.dataset.canvasElement;
    if (delta && resizingId) {
      const frame = box(resizingId),
        step = event.shiftKey ? 80 : 20;
      if (frame)
        run((tr) =>
          resizeCanvas(
            tr,
            resizingId,
            frame.width + delta[0] * step,
            frame.height + delta[1] * step,
          ),
        );
      return true;
    }
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
    if (readOnly) {
      cleanup.current?.();
      view.cancelItem();
    }
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
    focusStage,
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
    revealHeading,
    inspector,
    setInspector,
    media,
    link,
    capture,
  };
  api.current = value;
  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}
