import { expect, test } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Every table has exactly one owning server module; only that module writes it. */
const owners: Record<string, string> = {
  organization: 'access',
  member: 'access',
  invitation: 'access',
  beta_entitlements: 'access',
  pages: 'pages',
  favorites: 'pages',
  documents: 'documents',
  document_checkpoints: 'history',
  discussion_threads: 'discussion',
  discussion_messages: 'discussion',
  database_definitions: 'databases',
  records: 'databases',
  table_views: 'databases',
  attachments: 'attachments',
  search_projection: 'knowledge',
  link_projection: 'knowledge',
  outbox: 'knowledge',
  operation_keys: 'platform',
  schema_migrations: 'platform',
  appearance_preferences: 'identity',
  web_previews: 'web',
  transfer_jobs: 'transfer',
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}
const server = 'apps/server/src';
const serverFiles = files(server).map((path) => ({
  path: relative(server, path).split(sep).join('/'),
  text: readFileSync(path, 'utf8'),
}));
// Development fixtures seed many tables directly and never run in production.
const isSeed = (path: string) => /(^|\/)seed[\w-]*\.ts$/.test(path);

test('every migrated table has a declared owner', () => {
  const sql = readdirSync('apps/server/migrations')
    .map((name) => readFileSync(join('apps/server/migrations', name), 'utf8'))
    .join('\n');
  const tables = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS "?(\w+)"?/g)].map((m) => m[1]);
  const authTables = ['user', 'session', 'account', 'verification']; // written by better-auth
  expect(tables.filter((t) => !owners[t] && !authTables.includes(t))).toEqual([]);
});

test('only the owning module writes each table', () => {
  const violations: string[] = [];
  for (const { path, text } of serverFiles) {
    if (isSeed(path)) continue;
    const module = path.includes('/') ? path.split('/')[0] : '(root)';
    for (const match of text.matchAll(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"?(\w+)"?/g)) {
      const owner = owners[match[1]];
      if (owner && owner !== module)
        violations.push(`${path} writes ${match[1]} (owner: ${owner})`);
    }
  }
  expect(violations).toEqual([]);
});

test('route files delegate to services instead of running SQL', () => {
  const offenders = serverFiles
    .filter(({ path }) => /(^|[/-])routes\.ts$/.test(path))
    .filter(({ text }) => /\.(query|exec)\(/.test(text))
    .map(({ path }) => path);
  expect(offenders).toEqual([]);
});

test('client components change the store only through slice actions', () => {
  const web = 'apps/web/src';
  const offenders = files(web)
    .map((path) => relative(web, path).split(sep).join('/'))
    .filter((path) => !/(^|\/)(state|store)\.ts$/.test(path))
    .filter((path) => readFileSync(join(web, path), 'utf8').includes('useWorkspace.setState'));
  expect(offenders).toEqual([]);
});
