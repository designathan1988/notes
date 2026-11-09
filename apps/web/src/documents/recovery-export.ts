import { t } from '../i18n/index.js';
import * as Y from 'yjs';
import { yDocToProsemirrorJSON } from 'y-prosemirror';
import { zipSync, strToU8 } from 'fflate';
import { openRecovery, type Recovery } from './recovery.js';
import { projectDocument } from '@note/editor/projection';
import { useWorkspace } from '../state/store.js';

export async function localDraftExcerpt(storage: Recovery, key: string) {
  const state = await storage.read(key);
  if (!state) return t('No readable content is available.');
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, state);
    return (
      projectDocument(yDocToProsemirrorJSON(doc, 'default')).text.slice(0, 180) ||
      t('Structured content')
    );
  } finally {
    doc.destroy();
  }
}

export async function downloadLocalDrafts() {
  const identity = useWorkspace.getState().user?.id;
  if (!identity) throw new Error('Sign in to download your local drafts.');
  const recovery = await openRecovery();
  try {
    const keys = await recovery.pendingIdentity(identity);
    if (!keys.length) throw new Error('There are no unsynchronized local drafts.');
    const files: Record<string, Uint8Array> = {};
    const index: {
      pageId: string;
      workspaceId: string;
      generation: string;
      title: string;
      jsonFile: string;
      yjsFile: string;
    }[] = [];
    for (const key of keys) {
      const state = await recovery.read(key);
      if (!state) continue;
      const [, workspaceId, pageId, generation] = key.split(':');
      const page = useWorkspace.getState().pages.find((page) => page.id === pageId);
      const doc = new Y.Doc();
      try {
        Y.applyUpdate(doc, state);
        const filename = `${pageId}-generation-${generation}`;
        files[`${filename}.json`] = strToU8(
          JSON.stringify(yDocToProsemirrorJSON(doc, 'default'), null, 2),
        );
        files[`${filename}.yjs`] = state;
        index.push({
          pageId,
          workspaceId,
          generation,
          title: page?.title ?? t('Local draft'),
          jsonFile: `${filename}.json`,
          yjsFile: `${filename}.yjs`,
        });
      } finally {
        doc.destroy();
      }
    }
    files['recovery.json'] = strToU8(
      JSON.stringify(
        {
          format: 'note-local-recovery',
          version: 2,
          exportedAt: new Date().toISOString(),
          drafts: index,
        },
        null,
        2,
      ),
    );
    files['README.txt'] = strToU8(
      'Local recovery copy\n\nEach JSON file contains the complete structured document. Each YJS file preserves the collaborative state. This recovery archive is separate from Workspace ZIP import. Media files remain in workspace storage and are not included. Downloading does not erase your local drafts.',
    );
    const bytes = zipSync(files),
      url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'note-local-drafts.zip';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    recovery.close();
  }
}
