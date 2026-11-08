import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';

export function useRecordDrag(
  move: (id: string, value: string) => Promise<void>,
  error: (message: string) => void,
) {
  const root = useRef<HTMLDivElement>(null);
  const active = useRef<{
    id: string;
    title: string;
    x: number;
    y: number;
    started: boolean;
  } | null>(null);
  const [ghost, setGhost] = useState<{ title: string; x: number; y: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const callbacks = useRef({ move, error });
  callbacks.current = { move, error };
  useEffect(() => {
    const destination = (x: number, y: number) => {
      const target = document
        .elementsFromPoint(x, y)
        .map((element) => element.closest<HTMLElement>('[data-record-drop]'))
        .find((element) => element && root.current?.contains(element));
      return target?.dataset.recordDrop ?? null;
    };
    const pointerMove = (event: globalThis.PointerEvent) => {
      const drag = active.current;
      if (!drag) return;
      if (!drag.started && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
      drag.started = true;
      event.preventDefault();
      setGhost({ title: drag.title, x: event.clientX + 12, y: event.clientY + 12 });
      setOver(destination(event.clientX, event.clientY));
    };
    const finish = (event: globalThis.PointerEvent) => {
      const drag = active.current;
      active.current = null;
      setGhost(null);
      setOver(null);
      const target = destination(event.clientX, event.clientY);
      if (drag?.started && target !== null)
        void callbacks.current
          .move(drag.id, target)
          .catch((error) => callbacks.current.error(error.message));
    };
    const cancel = () => {
      active.current = null;
      setGhost(null);
      setOver(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    window.addEventListener('pointermove', pointerMove, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', escape);
    };
  }, []);
  return {
    root,
    over,
    begin: (id: string, title: string, event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      active.current = { id, title, x: event.clientX, y: event.clientY, started: false };
    },
    ghost: ghost
      ? createPortal(
          <div className="record-drag-ghost" style={{ left: ghost.x, top: ghost.y }}>
            {ghost.title}
          </div>,
          document.body,
        )
      : null,
  };
}
