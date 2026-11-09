import { t } from '../i18n/index.js';
import { Select } from '../ui/Select.js';
import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Dialog } from '../ui/Dialog.js';
import { useWorkspace } from '../state/store.js';
export function NewPage() {
  const state = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      await state.createPage({
        title: String(data.get('title')),
        parentId: String(data.get('parent')) || undefined,
        kind: String(data.get('kind')) as 'document' | 'database',
        visibility: String(data.get('visibility')) as 'workspace' | 'private',
      });
    } catch (error) {
      setError((error as Error).message);
      setBusy(false);
    }
  }
  return (
    <Dialog title={t('Create a page')} onClose={() => state.openDialog(null)}>
      <button
        className="button new-website-action"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void state.createWebPage(state.newPageParentId).catch((error) => {
            setError(error.message);
            setBusy(false);
          });
        }}
      >
        {t('New web page')}
      </button>
      <form onSubmit={submit}>
        <label>
          {t('Title')}
          <input name="title" autoFocus required maxLength={300} placeholder={t('Untitled')} />
        </label>
        <label>
          {t('Page type')}
          <Select name="kind" defaultValue={state.newPageKind}>
            <option value="document">{t('Document')}</option>
            <option value="database">{t('Database')}</option>
            <option value="canvas">{t('Canvas')}</option>
          </Select>
        </label>
        <label>
          {t('Location')}
          <Select name="parent" defaultValue={state.newPageParentId ?? ''}>
            <option value="">{t('Workspace root')}</option>
            {state.pages
              .filter((p) => p.kind !== 'database')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
          </Select>
        </label>
        <label>
          {t('Root visibility')}
          <Select name="visibility">
            <option value="workspace">{t('Everyone in this workspace')}</option>
            <option value="private">{t('Private to me')}</option>
          </Select>
          <small>{t('Subpages inherit their root page’s access.')}</small>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {t(error)}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          <Plus />
          {t('Create page')}
        </button>
      </form>
    </Dialog>
  );
}
