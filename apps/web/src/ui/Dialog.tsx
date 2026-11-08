import { useEffect, useRef, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { IconButton } from './IconButton.js';
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose(): void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    ref.current?.showModal();
    ref.current?.querySelector<HTMLElement>('input:not([type=hidden]),textarea,select')?.focus();
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={id}
      className={`dialog ${wide ? 'dialog-wide' : ''}`}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X />
        </IconButton>
      </header>
      {children}
    </dialog>,
    document.body,
  );
}
