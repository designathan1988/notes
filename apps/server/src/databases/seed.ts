import type { Database } from '../platform/database.js';
import { Databases } from './service.js';
export async function seedRecords(db: Database) {
  if (process.env.NODE_ENV === 'production') return;
  const [database] = await db.query<{ id: string; created_by: string }>(
    `SELECT p.id,p.created_by FROM pages p JOIN "user" u ON u.id=p.created_by WHERE p.title='Research' AND p.kind='database' AND u.email='jonathan@note.test' LIMIT 1`,
  );
  if (!database) return;
  const [count] = await db.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM records WHERE database_id=$1',
    [database.id],
  );
  if (Number(count.count)) return;
  const rows = [
    ['User interviews', 'Research', 'In progress', 'High', 0],
    ['Design principles', 'Document', 'Evergreen', 'High', 0],
    ['Reading list', 'Collection', 'Active', 'Medium', 1],
    ['Capture experience', 'Research', 'Planned', 'Medium', 1],
    ['Search and discovery', 'Research', 'In progress', 'High', 2],
    ['Connected thinking', 'Document', 'Draft', 'Low', 3],
    ['Information architecture', 'Research', 'Active', 'High', 4],
    ['Mobile workflows', 'Research', 'Planned', 'Medium', 5],
  ] as const;
  const service = new Databases(db);
  for (const [title, type, status, priority, days] of rows) {
    const record = await service.createRecord({ userId: database.created_by }, database.id, {
      title,
      values: { type, status, priority },
    });
    if (days)
      await db.query('UPDATE pages SET updated_at=$2 WHERE id=$1', [
        record.pageId,
        new Date(Date.now() - days * 86400000).toISOString(),
      ]);
  }
}
