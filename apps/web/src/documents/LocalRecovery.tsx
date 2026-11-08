import { useEffect, useState } from 'react';
import { Download, FilePlus2, HardDrive } from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import { openRecovery } from './recovery.js';

// recovery-export pulls Yjs, ProseMirror projection, HTML parsing and ZIP code. Keep it out of
// the initial chunk, but start loading it right after boot: the export must work offline.
let recoveryExport: Promise<typeof import('./recovery-export.js')> | undefined;
const loadRecoveryExport = () =>
  (recoveryExport ??= import('./recovery-export.js').catch((failure: unknown) => {
    recoveryExport = undefined;
    throw failure;
  }));
if (typeof window !== 'undefined')
  window.setTimeout(() => void loadRecoveryExport().catch(() => undefined), 0);

type Draft = { key: string; title: string; excerpt: string };
export function LocalRecovery() {
  const identity = useWorkspace((state) => state.user?.id),
    workspace = useWorkspace((state) => state.workspaceId),
    version = useWorkspace((state) => state.knowledgeVersion);
  const role = useWorkspace(
    (state) => state.workspaces.find((item) => item.id === state.workspaceId)?.role,
  );
  const canWrite = !!role && role !== 'viewer';
  const online = useWorkspace((state) => state.online);
  const [drafts, setDrafts] = useState<Draft[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [limit, setLimit] = useState(20),
    [total, setTotal] = useState(0),
    [checking, setChecking] = useState(true);
  useEffect(() => {
    if (!identity) return;
    let active = true;
    const load = async () => {
      const storage = await openRecovery();
      try {
        const keys = await storage.pendingIdentity(identity),
          items: Draft[] = [];
        if (keys.length) {
          for (const key of keys.slice(0, limit)) {
            const [, pageId] = key.slice(identity.length + 1).split(':');
            const title =
              useWorkspace.getState().pages.find((page) => page.id === pageId)?.title ??
              'Local draft';
            let excerpt = 'A recovery copy is retained on this device.';
            try {
              excerpt = await (await loadRecoveryExport()).localDraftExcerpt(storage, key);
            } catch {
              /* Keep the raw recovery download available. */
            }
            items.push({ key, title, excerpt });
          }
        }
        if (active && identity === useWorkspace.getState().user?.id) {
          setDrafts(items);
          setTotal(keys.length);
        }
      } finally {
        storage.close();
      }
    };
    void load()
      .catch((failure) => {
        if (active) setError(failure.message);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [identity, workspace, version, limit]);
  return (
    <div className="local-recovery" role="region" aria-label="Local recovery">
      <h3>Local recovery</h3>
      <p className="muted-text">
        Recover retained text and blocks as a private page, or download a separate backup. Media
        references keep their original access permissions.
      </p>
      <button
        className="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError('');
          void loadRecoveryExport()
            .then((module) => module.downloadLocalDrafts())
            .catch((failure) => setError(failure.message))
            .finally(() => setBusy(false));
        }}
      >
        <Download />
        Download local drafts
      </button>
      {error && (
        <p className="activity-error" role="alert">
          {error}
        </p>
      )}
      {!!total && (
        <div className="local-draft-list">
          {drafts.map((draft) => (
            <div className="local-draft" key={draft.key}>
              <HardDrive size={17} />
              <div>
                <strong>{draft.title}</strong>
                <p>{draft.excerpt}</p>
                <button
                  className="button"
                  disabled={busy || !canWrite || !online}
                  onClick={() => {
                    setBusy(true);
                    setError('');
                    void import('./recover-draft.js')
                      .then((module) => module.recoverLocalDraft(draft.key, draft.title))
                      .catch((failure) => setError(failure.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  <FilePlus2 size={14} />
                  Recover as private page
                </button>
              </div>
            </div>
          ))}
          {total > drafts.length && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setLimit((value) => value + 20)}
            >
              More local drafts
            </button>
          )}
          {!online && (
            <p className="muted-text">
              Reconnect to recover a private page. Downloads work offline.
            </p>
          )}
          {!canWrite && (
            <p className="muted-text">
              Choose a workspace with editing access to recover a private page.
            </p>
          )}
        </div>
      )}
      {checking && !total && !error && (
        <p className="local-recovery-empty">Checking local recovery…</p>
      )}
      {!checking && !total && !error && (
        <p className="local-recovery-empty">No unsynchronized drafts on this device.</p>
      )}
    </div>
  );
}
