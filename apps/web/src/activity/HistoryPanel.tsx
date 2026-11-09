import { t } from '../i18n/index.js';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Clock3, History, RotateCcw, BookmarkPlus } from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import { Dialog } from '../ui/Dialog.js';
import type { VersionPreview as Preview } from './state.js';
import { activityTime } from './DiscussionPanel.js';
import { ACTIVITY_PAGE_SIZE } from '@note/contracts';
const VersionPreview = lazy(() => import('./VersionPreview.js'));
export function HistoryPanel({ pageId, canWrite }: { pageId: string; canWrite: boolean }) {
  const data = useWorkspace((state) => state.histories[pageId]),
    preview = useWorkspace((state) =>
      state.versionPreview?.entry.pageId === pageId ? state.versionPreview : null,
    );
  const saveStatus = useWorkspace((state) => state.saveStatus),
    version = useWorkspace((state) => state.knowledgeVersion);
  const [name, setName] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirm, setConfirm] = useState<Preview | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (data?.offset) root.current?.querySelector<HTMLButtonElement>('.version-entry')?.focus();
  }, [data?.offset]);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      useWorkspace
        .getState()
        .loadHistory(pageId)
        .catch((failure) => {
          if (active) setError(failure.message);
        });
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pageId, version]);
  const run = async (operation: () => Promise<void>, complete?: () => void) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      complete?.();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="history-panel" ref={root}>
      <p className="activity-intro">
        {t(
          'Your current changes save continuously. Automatic history checkpoints are created at most once every 10 minutes as you edit, so the latest checkpoint may be older than your saved page. Save a named version to capture this moment. Restoring saves the current document as a separate version first.',
        )}
      </p>
      {error && (
        <p className="activity-error" role="alert">
          {t(error)}
        </p>
      )}
      {preview ? (
        <div role="region" aria-label={t('Version preview')} className="version-preview">
          <button
            className="activity-back"
            onClick={() => useWorkspace.getState().closeVersionPreview()}
          >
            <ArrowLeft size={14} />
            {t('All versions')}
          </button>
          <strong>{preview.entry.label || t('Automatic version')}</strong>
          <small>
            {activityTime(preview.entry.createdAt)} · {preview.entry.authorName}
          </small>
          <Suspense fallback={<p className="muted-text">{t('Opening saved version…')}</p>}>
            <VersionPreview key={preview.entry.id} content={preview.content} />
          </Suspense>
          {canWrite && (
            <button
              className="button"
              disabled={busy || saveStatus !== 'saved'}
              onClick={() => setConfirm(preview)}
            >
              <RotateCcw size={14} />
              {t('Restore this version')}
            </button>
          )}
          {canWrite && saveStatus !== 'saved' && (
            <small>{t('Wait for this document to finish saving before restoring.')}</small>
          )}
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void run(() => useWorkspace.getState().previewVersion(pageId, preview.entry.id))
            }
          >
            {t('Refresh comparison')}
          </button>
        </div>
      ) : (
        <>
          {canWrite && (
            <form
              className="version-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void run(
                  () => useWorkspace.getState().saveVersion(pageId, name),
                  () => setName((current) => (current === name ? '' : current)),
                );
              }}
            >
              <label htmlFor="version-name">{t('Save a named version')}</label>
              <div>
                <input
                  id="version-name"
                  aria-label={t('Version name')}
                  placeholder={t('e.g. Ready for review')}
                  value={name}
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                />
                <button
                  className="icon-button"
                  aria-label={t('Save version')}
                  title={t('Save version')}
                  disabled={busy || !name.trim() || saveStatus !== 'saved'}
                >
                  <BookmarkPlus size={17} />
                </button>
              </div>
              {saveStatus !== 'saved' && (
                <small>{t('Available when this document is saved online.')}</small>
              )}
            </form>
          )}
          <div className="version-timeline">
            {data?.entries.map((entry) => (
              <button
                className="version-entry"
                key={entry.id}
                disabled={busy}
                onClick={() =>
                  void run(() => useWorkspace.getState().previewVersion(pageId, entry.id))
                }
              >
                <span className="version-dot">
                  {entry.kind === 'before-restore' ? (
                    <RotateCcw size={14} />
                  ) : entry.kind === 'named' ? (
                    <BookmarkPlus size={14} />
                  ) : (
                    <Clock3 size={14} />
                  )}
                </span>
                <span>
                  <strong>{entry.label || t('Automatic version')}</strong>
                  <time dateTime={entry.createdAt}>{activityTime(entry.createdAt)}</time>
                  <small>
                    {entry.authorName}
                    {entry.version > 0
                      ? t(' · Version {{value0}}', { value0: entry.version })
                      : t(' · Earlier checkpoint')}
                  </small>
                </span>
              </button>
            ))}
          </div>
          {!data ? (
            <p className="muted-text">{t('Loading history…')}</p>
          ) : (
            !data.entries.length && (
              <div className="activity-empty">
                <History size={24} />
                <strong>{t('Your page history starts here')}</strong>
                <p>
                  {t(
                    'Automatic checkpoints are created at most once every 10 minutes as you edit. Your current saved page can be newer. Name a version to capture it now.',
                  )}
                </p>
              </div>
            )
          )}
          {data && (data.offset > 0 || data.hasMore) && (
            <div className="activity-pagination">
              <button
                className="text-button"
                disabled={busy || !data.offset}
                onClick={() =>
                  void run(() => useWorkspace.getState().loadHistory(pageId, 'previous'))
                }
              >
                {t('Newer versions')}
              </button>
              <small>
                {t('Page')} {Math.floor(data.offset / ACTIVITY_PAGE_SIZE) + 1}
              </small>
              <button
                className="text-button"
                disabled={busy || !data.hasMore}
                onClick={() => void run(() => useWorkspace.getState().loadHistory(pageId, 'next'))}
              >
                {t('Older versions')}
              </button>
            </div>
          )}
        </>
      )}
      {confirm && (
        <Dialog
          title={t('Restore saved version')}
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
        >
          <p>
            {t('Restore “')}
            {confirm.entry.label || t('Automatic version')}
            {t('”? Your current document will remain available as “Before restore” in history.')}
          </p>
          <p className="muted-text">
            {t(
              'This changes the shared document for everyone. Changes made after this preview will stop the restore so you can review them.',
            )}
          </p>
          {error && (
            <p className="activity-error" role="alert">
              {t(error)}
            </p>
          )}
          <footer className="dialog-actions">
            <button className="button" disabled={busy} onClick={() => setConfirm(null)}>
              {t('Cancel')}
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => useWorkspace.getState().restoreVersion(pageId, confirm),
                  () => setConfirm(null),
                )
              }
            >
              {busy ? t('Restoring…') : t('Restore version')}
            </button>
          </footer>
        </Dialog>
      )}
    </div>
  );
}
