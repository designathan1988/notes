import { useEffect,useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton.js';
export function Dialog({ title,children,onClose,wide=false }: { title: string; children: ReactNode; onClose(): void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); },[]);
  return <dialog ref={ref} className={`dialog ${wide ? 'dialog-wide' : ''}`} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header><h2>{title}</h2><IconButton label="Close dialog" onClick={onClose}><X/></IconButton></header>{children}
  </dialog>;
}
