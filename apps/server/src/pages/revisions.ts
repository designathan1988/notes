import type { Database } from '../platform/database.js';
import { enqueueProjection } from '../knowledge/queue.js';

/** Live document generations for a workspace, or for one page branch. */
export function pageGenerations(
  db: Database,
  workspace: string,
  pageId?: string,
): Promise<{ id: string; generation: number }[]> {
  return db.query<{ id: string; generation: number }>(
    pageId
      ? `WITH RECURSIVE branch AS (SELECT id,generation FROM pages WHERE id=$2 AND workspace_id=$1 UNION ALL SELECT p.id,p.generation FROM pages p JOIN branch b ON p.parent_id=b.id) SELECT * FROM branch`
      : 'SELECT id,generation FROM pages WHERE workspace_id=$1',
    pageId ? [workspace, pageId] : [workspace],
  );
}

/** Pages owns the pages table. Other modules change page counters and metadata only here. */

export async function markPagesChanged(
  db: Database,
  pageIds: string[],
  options: { touch?: boolean } = {},
): Promise<void> {
  if (!pageIds.length) return;
  await db.query(
    `UPDATE pages SET index_revision=index_revision+1${options.touch ? ',updated_at=now()' : ''} WHERE id = ANY($1::text[])`,
    [pageIds],
  );
  await enqueueProjection(db, pageIds);
}

export async function advancePageGeneration(db: Database, pageId: string): Promise<void> {
  await db.query('UPDATE pages SET generation=generation+1,revision=revision+1 WHERE id=$1', [
    pageId,
  ]);
}

export async function setTemplateMetadata(
  db: Database,
  pageId: string,
  metadata: { rootId: string | null; databaseId: string | null; values: Record<string, unknown> },
): Promise<void> {
  await db.query(
    'UPDATE pages SET template_root_id=$2,template_database_id=$3,template_values=$4 WHERE id=$1',
    [pageId, metadata.rootId, metadata.databaseId, JSON.stringify(metadata.values)],
  );
}
