import { afterEach, expect, test } from 'vitest';
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openDatabase, migrate, type Database } from '../apps/server/src/platform/database.js';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0)) await fn();
});

async function migrationsDir() {
  const dir = await mkdtemp(join(tmpdir(), 'note-migrations-'));
  cleanup.push(() => rm(dir, { recursive: true, force: true }));
  await copyFile(resolve('apps/server/migrations/001-initial.sql'), join(dir, '001-initial.sql'));
  return dir;
}

async function database() {
  const db = await openDatabase();
  cleanup.push(() => db.close());
  return db;
}

const versions = async (db: Database) =>
  (
    await db.query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version')
  ).map((row) => row.version);

test('records each applied migration once', async () => {
  const db = await database();
  await migrate(db);
  await migrate(db);
  expect(await versions(db)).toEqual(['001-initial', '002-page-format']);
});

test('applies a new non-idempotent migration exactly once on an existing database', async () => {
  const dir = await migrationsDir();
  const db = await database();
  await migrate(db, { directory: dir });
  await writeFile(join(dir, '002-probe.sql'), 'ALTER TABLE pages ADD COLUMN migration_probe text;');
  await migrate(db, { directory: dir });
  await migrate(db, { directory: dir });
  expect(await versions(db)).toEqual(['001-initial', '002-probe']);
});

test('applies migrations in numeric order', async () => {
  const dir = await migrationsDir();
  await writeFile(join(dir, '010-second.sql'), 'INSERT INTO order_probe VALUES (2);');
  await writeFile(join(dir, '002-first.sql'), 'CREATE TABLE order_probe (n int);');
  const db = await database();
  await migrate(db, { directory: dir });
  expect(await versions(db)).toEqual(['001-initial', '002-first', '010-second']);
});

test('refuses to run when an applied migration was edited', async () => {
  const dir = await migrationsDir();
  const db = await database();
  await migrate(db, { directory: dir });
  await writeFile(join(dir, '001-initial.sql'), 'SELECT 1;');
  await expect(migrate(db, { directory: dir })).rejects.toThrow(/001-initial.*changed/);
});

test('a failing migration leaves no partial schema and is not recorded', async () => {
  const dir = await migrationsDir();
  const db = await database();
  await migrate(db, { directory: dir });
  await writeFile(
    join(dir, '002-broken.sql'),
    'CREATE TABLE half_done (id int); SELECT * FROM table_that_does_not_exist;',
  );
  await expect(migrate(db, { directory: dir })).rejects.toThrow();
  expect(await versions(db)).toEqual(['001-initial']);
  expect(await db.query("SELECT to_regclass('half_done') AS t")).toEqual([{ t: null }]);
});

test('adopts a database created by the previous unversioned bootstrap', async () => {
  const db = await database();
  const { readFile } = await import('node:fs/promises');
  await db.exec(await readFile(resolve('apps/server/migrations/001-initial.sql'), 'utf8'));
  await migrate(db);
  expect(await versions(db)).toEqual(['001-initial', '002-page-format']);
});
