import { t } from '../i18n/index.js';
import { useEffect, useRef, useState } from 'react';
import { AppWindow, ArrowUpRight, Check, Database, FileText, Shapes, Feather } from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import { pageView } from '../workbench/route.js';

type Kind = 'page' | 'web' | 'database' | 'canvas';
const kinds: { kind: Kind; label: string; Icon: typeof FileText }[] = [
  { kind: 'page', label: 'Page', Icon: FileText },
  { kind: 'web', label: 'Document', Icon: AppWindow },
  { kind: 'database', label: 'Database', Icon: Database },
  { kind: 'canvas', label: 'Canvas', Icon: Shapes },
];

/**
 * A second brain lives or dies by capture. The dock floats at the bottom of every reading view:
 * type a thought, press Enter, and it becomes a note without leaving what you were doing.
 * It opens fast and closes with a grace period, so moving the pointer away never loses it.
 */
export function CaptureDock() {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<Kind>('page');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{
    id: string;
    title: string;
    kind: Parameters<typeof pageView>[0];
  } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLFormElement>(null);
  const closing = useRef<number>(0);
  // The close check runs later than the render that scheduled it, so it reads the live text.
  const current = useRef('');
  current.current = text;

  // Ctrl/⌘ + . jots from anywhere.
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === '.') {
        event.preventDefault();
        setOpen(true);
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(null), 5000);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const show = () => {
    window.clearTimeout(closing.current);
    setOpen(true);
  };
  const hide = () => {
    window.clearTimeout(closing.current);
    closing.current = window.setTimeout(() => {
      if (!root.current?.contains(document.activeElement) && !current.current) setOpen(false);
    }, 320);
  };

  async function capture(openAfter: boolean) {
    const title = text.trim();
    const state = useWorkspace.getState();
    if (busy) return;
    setBusy(true);
    try {
      if (kind === 'web') {
        await state.createWebPage(null, { title });
      } else if (!title) {
        await state.createQuickPage(null, kind === 'page' ? 'document' : kind);
      } else {
        const page = await state.createPage(
          { title, kind: kind === 'page' ? 'document' : kind },
          { navigate: false },
        );
        if (openAfter) state.openTab(page.id, pageView(page.kind));
        else setSaved({ id: page.id, title: page.title, kind: page.kind });
      }
      setText('');
      if (openAfter || kind === 'web' || !title) setOpen(false);
      // Captured in place: the field stays ready for the next thought.
      else input.current?.focus();
    } catch (error) {
      state.setError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      ref={root}
      className="capture-dock"
      data-open={open || undefined}
      aria-label={t('Capture')}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
      onSubmit={(event) => {
        event.preventDefault();
        void capture(false);
      }}
    >
      <div className="capture-kinds" role="radiogroup" aria-label={t('Capture as')}>
        {kinds.map(({ kind: value, label, Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            data-kind={value}
            onClick={() => {
              setKind(value);
              input.current?.focus();
            }}
          >
            <Icon size={13} />
            {t(label)}
          </button>
        ))}
      </div>
      <div className="capture-field">
        <Feather size={16} aria-hidden="true" />
        <input
          ref={input}
          value={text}
          readOnly={busy}
          aria-busy={busy || undefined}
          aria-label={t('Capture a thought')}
          placeholder={t('Jot something down…')}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.currentTarget.blur();
              setOpen(false);
            }
            if (event.key === 'Enter' && (event.shiftKey || event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void capture(true);
            }
          }}
        />
        {saved ? (
          <button
            type="button"
            className="capture-saved"
            onClick={() => {
              useWorkspace.getState().openTab(saved.id, pageView(saved.kind));
              setSaved(null);
            }}
          >
            <Check size={14} />
            <span>{t('Saved')}</span>
            <ArrowUpRight size={13} />
          </button>
        ) : (
          <kbd className="capture-hint">{open ? '↵' : 'Ctrl .'}</kbd>
        )}
      </div>
    </form>
  );
}
