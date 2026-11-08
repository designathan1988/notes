import type { Database } from '../platform/database.js';

/** Knowledge owns the projection queue. Other modules request reprojection through here. */
export async function enqueueProjection(db: Database, pageIds: string[]): Promise<void> {
  if (!pageIds.length) return;
  await db.query(
    'INSERT INTO outbox (page_id,version) SELECT id,index_revision FROM pages WHERE id = ANY($1::text[])',
    [pageIds],
  );
}

export async function enqueueMissingProjections(db: Database): Promise<void> {
  await db.query(
    'INSERT INTO outbox (page_id,version) SELECT id,index_revision FROM pages p WHERE NOT EXISTS (SELECT 1 FROM search_projection s WHERE s.page_id=p.id)',
  );
}
