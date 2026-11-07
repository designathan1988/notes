import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useWorkspace } from '../state/store.js';
type Target = {
  id: string | null;
  parentId: string | null;
  beforeId: string | null;
  edge: 'before' | 'after' | 'inside';
};
export function useTreeDrag() {
  const [target, setTarget] = useState<Target | null>(null);
  const [label, setLabel] = useState('');
  const cleanup = useRef<(() => void) | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => () => cleanup.current?.(), []);
  function start(event: ReactPointerEvent<HTMLElement>) {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-tree-page]');
    const id = row?.dataset.treePage;
    if (!id || event.button !== 0 || (event.target as HTMLElement).closest('.tree-toggle')) return;
    const state = useWorkspace.getState();
    const source = state.pages.find((page) => page.id === id);
    if (
      !source ||
      source.kind === 'record' ||
      state.workspaces.find((item) => item.id === state.workspaceId)?.role === 'viewer'
    )
      return;
    event.preventDefault();
    const x = event.clientX,
      y = event.clientY,
      pointer = event.pointerId;
    let active = false,
      destination: Target | null = null;
    const previous = document.body.style.userSelect;
    const descendants = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const page of state.pages)
        if (page.parentId && descendants.has(page.parentId) && !descendants.has(page.id)) {
          descendants.add(page.id);
          changed = true;
        }
    }
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      if (!active && Math.hypot(next.clientX - x, next.clientY - y) < 7) return;
      active = true;
      suppressClick.current = true;
      document.body.style.userSelect = 'none';
      setLabel(source.title);
      const element = document
        .elementFromPoint(next.clientX, next.clientY)
        ?.closest<HTMLElement>('[data-tree-page],[data-tree-root]');
      destination = null;
      if (element?.hasAttribute('data-tree-root'))
        destination = { id: null, parentId: null, beforeId: null, edge: 'inside' };
      else if (element?.dataset.treePage && !descendants.has(element.dataset.treePage)) {
        const page = useWorkspace
          .getState()
          .pages.find((page) => page.id === element.dataset.treePage);
        if (page) {
          const rect = element.getBoundingClientRect(),
            ratio = (next.clientY - rect.top) / rect.height;
          if (ratio > 0.25 && ratio < 0.75 && page.kind === 'document')
            destination = { id: page.id, parentId: page.id, beforeId: null, edge: 'inside' };
          else {
            const siblings = useWorkspace
              .getState()
              .pages.filter((item) => item.parentId === page.parentId && item.id !== id)
              .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
            const after = ratio >= 0.5;
            destination = {
              id: page.id,
              parentId: page.parentId,
              beforeId: after
                ? (siblings[siblings.findIndex((item) => item.id === page.id) + 1]?.id ?? null)
                : page.id,
              edge: after ? 'after' : 'before',
            };
          }
        }
      }
      setTarget(destination);
      const scroller = element?.closest('.sidebar-scroll');
      if (scroller) {
        const rect = scroller.getBoundingClientRect();
        if (next.clientY > rect.bottom - 35) scroller.scrollTop += 16;
        else if (next.clientY < rect.top + 35) scroller.scrollTop -= 16;
      }
    };
    const stop = () => {
      document.body.style.userSelect = previous;
      setTarget(null);
      setLabel('');
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', finish, true);
      document.removeEventListener('pointercancel', cancel, true);
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('blur', cancel);
      cleanup.current = null;
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    };
    const finish = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      const drop = destination;
      stop();
      if (active && drop)
        void useWorkspace
          .getState()
          .movePage(id, drop.parentId, drop.beforeId)
          .catch(useWorkspace.getState().setError);
    };
    const cancel = () => stop();
    const escape = (key: KeyboardEvent) => {
      if (key.key === 'Escape') stop();
    };
    cleanup.current = stop;
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', finish, true);
    document.addEventListener('pointercancel', cancel, true);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('blur', cancel);
  }
  return {
    target,
    label,
    start,
    captureClick(event: React.MouseEvent) {
      if (suppressClick.current) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}
