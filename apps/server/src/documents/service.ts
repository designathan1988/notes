import { markPagesChanged } from '../pages/revisions.js';
import * as Y from 'yjs';
import type { Database } from '../platform/database.js';
import { DomainError, MAX_DOCUMENT_BYTES, type Actor, type PageKind } from '@note/contracts';
import { Access } from '../access/service.js';
import {
  documentFromJSON,
  documentJSON,
  validateDocument,
  emptyDocument,
} from '@note/editor/schema';
import { emptyCanvas } from '@note/editor/canvas';
import { reconcileCanvasTopology } from '@note/editor/canvas-reconcile';
import { captureCheckpoint } from '../history/checkpoints.js';
export interface DurableAcknowledgement {
  type: 'durable';
  pageId: string;
  generation: number;
  version: number;
  stateVector: string;
  snapshot: string;
}
interface DocumentCommit {
  acknowledgement: DurableAcknowledgement;
  repair?: Uint8Array;
}
export class Documents {
  constructor(readonly db: Database) {}
  async importContent(actor: Actor, pageId: string, source: Y.Doc, generation: number) {
    return this.db.transaction(async (tx) => {
      const page = await new Access(tx).lockPage(actor, pageId);
      try {
        validateDocument(documentJSON(source), page.kind);
      } catch {
        throw new DomainError('INVALID', 'The imported content does not match this page type.');
      }
      const current = await new Documents(tx).load(pageId);
      try {
        const root = current.getXmlFragment('default');
        const placeholder = root.length === 1 ? root.get(0) : null;
        if (
          placeholder instanceof Y.XmlElement &&
          ['paragraph', 'canvasRoot'].includes(placeholder.nodeName) &&
          placeholder.length === 0
        )
          root.delete(0, 1);
        root.insert(
          root.length,
          source
            .getXmlFragment('default')
            .toArray()
            .map((node) => {
              if (node instanceof Y.XmlElement || node instanceof Y.XmlText) return node.clone();
              throw new DomainError('INVALID', 'Unsupported imported document structure.');
            }),
        );
        return new Documents(tx).save(actor, pageId, Y.encodeStateAsUpdate(current), generation);
      } finally {
        current.destroy();
      }
    });
  }
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
    const [location] = await this.db.query<{ kind: PageKind }>(
      'SELECT kind FROM pages WHERE id=$1',
      [page],
    );
    if (!location) throw new DomainError('NOT_FOUND', 'This page is unavailable.');
    const initial = documentFromJSON(
      location.kind === 'canvas' ? emptyCanvas : emptyDocument,
      location.kind,
    );
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
    return (await this.merge(actor, pageId, update, generation)).acknowledgement;
  }
  async merge(
    actor: Actor,
    pageId: string,
    update: Uint8Array,
    generation: number,
  ): Promise<DocumentCommit> {
    if (update.byteLength > MAX_DOCUMENT_BYTES)
      throw new DomainError('LIMIT', 'This document update is too large.');
    return this.db.transaction(async (tx) => {
      const page = await new Access(tx).lockPage(actor, pageId);
      if (page.generation !== generation)
        throw new DomainError(
          'CONFLICT',
          'This recovered document belongs to an older generation.',
        );
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`document:${pageId}`]);
      const doc = await new Documents(tx).load(pageId);
      try {
        const before = Y.encodeStateAsUpdate(doc);
        let repair: Uint8Array | undefined;
        try {
          Y.applyUpdate(doc, update);
          if (page.kind === 'canvas') {
            const vector = Y.encodeStateVector(doc);
            if (reconcileCanvasTopology(doc)) repair = Y.encodeStateAsUpdate(doc, vector);
          }
          validateDocument(documentJSON(doc), page.kind);
        } catch {
          throw new DomainError('INVALID', 'This page contains invalid or incompatible content.');
        }
        const state = Y.encodeStateAsUpdate(doc);
        if (Buffer.from(before).equals(Buffer.from(state))) {
          const [stored] = await tx.query<{ version: string | number }>(
            'SELECT version FROM documents WHERE page_id=$1',
            [pageId],
          );
          return {
            acknowledgement: {
              type: 'durable',
              pageId,
              generation,
              version: Number(stored.version),
              stateVector: Buffer.from(Y.encodeStateVector(doc)).toString('base64'),
              snapshot: Buffer.from(Y.encodeSnapshot(Y.snapshot(doc))).toString('base64'),
            },
            repair,
          };
        }
        if (state.length > MAX_DOCUMENT_BYTES)
          throw new DomainError('LIMIT', 'This document exceeds the current size limit.');
        const [row] = await tx.query<{ version: string | number }>(
          'UPDATE documents SET state=$2,version=version+1,updated_at=now() WHERE page_id=$1 RETURNING version',
          [pageId, Buffer.from(state)],
        );
        await captureCheckpoint(tx, {
          pageId,
          workspaceId: page.workspaceId,
          state,
          version: Number(row.version),
          authorId: actor.userId,
          kind: 'automatic',
        });
        await markPagesChanged(tx, [pageId], { touch: true });
        return {
          acknowledgement: {
            type: 'durable',
            pageId,
            generation,
            version: Number(row.version),
            stateVector: Buffer.from(Y.encodeStateVector(doc)).toString('base64'),
            snapshot: Buffer.from(Y.encodeSnapshot(Y.snapshot(doc))).toString('base64'),
          },
          repair,
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
