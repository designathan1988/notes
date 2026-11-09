import { t } from '../i18n/index.js';
import { Select } from '../ui/Select.js';
import { useState } from 'react';
import { useWorkspace } from '../state/store.js';
import { Dialog } from '../ui/Dialog.js';
export function TemplateDialog() {
  const request = useWorkspace((state) => state.templateDialog),
    pages = useWorkspace((state) => state.pages),
    busy = useWorkspace((state) => !!state.copyBusy);
  const page = pages.find((page) => page.id === request?.sourceId);
  const [title, setTitle] = useState(page?.title ?? ''),
    [visibility, setVisibility] = useState<'private' | 'workspace'>('private'),
    [error, setError] = useState('');
  if (!request || !page) return null;
  return (
    <Dialog
      title={t('Save as template')}
      onClose={() => useWorkspace.getState().closeTemplateDialog()}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError('');
          try {
            await useWorkspace.getState().copyPage({
              operation: 'save',
              sourceId: page.id,
              title: title.trim(),
              visibility,
            });
          } catch (failure) {
            setError((failure as Error).message);
          }
        }}
      >
        <p className="muted-text">
          {t(
            'Save a reusable copy of this page, its media and its subpages. Linked pages and databases stay connected.',
          )}
        </p>
        <label>
          {t('Template name')}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={300}
          />
        </label>
        <label>
          {t('Visibility')}
          <Select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as 'private' | 'workspace')}
          >
            <option value="private">{t('Private — only you')}</option>
            <option value="workspace">{t('Workspace — everyone here')}</option>
          </Select>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {t(error)}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="button"
            onClick={() => useWorkspace.getState().closeTemplateDialog()}
          >
            {t('Cancel')}
          </button>
          <button className="button primary" disabled={busy || !title.trim()}>
            {busy ? t('Saving…') : t('Save template')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
