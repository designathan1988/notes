import { randomUUID } from 'node:crypto';
import type { Database } from '../platform/database.js';
import { DomainError, type HistoryEntry } from '@note/contracts';
import { availableStorage } from '../platform/storage-capacity.js';

export const checkpointColumns = `c.id,c.page_id AS "pageId",c.label,c.kind,c.version::integer,coalesce(u.name,'System') AS "authorName",c.created_at AS "createdAt"`;
export async function captureCheckpoint(
  db: Database,
  input: {
    pageId: string;
    workspaceId: string;
    state: Uint8Array;
    version: number;
    authorId: string;
    label?: string;
    kind: HistoryEntry['kind'];
  },
) {
  if (input.kind === 'automatic') {
    const existing = await db.query(
      "SELECT id FROM document_checkpoints WHERE page_id=$1 AND created_at>now()-interval '10 minutes' LIMIT 1",
      [input.pageId],
    );
    if (existing.length) return null;
  }
  // The workspace guard held by the caller serializes quota checks with uploads and other snapshots.
  if ((await availableStorage(db, input.workspaceId)) < input.state.byteLength) {
    if (input.kind === 'automatic') return null;
    throw new DomainError('LIMIT', 'Workspace storage is full. A new version cannot be saved.');
  }
  const id = randomUUID();
  await db.query(
    'INSERT INTO document_checkpoints (id,page_id,state,author_id,label,kind,version) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [
      id,
      input.pageId,
      Buffer.from(input.state),
      input.authorId,
      input.label ?? '',
      input.kind,
      input.version,
    ],
  );
  return id;
}
