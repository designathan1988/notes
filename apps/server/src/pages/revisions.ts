import type { Database } from '../platform/database.js';
import { enqueueProjection } from '../knowledge/queue.js';

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
