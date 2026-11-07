import { randomUUID } from 'node:crypto';
import { openDatabase, migrate, type Database } from '../apps/server/src/platform/database.js';
export async function fixture() {
  const db = await openDatabase(); await migrate(db);
  for (const id of ['owner', 'admin', 'editor', 'viewer', 'outsider']) await db.query('INSERT INTO "user" (id,name,email,email_verified) VALUES ($1,$1,$2,true)', [id, `${id}@note.test`]);
  await db.query("INSERT INTO organization (id,name,slug) VALUES ('studio','Studio workspace','studio'),('other','Other workspace','other')");
  for (const role of ['owner', 'admin', 'editor', 'viewer']) await db.query('INSERT INTO member (id,organization_id,user_id,role) VALUES ($1,$2,$1,$1)', [role, 'studio']);
  await db.query("INSERT INTO member (id,organization_id,user_id,role) VALUES ('outsider','other','outsider','owner')");
  return db;
}
export async function rawPage(db: Database, values: { id?: string; workspace?: string; parent?: string; creator?: string; visibility?: string; kind?: string; title?: string } = {}) {
  const id = values.id ?? randomUUID();
  await db.query('INSERT INTO pages (id,workspace_id,parent_id,title,created_by,visibility,kind) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, values.workspace ?? 'studio', values.parent ?? null, values.title ?? 'A note', values.creator ?? 'owner', values.visibility ?? 'workspace', values.kind ?? 'document']);
  return id;
}
