import type { Database } from './platform/database.js';
import type { Auth } from './identity/auth.js';
import { Access } from './access/service.js';
import { Pages } from './pages/service.js';
export async function seed(db: Database, auth: Auth) {
  if (process.env.NODE_ENV === 'production') return;
  const [existing] = await db.query('SELECT id FROM "user" WHERE email=$1', ['jonathan@note.test']);
  if (existing) return;
  const { user } = await auth.api.signUpEmail({
    body: { name: 'Jonathan', email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
  });
  await auth.api.signUpEmail({
    body: { name: 'Amelia', email: 'amelia@note.test', password: 'Note-local-demo-2026' },
  });
  const actor = { userId: user.id };
  const access = new Access(db);
  const workspace = await access.createWorkspace(actor, 'Studio workspace');
  const pages = new Pages(db);
  const ids: Record<string, string> = {};
  for (const title of ['Getting started', 'Product', 'Reading room', 'Meeting notes'])
    ids[title] = (await pages.create(actor, workspace.id, { title })).id;
  for (const [title, kind, description] of [
    ['Product direction', 'document', 'A shared space for ideas that become something.'],
    ['Research', 'database', 'Evidence, observations, and the questions worth asking.'],
    ['Design principles', 'document', 'The thinking behind the product.'],
  ] as const)
    ids[title] = (
      await pages.create(actor, workspace.id, { title, kind, description, parentId: ids.Product })
    ).id;
  await db.query(
    'INSERT INTO member (id,organization_id,user_id,role) SELECT $1,$2,id,$3 FROM "user" WHERE email=$4',
    ['demo-editor', workspace.id, 'editor', 'amelia@note.test'],
  );
}
