import { useEffect, useState, useRef, useEffectEvent } from 'react';
import { ArrowUpRight, Plus, RotateCcw } from 'lucide-react';
import { Dialog } from '../ui/Dialog.js';
import { api, json } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
import { DataSettings } from './DataSettings.js';
import type { Page, Role } from '@note/contracts';
export function Settings() {
  const state = useWorkspace();
  const [tab, setTab] = useState('members');
  const [error, setError] = useState('');
  const [members, setMembers] = useState<{ id: string; name: string; email: string; role: Role }[]>(
    [],
  );
  const [trash, setTrash] = useState<Page[]>([]);
  const [creating, setCreating] = useState(false);
  const sequence = useRef(0);
  const workspace = state.workspaces.find((item) => item.id === state.workspaceId);
  const refresh = () => {
    const token = ++sequence.current,
      identity = state.user?.id,
      workspaceId = state.workspaceId;
    const current = () =>
      token === sequence.current &&
      identity === useWorkspace.getState().user?.id &&
      workspaceId === useWorkspace.getState().workspaceId;
    void api<typeof members>(`/workspaces/${state.workspaceId}/members`)
      .then((result) => {
        if (current()) setMembers(result);
      })
      .catch((error) => {
        if (current()) setError(error.message);
      });
    void api<Page[]>(`/workspaces/${state.workspaceId}/pages?trash=true`)
      .then((result) => {
        if (current()) setTrash(result);
      })
      .catch((error) => {
        if (current()) setError(error.message);
      });
  };
  // Reloading is the same action the restore buttons trigger; the effect fires it on changes.
  const reload = useEffectEvent(refresh);
  useEffect(() => {
    const requests = sequence;
    reload();
    return () => {
      // Invalidate requests still in flight for the previous workspace or version.
      requests.current++;
    };
  }, [state.workspaceId, state.knowledgeVersion]);
  return (
    <Dialog title="Workspace settings" wide onClose={() => state.openDialog(null)}>
      <div className="settings-tabs">
        <div role="tablist" aria-label="Settings sections">
          {['members', 'data', 'trash', 'account'].map((item) => (
            <button
              key={item}
              role="tab"
              aria-selected={tab === item}
              className={tab === item ? 'active' : ''}
              onClick={() => setTab(item)}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        {/* Appearance lives in its own panel; this opens it rather than switching a tab. */}
        <button className="settings-elsewhere" onClick={() => state.openAppearance('app')}>
          Appearance
          <ArrowUpRight size={14} />
        </button>
      </div>
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
                  className="member-role"
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
                      {role[0].toUpperCase() + role.slice(1)}
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
                  className="trash-restore"
                  disabled={workspace?.role === 'viewer'}
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
          <div className="settings-actions">
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
            <button
              className="text-button"
              onClick={() => void state.signOut().catch(state.setError)}
            >
              Sign out
            </button>
          </div>
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
