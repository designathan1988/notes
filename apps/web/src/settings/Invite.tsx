import { t } from '../i18n/index.js';
import { Select } from '../ui/Select.js';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Dialog } from '../ui/Dialog.js';
import { useWorkspace } from '../state/store.js';
import { api, json } from '../state/api.js';
export function Invite() {
  const state = useWorkspace();
  const workspace = state.workspaces.find((item) => item.id === state.workspaceId);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const canInvite = workspace && ['owner', 'admin'].includes(workspace.role);
  const page = state.pages.find((page) => page.id === state.selectedId);
  return (
    <Dialog title={t('Invite to your workspace')} onClose={() => state.openDialog(null)}>
      <p className="muted-text">
        {t(
          'Invite someone to {{workspace}}. This invitation grants access to shared pages throughout the workspace, not just the current page. Their role controls what they can do.',
          { workspace: workspace?.name ?? '' },
        )}
      </p>
      {page?.visibility === 'private' && (
        <p className="info-note">
          {t('This page is private. A workspace invitation does not share private pages.')}
        </p>
      )}
      {canInvite ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            const data = new FormData(event.currentTarget);
            try {
              const result = await api<{ id: string; delivery: string }>(
                `/workspaces/${state.workspaceId}/invitations`,
                {
                  method: 'POST',
                  body: json({ email: data.get('email'), role: data.get('role') }),
                },
              );
              setUrl(`${location.origin}/?invite=${result.id}`);
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {t('Email address')}
            <input
              type="email"
              name="email"
              required
              autoFocus
              placeholder={t('name@company.com')}
            />
          </label>
          <label>
            {t('Role')}
            <Select name="role" defaultValue="editor">
              <option value="editor">{t('Editor — can edit shared content')}</option>
              <option value="viewer">{t('Viewer — can read shared content')}</option>
              <option value="admin">{t('Admin — can manage the workspace')}</option>
            </Select>
          </label>
          <button className="button primary" disabled={busy}>
            {t('Create invitation')}
          </button>
        </form>
      ) : (
        <p className="info-note">{t('Only workspace owners and admins can invite people.')}</p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {t(error)}
        </p>
      )}
      {url && (
        <div className="invite-result">
          <p className="info-note">
            {t(
              'The invitation is in the local development outbox. No email was sent. Share this link with the intended recipient to test the flow.',
            )}
          </p>
          <label>
            {t('Invitation link')}
            <input aria-label={t('Invitation link')} readOnly value={url} />
          </label>
          <button
            className="button"
            onClick={() =>
              void navigator.clipboard
                .writeText(url)
                .then(() => setCopied(true))
                .catch(() => setError('Select the link and copy it with your keyboard.'))
            }
          >
            {copied ? <Check /> : <Copy />}
            {copied ? t('Copied') : t('Copy invitation link')}
          </button>
        </div>
      )}
    </Dialog>
  );
}
