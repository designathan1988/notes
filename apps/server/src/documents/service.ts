import * as Y from 'yjs';
import type { Database } from '../platform/database.js';
import {
  DomainError,
  MAX_DOCUMENT_BYTES,
  type Actor,
} from '../../../../packages/contracts/src/index.js';
import { Access } from '../access/service.js';
import {
  documentFromJSON,
  documentJSON,
  editorSchema,
  emptyDocument,
} from '../../../../packages/editor/src/schema.js';
import { randomUUID } from 'node:crypto';
export interface DurableAcknowledgement {
  type: 'durable';
  pageId: string;
  generation: number;
  version: number;
  stateVector: string;
  snapshot: string;
}
export class Documents {
  constructor(readonly db: Database) {}
  async load(page: string): Promise<Y.Doc> {
    const [row] = await this.db.query<{ state: Uint8Array }>(
      'SELECT state FROM documents WHERE page_id=$1',
      [page],
    );
    if (row) {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, new Uint8Array(row.state));
      return doc;
    }
    const initial = documentFromJSON(emptyDocument);
    await this.db.query(
      'INSERT INTO documents (page_id,state) VALUES ($1,$2) ON CONFLICT (page_id) DO NOTHING',
      [page, Buffer.from(Y.encodeStateAsUpdate(initial))],
    );
    initial.destroy();
    return this.load(page);
  }
  async save(
    actor: Actor,
    pageId: string,
    update: Uint8Array,
    generation: number,
  ): Promise<DurableAcknowledgement> {
    if (update.byteLength > MAX_DOCUMENT_BYTES)
      throw new DomainError('LIMIT', 'This document update is too large.');
    return this.db.transaction(async (tx) => {
      const page = await new Access(tx).requirePage(actor, pageId, 'write');
      if (page.generation !== generation)
        throw new DomainError(
          'CONFLICT',
          'This recovered document belongs to an older generation.',
        );
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`document:${pageId}`]);
      const doc = await new Documents(tx).load(pageId);
      try {
        Y.applyUpdate(doc, update);
        editorSchema().nodeFromJSON(documentJSON(doc)).check();
        const state = Y.encodeStateAsUpdate(doc);
        if (state.length > MAX_DOCUMENT_BYTES)
          throw new DomainError('LIMIT', 'This document exceeds the current size limit.');
        const [row] = await tx.query<{ version: string | number }>(
          'UPDATE documents SET state=$2,version=version+1,updated_at=now() WHERE page_id=$1 RETURNING version',
          [pageId, Buffer.from(state)],
        );
        await tx.query(
          `INSERT INTO document_checkpoints (id,page_id,state) SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM document_checkpoints WHERE page_id=$2 AND created_at>now()-interval '10 minutes')`,
          [randomUUID(), pageId, Buffer.from(state)],
        );
        await tx.query(
          'UPDATE pages SET index_revision=index_revision+1,updated_at=now() WHERE id=$1',
          [pageId],
        );
        await tx.query(
          'INSERT INTO outbox (page_id,version) SELECT id,index_revision FROM pages WHERE id=$1',
          [pageId],
        );
        return {
          type: 'durable',
          pageId,
          generation,
          version: Number(row.version),
          stateVector: Buffer.from(Y.encodeStateVector(doc)).toString('base64'),
          snapshot: Buffer.from(Y.encodeSnapshot(Y.snapshot(doc))).toString('base64'),
        };
      } finally {
        doc.destroy();
      }
    });
  }
  async acknowledgement(actor: Actor, pageId: string): Promise<DurableAcknowledgement> {
    const page = await new Access(this.db).requirePage(actor, pageId, 'read');
    const doc = await this.load(pageId);
    const [row] = await this.db.query<{ version: string | number }>(
      'SELECT version FROM documents WHERE page_id=$1',
      [pageId],
    );
    const result: DurableAcknowledgement = {
      type: 'durable',
      pageId,
      generation: page.generation,
      version: Number(row.version),
      stateVector: Buffer.from(Y.encodeStateVector(doc)).toString('base64'),
      snapshot: Buffer.from(Y.encodeSnapshot(Y.snapshot(doc))).toString('base64'),
    };
    doc.destroy();
    return result;
  }
}
