import { LanguagePicker } from '../i18n/LanguagePicker.js';
import { t, formatNumber } from '../i18n/index.js';
import { Select } from '../ui/Select.js';
import { useEffect, useState, useRef, useEffectEvent, useMemo } from 'react';
import { ArrowUpRight, Plus, RotateCcw } from 'lucide-react';
import { Dialog } from '../ui/Dialog.js';
import { api, json } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
import { DataSettings } from './DataSettings.js';
import type { Page, Role } from '@note/contracts';
import { trashResults } from './trash.js';
export function Settings() {
  const state = useWorkspace();
  const [tab, setTab] = useState('members');
  const [error, setError] = useState('');
  const [members, setMembers] = useState<{ id: string; name: string; email: string; role: Role }[]>(
    [],
  );
  const [trash, setTrash] = useState<Page[]>([]);
  const [trashQuery, setTrashQuery] = useState('');
  const [trashPage, setTrashPage] = useState(0);
  const [restoring, setRestoring] = useState<string[]>([]);
  const restoringIds = useRef(new Set<string>());
  const [restoredTitle, setRestoredTitle] = useState<string | null>(null);
  const trashPageResults = useMemo(
    () => trashResults(trash, trashQuery, trashPage),
    [trash, trashQuery, trashPage],
  );
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
    <Dialog title={t('Workspace settings')} wide onClose={() => state.openDialog(null)}>
      <div className="settings-tabs">
        <div role="tablist" aria-label={t('Settings sections')}>
          {['members', 'data', 'trash', 'account'].map((item) => (
            <button
              key={item}
              role="tab"
              aria-selected={tab === item}
              className={tab === item ? 'active' : ''}
              onClick={() => setTab(item)}
            >
              {t(
                { members: 'Members', data: 'Data', trash: 'Trash', account: 'Account' }[item] ??
                  item,
              )}
            </button>
          ))}
        </div>
        {/* Appearance lives in its own panel; this opens it rather than switching a tab. */}
        <button className="settings-elsewhere" onClick={() => state.openAppearance('app')}>
          {t('Appearance')}
          <ArrowUpRight size={14} />
        </button>
      </div>
      {tab === 'members' && (
        <section className="settings-section">
          <div className="settings-heading">
            <div>
              <h3>{workspace?.name}</h3>
              <p className="muted-text">{t('Shared thinking starts with the right people.')}</p>
            </div>
            <button className="button" onClick={() => state.openDialog('invite')}>
              <Plus />
              {t('Invite people')}
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
                <Select
                  className="member-role"
                  aria-label={t('Role for {{email}}', { email: member.email })}
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
                      {t(
                        { owner: 'Owner', admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }[
                          role
                        ] ?? role,
                      )}
                    </option>
                  ))}
                  <option value="remove">{t('Remove member')}</option>
                </Select>
              </div>
            ))}
          </div>
        </section>
      )}
      {tab === 'data' && <DataSettings />}
      {tab === 'trash' && (
        <section className="settings-section">
          <h3>{t('Room to change your mind.')}</h3>
          <p className="muted-text">
            {t(
              'Restore a page and its subpages. Nothing here is permanently deleted by this screen.',
            )}
          </p>
          <label className="trash-search">
            {t('Search deleted pages')}
            <input
              type="search"
              value={trashQuery}
              placeholder={t('Search by title…')}
              onChange={(event) => {
                setTrashQuery(event.target.value);
                setTrashPage(0);
              }}
            />
          </label>
          <p className="muted-text">
            {t(
              trashPageResults.total === 1
                ? '{{count}} deleted page · Most recently deleted first'
                : '{{count}} deleted pages · Most recently deleted first',
              { count: formatNumber(trashPageResults.total) },
            )}
          </p>
          {restoredTitle !== null && (
            <p role="status">
              {t('“{{title}}” and its subpages were restored.', { title: restoredTitle })}
            </p>
          )}
          {trashPageResults.pages.map((page) => (
            <div className="trash-row" key={page.id}>
              <span>{page.title}</span>
              <button
                className="trash-restore"
                aria-label={t('Restore {{title}}', { title: page.title })}
                disabled={workspace?.role === 'viewer' || restoring.includes(page.id)}
                onClick={async () => {
                  if (restoringIds.current.has(page.id)) return;
                  const identity = state.user?.id,
                    workspaceId = state.workspaceId;
                  const current = () =>
                    identity === useWorkspace.getState().user?.id &&
                    workspaceId === useWorkspace.getState().workspaceId;
                  restoringIds.current.add(page.id);
                  setRestoring([...restoringIds.current]);
                  setError('');
                  setRestoredTitle(null);
                  try {
                    await api(`/pages/${page.id}/restore`, { method: 'POST', body: '{}' });
                    if (!current()) return;
                    setRestoredTitle(page.title);
                    refresh();
                    await state.reload();
                  } catch (error) {
                    if (current()) setError((error as Error).message);
                  } finally {
                    restoringIds.current.delete(page.id);
                    setRestoring([...restoringIds.current]);
                  }
                }}
              >
                <RotateCcw />
                {restoring.includes(page.id) ? t('Restoring…') : t('Restore')}
              </button>
            </div>
          ))}
          {!trash.length && <p className="table-empty">{t('Your trash is empty.')}</p>}
          {!!trash.length && !trashPageResults.total && (
            <p className="table-empty">{t('No deleted pages match your search.')}</p>
          )}
          {trashPageResults.pageCount > 1 && (
            <nav className="trash-pagination" aria-label={t('Deleted pages pagination')}>
              <button
                className="button"
                disabled={trashPageResults.pageIndex === 0}
                onClick={() => setTrashPage(trashPageResults.pageIndex - 1)}
              >
                {t('Previous')}
              </button>
              <span>
                {t('Page {{current}} of {{total}}', {
                  current: formatNumber(trashPageResults.pageIndex + 1),
                  total: formatNumber(trashPageResults.pageCount),
                })}
              </span>
              <button
                className="button"
                disabled={trashPageResults.pageIndex + 1 === trashPageResults.pageCount}
                onClick={() => setTrashPage(trashPageResults.pageIndex + 1)}
              >
                {t('Next')}
              </button>
            </nav>
          )}
        </section>
      )}
      {tab === 'account' && (
        <section className="settings-section">
          <h3>{state.user?.name}</h3>
          <LanguagePicker />
          <p className="muted-text">{state.user?.email}</p>
          <p className="info-note">
            {t('Collaborative web beta. Billing and production sales are not enabled.')}
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
                  {t('Workspace name')}
                  <input name="name" required autoFocus maxLength={300} />
                </label>
                <button className="button primary">{t('Create workspace')}</button>
              </form>
            ) : (
              <button className="button" onClick={() => setCreating(true)}>
                <Plus />
                {t('New workspace')}
              </button>
            )}
            <button
              className="text-button"
              onClick={() => void state.signOut().catch(state.setError)}
            >
              {t('Sign out')}
            </button>
          </div>
        </section>
      )}
      {error && (
        <p className="form-error" role="alert">
          {t(error)}
        </p>
      )}
    </Dialog>
  );
}
