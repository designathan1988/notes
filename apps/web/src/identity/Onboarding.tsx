import { t } from '../i18n/index.js';
import { useEffect, useState } from 'react';
import { api, json } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
import { BrandMark } from '../ui/BrandMark.js';
export function WorkspaceSetup() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <main className="onboarding">
      <div className="auth-brand">
        <BrandMark size={30} />
        Sinapta
      </div>
      <section>
        <h1>{t('Make room for your ideas.')}</h1>
        <p>{t('Start with a workspace. Invite your people when you’re ready.')}</p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            const data = new FormData(event.currentTarget);
            try {
              await api('/workspaces', { method: 'POST', body: json({ name: data.get('name') }) });
              await useWorkspace.getState().initialize();
            } catch (error) {
              setError((error as Error).message);
              setBusy(false);
            }
          }}
        >
          <label>
            {t('Workspace name')}
            <input
              name="name"
              required
              maxLength={300}
              autoFocus
              placeholder={t('Your team or project')}
            />
          </label>
          {error && <p className="form-error">{t(error)}</p>}
          <button className="button primary" disabled={busy}>
            {t('Create workspace')}
          </button>
        </form>
        <button className="text-button" onClick={() => void useWorkspace.getState().signOut()}>
          {t('Sign out')}
        </button>
      </section>
    </main>
  );
}
export function InvitationAccept({ id }: { id: string }) {
  const [invite, setInvite] = useState<{
    workspaceName: string;
    role: string;
    requiresVerification: boolean;
    status: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const user = useWorkspace((state) => state.user);
  useEffect(() => {
    void api<typeof invite>(`/invitations/${id}`)
      .then(setInvite)
      .catch((error) => setError(error.message));
  }, [id]);
  return (
    <main className="onboarding">
      <div className="auth-brand">
        <BrandMark size={30} />
        Sinapta
      </div>
      <section>
        <h1>{t('You’ve been invited.')}</h1>
        {invite && (
          <>
            <p>
              {t('Join {{workspace}} as an {{role}}.', {
                workspace: invite.workspaceName,
                role: t(
                  { owner: 'Owner', admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }[
                    invite.role
                  ] ?? invite.role,
                ).toLocaleLowerCase(),
              })}
            </p>
            {invite.requiresVerification ? (
              <>
                <p className="info-note">
                  {t('Verify {{email}} before joining this workspace.', {
                    email: user?.email ?? '',
                  })}
                </p>
                <button
                  className="button primary"
                  onClick={() =>
                    void api('/auth/send-verification-email', {
                      method: 'POST',
                      body: json({
                        email: user?.email,
                        callbackURL: `${location.origin}/?invite=${id}`,
                      }),
                    })
                      .then(() => setSent(true))
                      .catch((error) => setError(error.message))
                  }
                >
                  {t('Verify email')}
                </button>
                {sent && <LocalInbox />}
              </>
            ) : (
              <button
                className="button primary"
                disabled={busy || invite.status !== 'pending'}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const result = await api<{ workspaceId: string }>(`/invitations/${id}/accept`, {
                      method: 'POST',
                      body: '{}',
                    });
                    history.replaceState(null, '', '/');
                    await useWorkspace.getState().initialize();
                    await useWorkspace.getState().chooseWorkspace(result.workspaceId);
                  } catch (error) {
                    setError((error as Error).message);
                    setBusy(false);
                  }
                }}
              >
                {t('Accept invitation')}
              </button>
            )}
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {t(error)}
          </p>
        )}
        <button className="text-button" onClick={() => void useWorkspace.getState().signOut()}>
          {t('Use another account')}
        </button>
      </section>
    </main>
  );
}
export function LocalInbox() {
  const [messages, setMessages] = useState<{ subject: string; url: string }[]>([]);
  useEffect(() => {
    void api<typeof messages>('/local-mail')
      .then(setMessages)
      .catch(() => {});
  }, []);
  return (
    <div className="local-inbox">
      <h3>{t('Local development inbox')}</h3>
      <p className="muted-text">{t('These messages stay on this computer.')}</p>
      {messages.map((message, index) => (
        <a key={index} href={message.url}>
          {message.subject}
        </a>
      ))}
    </div>
  );
}
