import { t } from '../i18n/index.js';
import { useState } from 'react';
import type { DatabaseViewConfig, SavedDatabaseView } from '@note/contracts';
import { Dialog } from '../ui/Dialog.js';
import { api, json } from '../state/api.js';

export function ViewSettings({
  id,
  view,
  config,
  close,
  saved,
  removed,
  refresh,
}: {
  id: string;
  view: SavedDatabaseView | null;
  config: DatabaseViewConfig;
  close(): void;
  saved(id: string): void;
  removed(): void;
  refresh(): Promise<void>;
}) {
  const [baseView] = useState(view);
  const [name, setName] = useState(view?.name ?? ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const perform = async (remove = false) => {
    setBusy(true);
    setError('');
    try {
      if (remove && baseView) {
        await api(`/databases/${id}/views/${baseView.id}?revision=${baseView.revision}`, {
          method: 'DELETE',
        });
        await refresh();
        removed();
      } else {
        const result = await api<SavedDatabaseView>(
          `/databases/${id}/views${baseView ? '/' + baseView.id : ''}`,
          {
            method: baseView ? 'PATCH' : 'POST',
            body: json({ name, config, ...(baseView ? { revision: baseView.revision } : {}) }),
          },
        );
        await refresh();
        saved(result.id);
      }
      close();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={view ? t('Edit saved view') : t('Save this view')} onClose={close}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void perform();
        }}
      >
        <label>
          {t('View name')}
          <input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <p className="muted-text">
          {t('Save the layout, grouping, date property, filter, sort and columns.')}
        </p>
        {error && (
          <p className="form-error" role="alert">
            {t(error)}
          </p>
        )}
        <div className="form-actions">
          <button className="button primary" disabled={busy}>
            {t('Save view')}
          </button>
          {view && (
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={() => void perform(true)}
            >
              {t('Delete view')}
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
