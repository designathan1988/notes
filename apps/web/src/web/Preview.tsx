import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useEffectEvent,
} from 'react';
import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { api, json } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
import { ensureCopySourcesSaved } from '../documents/session.js';
import { sourceFingerprint, webSource } from '@note/editor/web';

interface Ticket {
  token: string;
  url: string;
  expiresAt: string;
}
export interface PreviewControls {
  run(): Promise<void>;
  stop(): void;
}
export const Preview = forwardRef<
  PreviewControls,
  {
    editor: Editor;
    pageId: string;
    getPos: () => number | undefined;
    visible: boolean;
    onRunning(running: boolean, source?: ProseMirrorNode): void;
  }
>(({ editor, pageId, getPos, visible, onRunning }, ref) => {
  const [ticket, setTicket] = useState<Ticket | null>(null),
    [error, setError] = useState(''),
    [starting, setStarting] = useState(false),
    [messages, setMessages] = useState<string[]>([]),
    [width, setWidth] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null),
    sequence = useRef(0),
    current = useRef<Ticket | null>(null),
    mounted = useRef(true);
  const identity = useWorkspace((state) => state.user?.id),
    workspace = useWorkspace((state) => state.workspaceId);
  function retire(value: Ticket | null) {
    if (value) void api(`/web-previews/${value.token}`, { method: 'DELETE' }).catch(() => {});
  }
  function stop() {
    sequence.current++;
    retire(current.current);
    current.current = null;
    setTicket(null);
    setStarting(false);
    setMessages([]);
    onRunning(false);
  }
  async function run() {
    const operation = ++sequence.current,
      actor = identity,
      space = workspace;
    setError('');
    setStarting(true);
    try {
      const page = useWorkspace.getState().pages.find((page) => page.id === pageId);
      if (!actor || !space || !page) throw new Error('Reopen this page before running its source.');
      await ensureCopySourcesSaved(actor, space, [page]);
      const position = getPos(),
        node = position === undefined ? null : editor.state.doc.nodeAt(position);
      if (!node || !['webPage', 'webComponent'].includes(node.type.name))
        throw new Error('The website source was removed.');
      const fingerprint = await sourceFingerprint(webSource(node.toJSON()));
      const next = await api<Ticket>(`/pages/${pageId}/web-preview`, {
        method: 'POST',
        body: json({ position, fingerprint }),
      });
      if (
        !mounted.current ||
        operation !== sequence.current ||
        actor !== useWorkspace.getState().user?.id ||
        space !== useWorkspace.getState().workspaceId
      ) {
        retire(next);
        return;
      }
      retire(current.current);
      current.current = next;
      setMessages([]);
      setTicket(next);
      onRunning(true, node);
    } catch (error) {
      if (mounted.current && operation === sequence.current) setError((error as Error).message);
    } finally {
      if (mounted.current && operation === sequence.current) setStarting(false);
    }
  }
  useImperativeHandle(ref, () => ({ run, stop }));
  useEffect(() => {
    const alive = mounted,
      operations = sequence,
      running = current;
    alive.current = true;
    return () => {
      // Leaving this page, workspace or identity ends the running preview and its requests.
      alive.current = false;
      operations.current++;
      retire(running.current);
      running.current = null;
    };
  }, [identity, workspace, pageId]);
  // A failed renewal is an event: it stops whatever preview is current at that moment.
  const expire = useEffectEvent((token: string) => {
    if (current.current?.token === token) {
      stop();
      setError('Preview access expired or changed. Run the current source again.');
    }
  });
  useEffect(() => {
    if (!ticket) return;
    const receive = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== new URL(ticket.url).origin ||
        !event.data ||
        typeof event.data !== 'object' ||
        event.data.type !== 'note-runtime-error' ||
        event.data.instance !== ticket.token ||
        typeof event.data.message !== 'string' ||
        event.data.message.length > 4096
      )
        return;
      setMessages((previous) =>
        previous.length < 32 ? [...previous, event.data.message] : previous,
      );
    };
    const renewal = setInterval(() => {
      void api(`/web-previews/${ticket.token}/renew`, { method: 'POST', body: '{}' }).catch(() =>
        expire(ticket.token),
      );
    }, 120000);
    window.addEventListener('message', receive);
    return () => {
      clearInterval(renewal);
      window.removeEventListener('message', receive);
    };
  }, [ticket]);
  return (
    <section className="web-preview" aria-label="Website preview" hidden={!visible}>
      <div className="web-viewport-tools">
        <span>Preview</span>
        <div role="group" aria-label="Preview width">
          {[
            [0, 'Full'],
            [390, '390'],
            [768, '768'],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={width === value}
              onClick={() => setWidth(Number(value))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="web-preview-stage">
        {ticket ? (
          <iframe
            ref={frame}
            title="Rendered website"
            src={ticket.url}
            sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-popups"
            allow="fullscreen; clipboard-write"
            referrerPolicy="no-referrer"
            style={{ width: width ? `${width}px` : '100%' }}
          />
        ) : (
          <div className="web-preview-empty">
            <p>{starting ? 'Preparing the saved website…' : 'Run the website to preview it.'}</p>
            <button className="button" disabled={starting} onClick={() => void run()}>
              Run website
            </button>
          </div>
        )}
      </div>
      {error && (
        <p className="web-runtime-error" role="alert">
          {error}
        </p>
      )}
      <details className="web-console">
        <summary>Console ({messages.length} errors)</summary>
        {messages.length ? (
          messages.map((message, index) => <pre key={index}>{message}</pre>)
        ) : (
          <p>No runtime errors.</p>
        )}
      </details>
    </section>
  );
});
