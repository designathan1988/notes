import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { api } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
import { snapshotAcknowledgementCovers } from './durability.js';
import { openRecovery, type Recovery } from './recovery.js';
import type { Page, SaveStatus } from '../../../../packages/contracts/src/index.js';
const activeSessions = new Set<DocumentSession>();
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
  get identity() {
    return this.userId;
  }
  private readonly recoveryWrites = new Set<Promise<void>>();
  readonly doc = new Y.Doc();
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
  constructor(readonly page: Page) {
    this.userId = useWorkspace.getState().user!.id;
    this.key = `${this.userId}:${page.workspaceId}:${page.id}:${page.generation}`;
    activeSessions.add(this);
  }
  private setStatus(status: SaveStatus) {
    if (!this.destroyed && useWorkspace.getState().selectedId === this.page.id)
      useWorkspace.setState({ saveStatus: status });
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
      const update = await this.recovery.read(this.key);
      if (update) {
        Y.applyUpdate(this.doc, update, 'recovery');
        this.dirty = true;
      }
    } catch {
      useWorkspace
        .getState()
        .setError(
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
        if (this.readOnly) this.setStatus('read-only');
        this.provider.sendStateless('checkpoint');
      },
      onStateless: ({ payload }) => {
        try {
          const ack = JSON.parse(payload);
          if (ack.type === 'save-error') {
            this.setStatus('error');
            useWorkspace.getState().setError(ack.message);
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
                  useWorkspace
                    .getState()
                    .setError(
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
        useWorkspace
          .getState()
          .setError('Access to this document changed. Your local draft has not been sent.');
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
    if (!this.destroyed)
      void api<{ generation: number }>(`/pages/${this.page.id}/document`)
        .then((config) => {
          if (this.destroyed) return;
          if (config.generation !== this.page.generation)
            throw new Error(
              'The document generation changed. Keep your local recovery copy before reopening it.',
            );
          return this.provider.connect();
        })
        .catch((error) => {
          this.setStatus('error');
          useWorkspace.getState().setError(error);
        });
  };
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
      const writing = this.recovery
        .write(this.key, Y.encodeStateAsUpdate(this.doc), this.dirty)
        .then(() => {
          if (this.destroyed) return;
          this.locallySaved = true;
          if (!this.connected && this.dirty) this.setStatus('local');
        })
        .catch(() => {
          if (this.destroyed) return;
          this.locallySaved = false;
          if (!this.connected) this.setStatus('error');
          useWorkspace.getState().setError('Local recovery storage is full or unavailable.');
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
