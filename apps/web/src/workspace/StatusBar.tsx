import { t } from '../i18n/index.js';
import { useWorkspace } from '../state/store.js';

const label = {
  saved: 'Saved',
  saving: 'Saving…',
  connecting: 'Connecting…',
  local: 'Saved locally',
  error: 'Save failed',
  'read-only': 'Read only',
} as const;

/** The quiet bottom line of the window: sync state, where you are, and the keys that matter. */
export function StatusBar({ editing }: { editing: boolean }) {
  const saveStatus = useWorkspace((state) => state.saveStatus);
  const offline = useWorkspace((state) => !!state.connectionError);
  const dot = offline ? 'error' : editing ? saveStatus : 'saved';
  return (
    <footer className="status-bar" aria-label={t('Status')}>
      <span role="status">
        <i className="status-dot" data-state={dot} aria-hidden="true" />
        {offline ? t('Offline') : editing ? t(label[saveStatus]) : t('Synced')}
      </span>
      <span className="status-spacer" />
      {editing && (
        <span>
          <kbd>/</kbd>
          {t('Blocks')}
        </span>
      )}
      <span>
        <kbd>Ctrl K</kbd>
        {t('Search')}
      </span>
      <span>
        <kbd>Ctrl Shift P</kbd>
        {t('Commands')}
      </span>
    </footer>
  );
}
