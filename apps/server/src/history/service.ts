import { advancePageGeneration } from '../pages/revisions.js';
import * as Y from 'yjs';
import type { Database } from '../platform/database.js';
import { Access } from '../access/service.js';
import { Documents } from '../documents/service.js';
import {
  DomainError,
  ACTIVITY_PAGE_SIZE,
  type Actor,
  type HistoryEntry,
} from '../../../../packages/contracts/src/index.js';
import { documentJSON } from '../../../../packages/editor/src/schema.js';
import { captureCheckpoint, checkpointColumns } from './checkpoints.js';

export class History {
  constructor(readonly db: Database) {}
  async list(actor: Actor, page: string, offset = 0) {
    await new Access(this.db).requirePage(actor, page, 'read');
    await this.ensureDocument(page);
    const entries = await this.db.query<HistoryEntry>(
      `SELECT ${checkpointColumns} FROM document_checkpoints c LEFT JOIN "user" u ON u.id=c.author_id WHERE c.page_id=$1 ORDER BY c.created_at DESC,c.id LIMIT ${ACTIVITY_PAGE_SIZE + 1} OFFSET $2`,
      [page, offset],
    );
    const [row] = await this.db.query<{ version: string }>(
      'SELECT version FROM documents WHERE page_id=$1',
      [page],
    );
    return {
      entries: entries.slice(0, ACTIVITY_PAGE_SIZE),
      hasMore: entries.length > ACTIVITY_PAGE_SIZE,
      version: Number(row.version),
    };
  }
  private async ensureDocument(page: string) {
    const doc = await new Documents(this.db).load(page);
    doc.destroy();
  }
  async preview(actor: Actor, page: string, id: string) {
    await new Access(this.db).requirePage(actor, page, 'read');
    const [row] = await this.db.query<HistoryEntry & { state: Uint8Array; currentVersion: string }>(
      `SELECT ${checkpointColumns},c.state,(SELECT version FROM documents WHERE page_id=$2) AS "currentVersion" FROM document_checkpoints c LEFT JOIN "user" u ON u.id=c.author_id WHERE c.id=$1 AND c.page_id=$2`,
      [id, page],
    );
    if (!row) throw new DomainError('NOT_FOUND', 'This saved version is unavailable.');
    const doc = new Y.Doc();
    try {
      Y.applyUpdate(doc, row.state);
      const { state: _state, currentVersion, ...entry } = row;
      return { entry, content: documentJSON(doc), version: Number(currentVersion) };
    } finally {
      doc.destroy();
    }
  }
  async save(actor: Actor, pageId: string, label: unknown) {
    if (typeof label !== 'string' || !label.trim() || label.length > 120 || label.includes('\0'))
      throw new DomainError('INVALID', 'Name this version using 1–120 characters.');
    return this.db.transaction(async (tx) => {
      const page = await new Access(tx).lockPage(actor, pageId);
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`document:${pageId}`]);
      await new History(tx).ensureDocument(pageId);
      const [row] = await tx.query<{ state: Uint8Array; version: string }>(
        'SELECT state,version FROM documents WHERE page_id=$1',
        [pageId],
      );
      const id = await captureCheckpoint(tx, {
        pageId,
        workspaceId: page.workspaceId,
        state: row.state,
        version: Number(row.version),
        authorId: actor.userId,
        label: label.trim(),
        kind: 'named',
      });
      return { id };
    });
  }
  async restore(actor: Actor, pageId: string, id: string, version: unknown) {
    if (!Number.isSafeInteger(version) || Number(version) < 1)
      throw new DomainError('INVALID', 'A current document version is required.');
    return this.db.transaction(async (tx) => {
      const page = await new Access(tx).lockPage(actor, pageId);
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`document:${pageId}`]);
      const [checkpoint] = await tx.query<{ state: Uint8Array }>(
        'SELECT state FROM document_checkpoints WHERE id=$1 AND page_id=$2',
        [id, pageId],
      );
      if (!checkpoint) throw new DomainError('NOT_FOUND', 'This saved version is unavailable.');
      const current = await new Documents(tx).load(pageId),
        source = new Y.Doc();
      try {
        const [row] = await tx.query<{ version: string; state: Uint8Array }>(
          'SELECT version,state FROM documents WHERE page_id=$1',
          [pageId],
        );
        if (Number(row.version) !== version)
          throw new DomainError(
            'CONFLICT',
            'This document changed. Review the latest version before restoring.',
          );
        await captureCheckpoint(tx, {
          pageId,
          workspaceId: page.workspaceId,
          state: row.state,
          version: Number(row.version),
          authorId: actor.userId,
          label: 'Before restore',
          kind: 'before-restore',
        });
        Y.applyUpdate(source, checkpoint.state);
        const root = current.getXmlFragment('default');
        current.transact(() => {
          root.delete(0, root.length);
          root.insert(
            0,
            source
              .getXmlFragment('default')
              .toArray()
              .map((node) => {
                if (node instanceof Y.XmlElement || node instanceof Y.XmlText) return node.clone();
                throw new DomainError('INVALID', 'Unsupported saved document structure.');
              }),
          );
        });
        await advancePageGeneration(tx, pageId);
        const ack = await new Documents(tx).save(
          actor,
          pageId,
          Y.encodeStateAsUpdate(current),
          page.generation + 1,
        );
        return ack;
      } finally {
        current.destroy();
        source.destroy();
      }
    });
  }
}
