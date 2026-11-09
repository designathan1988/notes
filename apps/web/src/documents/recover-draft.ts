import { t } from '../i18n/index.js';
import * as Y from 'yjs';
import { documentJSON } from '@note/editor/schema';
import { openRecovery } from './recovery.js';
import { useWorkspace } from '../state/store.js';

export async function recoverLocalDraft(key: string, title: string) {
  const identity = useWorkspace.getState().user?.id,
    workspace = useWorkspace.getState().workspaceId;
  if (!identity || !workspace || !key.startsWith(identity + ':'))
    throw new Error('Open local recovery in the account that owns this draft.');
  const current = () =>
    useWorkspace.getState().user?.id === identity &&
    useWorkspace.getState().workspaceId === workspace;
  const recovery = await openRecovery(),
    doc = new Y.Doc();
  try {
    const state = await recovery.read(key);
    if (!state)
      throw new Error('This local draft is unavailable. Keep your existing recovery download.');
    Y.applyUpdate(doc, state);
    const content = documentJSON(doc);
    const prefix = new TextEncoder().encode(key + '\0'),
      fingerprint = new Uint8Array(prefix.length + state.length);
    fingerprint.set(prefix);
    fingerprint.set(state, prefix.length);
    const digest = await crypto.subtle.digest('SHA-256', fingerprint);
    const requestId =
      'recovery-' +
      Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
    if (!current()) throw new Error('The account or workspace changed. Reopen local recovery.');
    const page = await useWorkspace.getState().createPage(
      {
        title: t('Recovered: {{title}}', { title }).slice(0, 300),
        content,
        requestId,
        purpose: 'recovery',
        expectedUserId: identity,
        visibility: 'private',
      },
      { navigate: false },
    );
    if (!current()) return;
    const acknowledged = await recovery.acknowledge(key, state);
    if (!current()) return;
    useWorkspace.getState().navigate(page.id);
    if (!acknowledged)
      useWorkspace
        .getState()
        .setError(
          'A private copy was recovered. Newer local changes are still kept in Settings → Data.',
        );
  } finally {
    doc.destroy();
    recovery.close();
  }
}
