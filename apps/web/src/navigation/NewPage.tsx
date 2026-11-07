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
    <Dialog title="Create a page" onClose={() => state.openDialog(null)}>
      <form onSubmit={submit}>
        <label>
          Title
          <input name="title" autoFocus required maxLength={300} placeholder="Untitled" />
        </label>
        <label>
          Page type
          <select name="kind" defaultValue={state.newPageKind}>
            <option value="document">Document</option>
            <option value="database">Database</option>
          </select>
        </label>
        <label>
          Location
          <select name="parent" defaultValue={state.newPageParentId ?? ''}>
            <option value="">Workspace root</option>
            {state.pages
              .filter((p) => p.kind !== 'database')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
          </select>
        </label>
        <label>
          Root visibility
          <select name="visibility">
            <option value="workspace">Everyone in this workspace</option>
            <option value="private">Private to me</option>
          </select>
          <small>Subpages inherit their root page’s access.</small>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          <Plus />
          Create page
        </button>
      </form>
    </Dialog>
  );
}
