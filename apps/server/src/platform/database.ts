import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { drizzle as localDrizzle } from 'drizzle-orm/pglite';
import { drizzle as postgresDrizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as schema from '../identity/schema.js';

export interface Database {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>;
  transaction<T>(fn: (tx: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  orm: ReturnType<typeof localDrizzle> | ReturnType<typeof postgresDrizzle>;
}

export async function openDatabase(options: { directory?: string; url?: string } = {}): Promise<Database> {
  if (options.url) {
    const pool = new pg.Pool({ connectionString: options.url });
    const orm = postgresDrizzle(pool, { schema });
    const make = (client: Pick<pg.Pool, 'query'>): Database => ({
      orm,
      async query<T>(text: string, params: unknown[] = []) { return (await client.query(text, params)).rows as T[]; },
      async exec(text) { await client.query(text); },
      async transaction<T>(fn: (tx: Database) => Promise<T>) {
        const connection = await pool.connect();
        try { await connection.query('BEGIN'); const result = await fn(make(connection)); await connection.query('COMMIT'); return result; }
        catch (error) { await connection.query('ROLLBACK'); throw error; }
        finally { connection.release(); }
      },
      async close() { await pool.end(); },
    });
    return make(pool);
  }
  const client = new PGlite({ dataDir: options.directory, extensions: { pg_trgm } });
  await client.waitReady;
  const orm = localDrizzle(client, { schema });
  type LocalQuery = Pick<PGlite, 'query' | 'exec'>;
  const make = (connection: LocalQuery): Database => ({
    orm,
    async query<T>(text: string, params: unknown[] = []) { return (await connection.query<T>(text, params)).rows; },
    async exec(text) { await connection.exec(text); },
    async transaction<T>(fn: (tx: Database) => Promise<T>) { return client.transaction(async tx => fn(make(tx))); },
    async close() { await client.close(); },
  });
  return make(client);
}

export async function migrate(db: Database) {
  const migration = await readFile(resolve('apps/server/migrations/001-initial.sql'), 'utf8');
  await db.exec(migration);
}
