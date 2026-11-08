import type { Database } from './database.js';
/** Call under the workspace write guard before reserving persisted binary data. */
export async function availableStorage(db: Database, workspaceId: string) {
  const [capacity] = await db.query<{ available: string }>(
    `SELECT (
    coalesce((SELECT storage_limit FROM beta_entitlements WHERE workspace_id=$1),1073741824)
    - coalesce((SELECT sum(a.size) FROM attachments a JOIN pages p ON p.id=a.page_id WHERE p.workspace_id=$1),0)
    - coalesce((SELECT sum(octet_length(c.state)) FROM document_checkpoints c JOIN pages p ON p.id=c.page_id WHERE p.workspace_id=$1),0))::text AS available`,
    [workspaceId],
  );
  return Number(capacity.available);
}
