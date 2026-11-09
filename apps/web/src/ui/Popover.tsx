import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
export function Popover({
  anchor,
  label,
  close,
  children,
  role = 'menu',
}: {
  anchor: HTMLElement | null;
  label: string;
  close(): void;
  children: ReactNode;
  role?: 'menu' | 'dialog';
}) {
  const root = useRef<HTMLDivElement>(null),
    [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const place = () => {
      const box = anchor?.getBoundingClientRect(),
        width = root.current?.offsetWidth ?? 248,
        height = root.current?.offsetHeight ?? 280;
      setPosition({
        left: Math.max(8, Math.min(box?.left ?? innerWidth / 2, innerWidth - width - 8)),
        top: Math.max(8, Math.min((box?.bottom ?? 100) + 5, innerHeight - height - 8)),
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]);
  // Clicking outside is an event: it must call the latest close without re-running the effect.
  const dismiss = useEffectEvent(() => close());
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const element = root.current;
    if (role === 'menu')
      element
        // Buttons that declare their own role (e.g. menuitemradio) keep it.
        ?.querySelectorAll('button:not([role])')
        .forEach((button) => button.setAttribute('role', 'menuitem'));
    const initial =
      role === 'dialog' ? element?.querySelector<HTMLElement>('[aria-selected="true"]') : null;
    (initial ?? element?.querySelector<HTMLElement>('button:not(:disabled),input'))?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node) && !anchor?.contains(event.target as Node))
        dismiss();
    };
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      if (
        previous?.isConnected &&
        (element?.contains(document.activeElement) || document.activeElement === document.body)
      )
        previous.focus();
    };
  }, [anchor, role]);
  return createPortal(
    <div
      ref={root}
      role={role}
      aria-label={label}
      className="app-popover"
      style={position}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        if (role === 'menu' && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault();
          const items = [
              ...root.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
            ],
            index = items.indexOf(document.activeElement as HTMLButtonElement);
          items[
            (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
          ]?.focus();
        }
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
