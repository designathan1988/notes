import { sourceMessage } from '../i18n/index.js';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { api } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
import { snapshotAcknowledgementCovers } from './durability.js';
import { openRecovery, type Recovery } from './recovery.js';
import { DOCUMENT_ACCESS_CHANGED, type Page, type SaveStatus } from '@note/contracts';
import type { ProsemirrorMapping } from '@tiptap/y-tiptap';
const activeSessions = new Set<DocumentSession>();
/** Copy only acknowledged content; retained drafts are never silently omitted or discarded. */
export async function ensureCopySourcesSaved(
  identity: string,
  workspace: string,
  pages: { id: string; generation: number; title: string }[],
) {
  const ids = new Set(pages.map((page) => page.id));
  await Promise.all(
    [...activeSessions]
      .filter(
        (session) =>
          session.identity === identity &&
          session.page.workspaceId === workspace &&
          ids.has(session.page.id),
      )
      .map((session) => session.whenDurable()),
  );
  if (!globalThis.indexedDB) return;
  const recovery = await openRecovery();
  try {
    const pending = new Set(await recovery.pendingIdentity(identity));
    const current = () => {
      const state = useWorkspace.getState();
      return state.user?.id === identity && state.workspaceId === workspace;
    };
    for (const page of pages) {
      const key = `${identity}:${workspace}:${page.id}:${page.generation}`;
      if (!pending.has(key)) continue;
      let confirmed = false;
      try {
        const retained = await recovery.read(key);
        if (retained && current()) {
          // Initial sync can be interrupted after the bytes are durable but before
          // the socket acknowledgement arrives. Verify rather than assume that a
          // retained pending marker represents unpublished work.
          const ack = await api<{ pageId: string; generation: number; snapshot: string }>(
            `/pages/${page.id}/document/acknowledgement`,
          );
          if (
            current() &&
            ack.pageId === page.id &&
            ack.generation === page.generation &&
            snapshotAcknowledgementCovers(retained, ack.snapshot)
          )
            // Compare in the same IndexedDB transaction that clears the flag. A
            // newer local write must remain pending, including an unsent deletion.
            confirmed = await recovery.acknowledge(key, retained);
        }
      } catch {
        // Unavailable/unauthorized verification never discards local recovery.
      }
      if (!confirmed)
        throw new Error(
          sourceMessage(
            'Open “{{title}}” to synchronize its local draft before copying. Your local content has been kept.',
            { title: page.title },
          ),
        );
    }
  } finally {
    recovery.close();
  }
}
export async function assertIdentityCanSignOut(identity: string) {
  if ([...activeSessions].some((session) => session.identity === identity && session.dirty))
    throw new Error(
      'Some edits are saved only on this device. Reconnect and reopen your edited pages before signing out. Your local drafts have been kept.',
    );
  if (!globalThis.indexedDB) return;
  const recovery = await openRecovery();
  try {
    if ((await recovery.pendingIdentity(identity)).length)
      throw new Error(
        'Some edits are saved only on this device. Reconnect and reopen your edited pages before signing out. Your local drafts have been kept.',
      );
  } finally {
    recovery.close();
  }
}
export async function closeIdentitySessions(identity: string) {
  await Promise.all(
    [...activeSessions]
      .filter((session) => session.identity === identity)
      .map((session) => session.destroy()),
  );
}
export class DocumentSession {
  private status: SaveStatus = 'connecting';
  private readonly observers = new Set<() => void>();
  getStatus = () => this.status;
  subscribeStatus = (listener: () => void) => {
    this.observers.add(listener);
    return () => {
      this.observers.delete(listener);
    };
  };
  async whenDurable() {
    if (!this.dirty && ['saved', 'read-only'].includes(this.status)) {
      await Promise.allSettled(this.recoveryWrites);
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        unsubscribe();
      };
      const check = () => {
        if (this.destroyed || this.status === 'error' || this.status === 'local') {
          cleanup();
          reject(
            new Error(
              'Save or recover the source page before copying it. Your local content has been kept.',
            ),
          );
        } else if (!this.dirty && ['saved', 'read-only'].includes(this.status)) {
          cleanup();
          resolve();
        }
      };
      const unsubscribe = this.subscribeStatus(check),
        timeout = setTimeout(() => {
          cleanup();
          reject(
            new Error('The source has not finished saving. Keep it open, then retry the copy.'),
          );
        }, 15000);
      if (this.connected) this.provider?.sendStateless('checkpoint');
      check();
    });
    await Promise.allSettled(this.recoveryWrites);
  }
  get identity() {
    return this.userId;
  }
  private readonly recoveryWrites = new Set<Promise<void>>();
  private recoverySerial = 0;
  readonly doc = new Y.Doc();
  /** Links Yjs types to editor nodes; one per document, shared by whichever editor binds it. */
  readonly mapping: ProsemirrorMapping = new Map();
  provider!: HocuspocusProvider;
  recovery: Recovery | null = null;
  destroyed = false;
  connected = false;
  readOnly = false;
  dirty = false;
  locallySaved = false;
  private readonly userId: string;
  private readonly key: string;
  private lastAcknowledgement = '';
  private accessRefresh = 0;
  constructor(readonly page: Page) {
    this.userId = useWorkspace.getState().user!.id;
    this.key = `${this.userId}:${page.workspaceId}:${page.id}:${page.generation}`;
    activeSessions.add(this);
  }
  private reportError(error: unknown) {
    const state = useWorkspace.getState();
    if (
      this.destroyed ||
      state.user?.id !== this.userId ||
      state.workspaceId !== this.page.workspaceId
    )
      return;
    state.setPageError(this.page.id, error);
  }
  private setStatus(status: SaveStatus) {
    if (!this.destroyed) {
      this.status = status;
      for (const listener of this.observers) listener();
    }
    if (!this.destroyed && useWorkspace.getState().selectedId === this.page.id)
      useWorkspace.getState().setSaveStatus(status);
  }
  setReadOnly(readOnly: boolean) {
    if (this.destroyed || this.readOnly === readOnly) return;
    this.readOnly = readOnly;
    if (readOnly) this.setStatus('read-only');
    else {
      this.setStatus(this.connected ? 'connecting' : this.locallySaved ? 'local' : 'connecting');
      if (this.connected) {
        // A newly permitted writer may have a retained local update the server has not seen.
        this.provider.forceSync();
        this.provider.sendStateless('checkpoint');
      }
    }
  }
  async start() {
    this.setStatus('connecting');
    const config = await api<{ generation: number; readOnly: boolean }>(
      `/pages/${this.page.id}/document`,
    );
    this.readOnly = config.readOnly;
    if (config.generation !== this.page.generation)
      throw new Error('This document changed. Reload before recovering it.');
    try {
      this.recovery = await openRecovery();
      const retained = (await this.recovery.pendingIdentity(this.userId)).some(
        (key) =>
          key.startsWith(`${this.userId}:${this.page.workspaceId}:${this.page.id}:`) &&
          key !== this.key,
      );
      if (retained)
        this.reportError(
          'A local draft from before this page was restored is retained on this device. Download local drafts in Settings → Data to recover your work.',
        );
      const update = await this.recovery.read(this.key);
      if (update) {
        Y.applyUpdate(this.doc, update, 'recovery');
        this.dirty = true;
      }
    } catch {
      this.reportError(
        'Local recovery is unavailable. Keep this tab open until changes are saved to the server.',
      );
    }
    if (this.destroyed) {
      this.recovery?.close();
      return;
    }
    this.doc.on('update', this.onUpdate);
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.provider = new HocuspocusProvider({
      url: `${protocol}//${location.host}/collaboration`,
      name: `${this.page.id}:${this.page.generation}`,
      document: this.doc,
      token: 'cookie-session',
      onStatus: ({ status }) => {
        this.connected = status === 'connected';
        if (!this.connected)
          this.setStatus(this.readOnly ? 'read-only' : this.locallySaved ? 'local' : 'connecting');
      },
      onSynced: () => {
        this.connected = true;
        if (this.readOnly) this.setStatus('read-only');
        this.provider.sendStateless('checkpoint');
      },
      onClose: ({ event }) => {
        if (event.reason !== DOCUMENT_ACCESS_CHANGED || this.destroyed) return;
        this.connected = false;
        this.setStatus(this.readOnly ? 'read-only' : this.locallySaved ? 'local' : 'connecting');
        void this.resume(true);
      },
      onStateless: ({ payload }) => {
        try {
          const ack = JSON.parse(payload);
          if (ack.type === 'save-error') {
            this.setStatus('error');
            this.reportError(ack.message);
          } else if (
            ack.type === 'durable' &&
            ack.pageId === this.page.id &&
            ack.generation === this.page.generation
          ) {
            this.lastAcknowledgement = ack.snapshot;
            if (snapshotAcknowledgementCovers(Y.encodeStateAsUpdate(this.doc), ack.snapshot)) {
              this.dirty = false;
              if (this.recovery) {
                const clearing = this.recovery.setPending(this.key, false).catch(() => {
                  this.reportError(
                    'Could not update local recovery. Reopen this page before signing out.',
                  );
                });
                this.recoveryWrites.add(clearing);
                void clearing.finally(() => this.recoveryWrites.delete(clearing));
              }
              this.setStatus(this.readOnly ? 'read-only' : 'saved');
            }
          }
        } catch {
          /* Ignore unrelated protocol messages. */
        }
      },
      onAuthenticationFailed: () => {
        this.setStatus('error');
        this.reportError('Access to this document changed. Your local draft has not been sent.');
      },
    });
    this.provider.setAwarenessField('user', {
      name: useWorkspace.getState().user!.name,
      color: '#5865e8',
    });
    window.addEventListener('beforeunload', this.beforeUnload);
    window.addEventListener('offline', this.onOffline);
    window.addEventListener('online', this.onOnline);
  }
  private onOffline = () => {
    this.connected = false;
    this.provider.disconnect();
    if (this.dirty) this.setStatus(this.locallySaved ? 'local' : 'error');
  };
  private onOnline = () => {
    if (!this.destroyed) void this.resume(false);
  };
  private async resume(rejoin: boolean) {
    const sequence = ++this.accessRefresh;
    try {
      const config = await api<{ generation: number; readOnly: boolean }>(
        `/pages/${this.page.id}/document`,
      );
      if (this.destroyed || sequence !== this.accessRefresh) return;
      if (config.generation !== this.page.generation) {
        await Promise.allSettled(this.recoveryWrites);
        throw new Error(
          'The document generation changed. Keep your local recovery copy before reopening it.',
        );
      }
      this.setReadOnly(config.readOnly);
      if (rejoin) {
        // This session owns its socket. Reopen it to authenticate a fresh document channel.
        const transport = this.provider.configuration.websocketProvider;
        if (transport.status !== 'disconnected')
          await new Promise<void>((resolve) => {
            const closed = () => {
              transport.off('disconnect', closed);
              transport.off('destroy', closed);
              resolve();
            };
            transport.on('disconnect', closed);
            transport.on('destroy', closed);
            transport.disconnect();
          });
        if (this.destroyed || sequence !== this.accessRefresh) return;
        await transport.connect();
      } else await this.provider.connect();
    } catch (error) {
      if (this.destroyed || sequence !== this.accessRefresh) return;
      this.setStatus('error');
      this.reportError(error);
    }
  }
  private beforeUnload = (event: BeforeUnloadEvent) => {
    if (this.dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  };
  private onUpdate = () => {
    if (this.destroyed) return;
    this.dirty = !snapshotAcknowledgementCovers(
      Y.encodeStateAsUpdate(this.doc),
      this.lastAcknowledgement,
    );
    this.locallySaved = false;
    if (!this.readOnly)
      this.setStatus(this.dirty ? (this.connected ? 'saving' : 'connecting') : 'saved');
    if (this.recovery) {
      const serial = ++this.recoverySerial;
      const writing = this.recovery
        .write(this.key, Y.encodeStateAsUpdate(this.doc), this.dirty)
        .then(() => {
          if (this.destroyed || serial !== this.recoverySerial) return;
          this.locallySaved = true;
          if (!this.connected && this.dirty) this.setStatus('local');
        })
        .catch(() => {
          if (this.destroyed || serial !== this.recoverySerial) return;
          this.locallySaved = false;
          if (!this.connected) this.setStatus('error');
          this.reportError('Local recovery storage is full or unavailable.');
        });
      this.recoveryWrites.add(writing);
      void writing.finally(() => this.recoveryWrites.delete(writing));
    }
  };
  async destroy() {
    if (this.destroyed) {
      await Promise.allSettled(this.recoveryWrites);
      return;
    }
    this.destroyed = true;
    activeSessions.delete(this);
    this.doc.off('update', this.onUpdate);
    window.removeEventListener('beforeunload', this.beforeUnload);
    window.removeEventListener('offline', this.onOffline);
    window.removeEventListener('online', this.onOnline);
    this.provider?.destroy();
    await Promise.allSettled(this.recoveryWrites);
    if (this.recovery) {
      this.recovery.close();
    }
    this.doc.destroy();
  }
}
