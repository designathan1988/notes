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
    <Dialog title="Save as template" onClose={() => useWorkspace.getState().closeTemplateDialog()}>
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
          Save a reusable copy of this page, its media and its subpages. Linked pages and databases
          stay connected.
        </p>
        <label>
          Template name
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={300}
          />
        </label>
        <label>
          Visibility
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as 'private' | 'workspace')}
          >
            <option value="private">Private — only you</option>
            <option value="workspace">Workspace — everyone here</option>
          </select>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="button"
            onClick={() => useWorkspace.getState().closeTemplateDialog()}
          >
            Cancel
          </button>
          <button className="button primary" disabled={busy || !title.trim()}>
            {busy ? 'Saving…' : 'Save template'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
