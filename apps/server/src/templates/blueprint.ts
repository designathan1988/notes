import { createHash } from 'node:crypto';
import * as Y from 'yjs';
import type { JSONContent } from '@tiptap/core';
import {
  DomainError,
  type Actor,
  type Page,
  type RecordField,
  type SavedDatabaseView,
} from '@note/contracts';
import { documentJSON, emptyDocument } from '@note/editor/schema';
import { emptyCanvas } from '@note/editor/canvas';
import type { Database } from '../platform/database.js';
import { Access } from '../access/service.js';
import { toPage, type PageRow } from '../pages/model.js';
import { Databases } from '../databases/service.js';
import { assertSourceReady } from './metadata.js';

export interface BlueprintAsset {
  id: string;
  page_id: string;
  filename: string;
  media_type: string;
  size: number;
  object_key: string;
  status: string;
}
export interface BlueprintNode {
  page: Page;
  depth: number;
  content: JSONContent;
  assets: BlueprintAsset[];
  database?: {
    fields: RecordField[];
    fieldsRevision: number;
    viewsRevision: number;
    views: SavedDatabaseView[];
  };
  record?: { database_id: string; values: Record<string, unknown>; revision: number };
}
export interface Blueprint {
  nodes: BlueprintNode[];
  proof: string;
}

/** A transactionally consistent, bounded read; page bodies remain canonical Yjs documents. */
export async function readBlueprint(
  db: Database,
  actor: Actor,
  workspace: string,
  sourceId: string,
): Promise<Blueprint> {
  const access = new Access(db),
    root = await access.requirePage(actor, sourceId, 'read');
  if (root.workspaceId !== workspace)
    throw new DomainError('FORBIDDEN', 'Copy within the selected workspace.');
  await assertSourceReady(db, sourceId);
  const rows = await db.query<PageRow & { depth: number }>(
    `WITH RECURSIVE branch AS (
    SELECT p.*,0 AS depth FROM pages p WHERE p.id=$1 AND p.deleted_at IS NULL
    UNION ALL SELECT p.*,b.depth+1 FROM pages p JOIN branch b ON p.parent_id=b.id WHERE p.deleted_at IS NULL AND b.depth<200
  ) SELECT * FROM branch LIMIT 201`,
    [sourceId],
  );
  if (rows.length > 200)
    throw new DomainError('LIMIT', 'A template can contain up to 200 owned pages.');
  rows.sort((a, b) => a.depth - b.depth || a.position - b.position || a.id.localeCompare(b.id));
  const nodes: BlueprintNode[] = [];
  let documentBytes = 0,
    attachmentBytes = 0,
    attachmentCount = 0;
  for (const row of rows) {
    const page = toPage({
      ...row,
      visibility: root.visibility,
      private_owner_id: root.accessOwnerId,
    });
    const [stored] = await db.query<{ state: Uint8Array }>(
      'SELECT state FROM documents WHERE page_id=$1',
      [page.id],
    );
    let content: JSONContent = page.kind === 'canvas' ? emptyCanvas : emptyDocument;
    if (stored) {
      const doc = new Y.Doc();
      try {
        Y.applyUpdate(doc, new Uint8Array(stored.state));
        content = documentJSON(doc);
      } finally {
        doc.destroy();
      }
    }
    documentBytes += Buffer.byteLength(JSON.stringify(content));
    if (documentBytes > 16 * 1024 * 1024)
      throw new DomainError('LIMIT', 'Template content exceeds the 16 MiB copy budget.');
    const assets = await db.query<BlueprintAsset>(
      "SELECT * FROM attachments WHERE page_id=$1 AND status='ready' ORDER BY id",
      [page.id],
    );
    const wanted = new Set<string>(page.cover?.type === 'image' ? [page.cover.attachmentId] : []),
      queue = [content];
    for (let index = 0; index < queue.length; index++) {
      if (queue.length > 100000)
        throw new DomainError('LIMIT', 'The template contains too many blocks.');
      const node = queue[index];
      if (node.type === 'attachment') wanted.add(String(node.attrs?.id ?? ''));
      queue.push(...(node.content ?? []));
    }
    for (const id of wanted) {
      if (assets.some((asset) => asset.id === id)) continue;
      const [asset] = await db.query<BlueprintAsset>('SELECT * FROM attachments WHERE id=$1', [id]);
      if (!asset || asset.status !== 'ready')
        throw new DomainError('CONFLICT', 'An embedded file is unavailable or still uploading.');
      await access.requirePage(actor, asset.page_id, 'read');
      assets.push(asset);
    }
    assets.sort((a, b) => a.id.localeCompare(b.id));
    attachmentBytes += assets.reduce((total, asset) => total + asset.size, 0);
    attachmentCount += assets.length;
    if (attachmentBytes > 64 * 1024 * 1024 || attachmentCount > 500)
      throw new DomainError(
        'LIMIT',
        'Template attachments exceed the 64 MiB / 500-file copy budget.',
      );
    const node: BlueprintNode = { page, depth: row.depth, content, assets };
    if (page.kind === 'database') {
      const definition = await new Databases(db).definition(actor, page.id);
      node.database = {
        fields: definition.fields,
        fieldsRevision: definition.fieldsRevision,
        viewsRevision: definition.viewsRevision,
        views: definition.views,
      };
    }
    if (page.kind === 'record') {
      const [record] = await db.query<NonNullable<BlueprintNode['record']>>(
        'SELECT database_id,values,revision FROM records WHERE page_id=$1',
        [page.id],
      );
      if (!record) throw new DomainError('INVALID', 'A record is missing its canonical data.');
      node.record = record;
    }
    nodes.push(node);
  }
  const databaseId = root.templateDatabaseId ?? (root.kind === 'record' ? root.parentId : null);
  let defaultSchema: unknown = null;
  if (databaseId) {
    try {
      const definition = await new Databases(db).definition(actor, databaseId);
      defaultSchema = {
        id: databaseId,
        fields: definition.fields,
        revision: definition.fieldsRevision,
      };
    } catch (error) {
      if (
        !(error instanceof DomainError) ||
        !['FORBIDDEN', 'NOT_FOUND', 'INVALID'].includes(error.code)
      )
        throw error;
      defaultSchema = 'unavailable';
    }
  }
  const proof = createHash('sha256')
    .update(
      JSON.stringify({
        nodes: nodes.map((node) => ({
          ...node,
          page: { ...node.page, updatedAt: undefined, hasChildren: undefined },
        })),
        defaultSchema,
      }),
    )
    .digest('hex');
  return { nodes, proof };
}
