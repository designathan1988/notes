import { useEffect, useState } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { Dialog } from '../ui/Dialog.js';
import { api, json } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
import { DataSettings } from './DataSettings.js';
import type { Page, Role } from '../../../../packages/contracts/src/index.js';
export function Settings() {
  const state = useWorkspace();
  const [tab, setTab] = useState('members');
  const [error, setError] = useState('');
  const [members, setMembers] = useState<{ id: string; name: string; email: string; role: Role }[]>(
    [],
  );
  const [trash, setTrash] = useState<Page[]>([]);
  const [creating, setCreating] = useState(false);
  const workspace = state.workspaces.find((item) => item.id === state.workspaceId);
  const refresh = () => {
    void api<typeof members>(`/workspaces/${state.workspaceId}/members`)
      .then(setMembers)
      .catch((error) => setError(error.message));
    void api<Page[]>(`/workspaces/${state.workspaceId}/pages?trash=true`)
      .then(setTrash)
      .catch(() => {});
  };
  useEffect(refresh, [state.workspaceId]);
  return (
    <Dialog title="Workspace settings" wide onClose={() => state.openDialog(null)}>
      <nav className="settings-tabs">
        {['members', 'data', 'trash', 'account'].map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>
      {tab === 'members' && (
        <section className="settings-section">
          <div className="settings-heading">
            <div>
              <h3>{workspace?.name}</h3>
              <p className="muted-text">Shared thinking starts with the right people.</p>
            </div>
            <button className="button" onClick={() => state.openDialog('invite')}>
              <Plus />
              Invite people
            </button>
          </div>
          <div className="member-list">
            {members.map((member) => (
              <div key={member.id}>
                <span className="avatar small">{member.name[0]}</span>
                <span>
                  <strong>{member.name}</strong>
                  <small>{member.email}</small>
                </span>
                <select
                  aria-label={`Role for ${member.email}`}
                  value={member.role}
                  disabled={
                    !['admin', 'owner'].includes(workspace?.role ?? '') ||
                    (member.role === 'owner' && workspace?.role !== 'owner')
                  }
                  onChange={async (event) => {
                    try {
                      await api(`/workspaces/${state.workspaceId}/members/${member.id}`, {
                        method: 'PATCH',
                        body: json({
                          role: event.target.value === 'remove' ? null : event.target.value,
                        }),
                      });
                      refresh();
                    } catch (error) {
                      setError((error as Error).message);
                    }
                  }}
                >
                  {(workspace?.role === 'owner'
                    ? ['owner', 'admin', 'editor', 'viewer']
                    : ['admin', 'editor', 'viewer']
                  ).map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                  <option value="remove">Remove member</option>
                </select>
              </div>
            ))}
          </div>
        </section>
      )}
      {tab === 'data' && <DataSettings />}
      {tab === 'trash' && (
        <section className="settings-section">
          <h3>Room to change your mind.</h3>
          <p className="muted-text">
            Restore a page and its subpages. Nothing here is permanently deleted by this screen.
          </p>
          {trash
            .filter((page) => !trash.some((parent) => parent.id === page.parentId))
            .map((page) => (
              <div className="trash-row" key={page.id}>
                <span>{page.title}</span>
                <button
                  className="button"
                  onClick={async () => {
                    try {
                      await api(`/pages/${page.id}/restore`, { method: 'POST', body: '{}' });
                      refresh();
                      await state.reload();
                    } catch (error) {
                      setError((error as Error).message);
                    }
                  }}
                >
                  <RotateCcw />
                  Restore
                </button>
              </div>
            ))}
          {!trash.length && <p className="table-empty">Your trash is empty.</p>}
        </section>
      )}
      {tab === 'account' && (
        <section className="settings-section">
          <h3>{state.user?.name}</h3>
          <p className="muted-text">{state.user?.email}</p>
          <p className="info-note">
            Collaborative web beta. Billing and production sales are not enabled.
          </p>
          {creating ? (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                try {
                  const created = await api<{ id: string }>('/workspaces', {
                    method: 'POST',
                    body: json({ name: data.get('name') }),
                  });
                  await state.initialize();
                  await state.chooseWorkspace(created.id);
                  state.openDialog(null);
                } catch (error) {
                  setError((error as Error).message);
                }
              }}
            >
              <label>
                Workspace name
                <input name="name" required autoFocus maxLength={300} />
              </label>
              <button className="button primary">Create workspace</button>
            </form>
          ) : (
            <button className="button" onClick={() => setCreating(true)}>
              <Plus />
              New workspace
            </button>
          )}
          <button className="text-button" onClick={() => void state.signOut()}>
            Sign out
          </button>
        </section>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
