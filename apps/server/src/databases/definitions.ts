import type { Database } from '../platform/database.js';

/** Databases owns definitions; page creation asks for an empty one here. */
export async function createDatabaseDefinition(db: Database, pageId: string): Promise<void> {
  await db.query('INSERT INTO database_definitions (page_id) VALUES ($1)', [pageId]);
}
