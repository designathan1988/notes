import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openDatabase, migrate, type Database } from '../apps/server/src/platform/database.js';

/**
 * The migrated, seeded database is built once and kept as a snapshot keyed by the migrations
 * and this file. Every test then starts from the snapshot instead of migrating again, which
 * was most of the time the unit tests took.
 */
let template: Promise<Blob> | undefined;
async function snapshot(): Promise<Blob> {
  const hash = createHash('sha256');
  const migrations = 'apps/server/migrations';
  for (const name of readdirSync(migrations).sort())
    hash.update(name).update(readFileSync(join(migrations, name)));
  hash.update(readFileSync('tests/helpers.ts')).update(readFileSync('package-lock.json'));
  const directory = 'node_modules/.cache/note-tests';
  const file = join(directory, hash.digest('hex').slice(0, 24) + '.tar');
  if (existsSync(file)) return new Blob([readFileSync(file)]);
  const db = await build();
  const blob = await db.snapshot!();
  await db.close();
  mkdirSync(directory, { recursive: true });
  writeFileSync(file, Buffer.from(await blob.arrayBuffer()));
  return blob;
}
export async function fixture() {
  return openDatabase({ snapshot: await (template ??= snapshot()) });
}
async function build() {
  const db = await openDatabase();
  await migrate(db);
  for (const id of ['owner', 'admin', 'editor', 'viewer', 'outsider'])
    await db.query('INSERT INTO "user" (id,name,email,email_verified) VALUES ($1,$1,$2,true)', [
      id,
      `${id}@note.test`,
    ]);
  await db.query(
    "INSERT INTO organization (id,name,slug) VALUES ('studio','Studio workspace','studio'),('other','Other workspace','other')",
  );
  for (const role of ['owner', 'admin', 'editor', 'viewer'])
    await db.query('INSERT INTO member (id,organization_id,user_id,role) VALUES ($1,$2,$1,$1)', [
      role,
      'studio',
    ]);
  await db.query(
    "INSERT INTO member (id,organization_id,user_id,role) VALUES ('outsider','other','outsider','owner')",
  );
  return db;
}
export async function rawPage(
  db: Database,
  values: {
    id?: string;
    workspace?: string;
    parent?: string;
    creator?: string;
    visibility?: string;
    kind?: string;
    title?: string;
  } = {},
) {
  const id = values.id ?? randomUUID();
  await db.query(
    'INSERT INTO pages (id,workspace_id,parent_id,title,created_by,visibility,kind) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [
      id,
      values.workspace ?? 'studio',
      values.parent ?? null,
      values.title ?? 'A note',
      values.creator ?? 'owner',
      values.visibility ?? 'workspace',
      values.kind ?? 'document',
    ],
  );
  return id;
}
