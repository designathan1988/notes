import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { drizzle as localDrizzle } from 'drizzle-orm/pglite';
import { drizzle as postgresDrizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import * as schema from '../identity/schema.js';

export interface Database {
  readonly transactional: boolean;
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>;
  transaction<T>(fn: (tx: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  /** Local databases only: the whole data directory, to start another database from it. */
  snapshot?(): Promise<Blob>;
  orm: ReturnType<typeof localDrizzle> | ReturnType<typeof postgresDrizzle>;
}

export async function openDatabase(
  options: { directory?: string; url?: string; snapshot?: Blob } = {},
): Promise<Database> {
  if (options.url) {
    const pool = new pg.Pool({ connectionString: options.url });
    const orm = postgresDrizzle(pool, { schema });
    const make = (client: Pick<pg.Pool, 'query'>, inTransaction = false): Database => ({
      transactional: inTransaction,
      orm,
      async query<T>(text: string, params: unknown[] = []) {
        return (await client.query(text, params)).rows as T[];
      },
      async exec(text) {
        await client.query(text);
      },
      async transaction<T>(fn: (tx: Database) => Promise<T>) {
        if (inTransaction) return fn(make(client, true));
        const connection = await pool.connect();
        try {
          await connection.query('BEGIN');
          const result = await fn(make(connection, true));
          await connection.query('COMMIT');
          return result;
        } catch (error) {
          await connection.query('ROLLBACK');
          throw error;
        } finally {
          connection.release();
        }
      },
      async close() {
        await pool.end();
      },
    });
    return make(pool);
  }
  // Starting from a snapshot skips initialization and migrations: tests use it to get a
  // ready database in milliseconds instead of rebuilding one each time.
  const client = new PGlite({
    dataDir: options.directory,
    loadDataDir: options.snapshot,
    extensions: { pg_trgm },
  });
  await client.waitReady;
  const orm = localDrizzle(client, { schema });
  type LocalQuery = Pick<PGlite, 'query' | 'exec'>;
  const make = (connection: LocalQuery, inTransaction = false): Database => ({
    transactional: inTransaction,
    orm,
    async query<T>(text: string, params: unknown[] = []) {
      return (await connection.query<T>(text, params)).rows;
    },
    async exec(text) {
      await connection.exec(text);
    },
    async transaction<T>(fn: (tx: Database) => Promise<T>) {
      if (inTransaction) return fn(make(connection, true));
      return client.transaction(async (tx) => fn(make(tx, true)));
    },
    async close() {
      await client.close();
    },
    snapshot: () => client.dumpDataDir('none'),
  });
  return make(client);
}

const MIGRATION_LOCK = 4_242_001;

/**
 * Runs a data repair exactly once, recorded beside the schema migrations. The repair and its
 * marker commit together.
 */
export async function runOnce(
  db: Database,
  version: string,
  repair: (tx: Database) => Promise<void>,
): Promise<void> {
  const [done] = await db.query('SELECT 1 FROM schema_migrations WHERE version=$1', [version]);
  if (done) return;
  await db.transaction(async (tx) => {
    await repair(tx);
    await tx.query(
      'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [version, 'data'],
    );
  });
}

/**
 * Applies numbered `NNN-name.sql` files in order, each in its own transaction, once.
 * Applied files are checksummed: never edit one — add a new numbered file instead.
 */
export async function migrate(db: Database, options: { directory?: string } = {}): Promise<void> {
  const directory = options.directory ?? resolve('apps/server/migrations');
  const files = (await readdir(directory))
    .filter((name) => /^\d+-.+\.sql$/.test(name))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b));
  for (const file of files) {
    const version = file.slice(0, -'.sql'.length);
    const sql = await readFile(join(directory, file), 'utf8');
    const checksum = createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
    await db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK]);
      await tx.exec(
        'CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
      );
      const [applied] = await tx.query<{ checksum: string }>(
        'SELECT checksum FROM schema_migrations WHERE version=$1',
        [version],
      );
      if (applied) {
        if (applied.checksum !== checksum)
          throw new Error(
            `Migration ${version} changed after it was applied; add a new numbered migration instead`,
          );
        return;
      }
      await tx.exec(sql);
      await tx.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [
        version,
        checksum,
      ]);
    });
  }
}
