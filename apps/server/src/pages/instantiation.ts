import { createHash } from 'node:crypto';
import * as Y from 'yjs';
import type { JSONContent } from '@tiptap/core';
import type { Database } from '../platform/database.js';
import { Access } from '../access/service.js';
import { Pages } from './service.js';
import { Documents } from '../documents/service.js';
import { Databases } from '../databases/service.js';
import type { Storage } from '../attachments/storage.js';
import type { Page, PageKind } from '../../../../packages/contracts/src/index.js';
import type { CloneInput } from '../templates/clone.js';
import { documentFromJSON, documentJSON } from '../../../../packages/editor/src/schema.js';
import {
  DomainError,
  MAX_DOCUMENT_BYTES,
  validateTitle,
  type Actor,
} from '../../../../packages/contracts/src/index.js';

export interface ContentInstanceInput {
  title: unknown;
  content: unknown;
  requestId: unknown;
  purpose?: unknown;
  description?: unknown;
  parentId?: unknown;
  visibility?: unknown;
  kind?: unknown;
  expectedUserId?: unknown;
}

/** One transaction owns creation from structured content; callers never write a second body. */
export class PageInstances {
  constructor(readonly db: Database) {}
  async copyFrom(
    actor: Actor,
    workspace: string,
    sourceId: string,
    input: CloneInput,
    storage: Storage,
  ) {
    const { TemplateClone } = await import('../templates/clone.js');
    return new TemplateClone(this.db, storage).create(actor, workspace, sourceId, input);
  }
  /** Internal canonical factory used by content recovery and complete tree instantiation. */
  async persist(
    actor: Actor,
    workspace: string,
    input: {
      id?: string;
      title: string;
      description?: string;
      parentId: string | null;
      visibility: Page['visibility'];
      kind: PageKind;
      content: Y.Doc;
    },
  ) {
    const page =
      input.kind === 'record'
        ? await new Databases(this.db)
            .createRecord(actor, input.parentId!, { title: input.title, values: {} }, input.id)
            .then((record) => new Pages(this.db).get(actor, record.pageId))
        : await new Pages(this.db).create(actor, workspace, input, input.id);
    await new Documents(this.db).importContent(actor, page.id, input.content, page.generation);
    return new Pages(this.db).get(actor, page.id);
  }
  async create(actor: Actor, workspace: string, input: ContentInstanceInput) {
    const title = validateTitle(input.title),
      purpose = input.purpose ?? 'copy';
    if (purpose === 'recovery' && input.expectedUserId !== actor.userId)
      throw new DomainError(
        'CONFLICT',
        'The signed-in account changed. Reopen local recovery before continuing.',
      );
    if (
      !['copy', 'recovery'].includes(String(purpose)) ||
      (input.kind !== undefined && input.kind !== 'document')
    )
      throw new DomainError('INVALID', 'Choose a supported document creation operation.');
    if (typeof input.requestId !== 'string' || !/^[\w-]{8,100}$/.test(input.requestId))
      throw new DomainError('INVALID', 'A stable creation request ID is required.');
    if (input.parentId != null && typeof input.parentId !== 'string')
      throw new DomainError('INVALID', 'Choose a valid parent page.');
    if (purpose === 'recovery' && input.parentId != null)
      throw new DomainError('INVALID', 'Recover into a private root page.');
    const description = input.description ?? '';
    if (typeof description !== 'string' || description.length > 2000 || description.includes('\0'))
      throw new DomainError('INVALID', 'Use a description up to 2,000 characters.');
    const visibility = purpose === 'recovery' ? 'private' : (input.visibility ?? 'workspace');
    if (!['private', 'workspace'].includes(String(visibility)))
      throw new DomainError('INVALID', 'Choose a valid page visibility.');
    if (!input.content || typeof input.content !== 'object' || Array.isArray(input.content))
      throw new DomainError('INVALID', 'Provide a structured document.');
    if (Buffer.byteLength(JSON.stringify(input.content)) > MAX_DOCUMENT_BYTES)
      throw new DomainError('LIMIT', 'This document exceeds the creation size limit.');
    let source: Y.Doc;
    try {
      source = documentFromJSON(input.content as JSONContent);
    } catch {
      throw new DomainError('INVALID', 'This document contains unsupported or invalid blocks.');
    }
    try {
      if (Y.encodeStateAsUpdate(source).byteLength > MAX_DOCUMENT_BYTES)
        throw new DomainError('LIMIT', 'This document exceeds the creation size limit.');
      const blueprint = {
        title,
        description,
        purpose,
        parentId: input.parentId ?? null,
        visibility,
        content: documentJSON(source),
      };
      // A source rename does not change the identity of a retained recovery state.
      const hash = createHash('sha256')
        .update(
          JSON.stringify(purpose === 'recovery' ? { ...blueprint, title: undefined } : blueprint),
        )
        .digest('hex');
      const key =
        'page-instance:' +
        createHash('sha256')
          .update(JSON.stringify([actor.userId, workspace, input.requestId]))
          .digest('hex');
      return await this.db.transaction(async (tx) => {
        const access = new Access(tx);
        await access.guardWorkspace(workspace);
        await access.requireWorkspace(actor, workspace, 'editor');
        const [existing] = await tx.query<{ result: { hash: string; pageId: string } }>(
          'SELECT result FROM operation_keys WHERE id=$1',
          [key],
        );
        if (existing) {
          if (existing.result.hash !== hash)
            throw new DomainError(
              'CONFLICT',
              'This creation request already belongs to a different document state.',
            );
          if (purpose !== 'recovery') return new Pages(tx).get(actor, existing.result.pageId);
          // Never acknowledge the only retained draft against a copy that has since
          // been edited, shared, moved, or discarded. Keep that page and make a new copy.
          let previous;
          try {
            previous = await new Pages(tx).get(actor, existing.result.pageId);
          } catch (error) {
            if (!(error instanceof DomainError) || error.code !== 'FORBIDDEN') throw error;
          }
          if (previous?.visibility === 'private' && previous.parentId === null) {
            const retained = await new Documents(tx).load(previous.id);
            try {
              if (JSON.stringify(documentJSON(retained)) === JSON.stringify(blueprint.content))
                return previous;
            } finally {
              retained.destroy();
            }
          }
        }
        const page = await new PageInstances(tx).persist(actor, workspace, {
          title,
          description,
          parentId: blueprint.parentId as string | null,
          visibility: visibility as 'private' | 'workspace',
          kind: 'document',
          content: source,
        });
        await tx.query(
          'INSERT INTO operation_keys (id,result) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET result=excluded.result',
          [key, JSON.stringify({ hash, pageId: page.id })],
        );
        return new Pages(tx).get(actor, page.id);
      });
    } finally {
      source.destroy();
    }
  }
}
