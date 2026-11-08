import type { Database } from './database.js';

/** Idempotency receipts for retried commands. */
export async function findOperation<T>(db: Database, key: string): Promise<T | undefined> {
  const [row] = await db.query<{ result: T }>('SELECT result FROM operation_keys WHERE id=$1', [
    key,
  ]);
  return row?.result;
}

export async function recordOperation(
  db: Database,
  key: string,
  result: unknown,
  options: { replace?: boolean } = {},
): Promise<void> {
  await db.query(
    `INSERT INTO operation_keys (id,result) VALUES ($1,$2)${options.replace ? ' ON CONFLICT (id) DO UPDATE SET result=excluded.result' : ''}`,
    [key, JSON.stringify(result)],
  );
}
