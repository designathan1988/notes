import { expect, test } from 'vitest';
import Fastify from 'fastify';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { fixture, rawPage } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import type { Auth } from '../apps/server/src/identity/auth.js';
import { collaborationRoutes } from '../apps/server/src/documents/collaboration.js';
import { Access } from '../apps/server/src/access/service.js';
import { Documents } from '../apps/server/src/documents/service.js';
import { Pages } from '../apps/server/src/pages/service.js';
test('a transient failed socket write and its dependent delta both become durable without eviction', async () => {
  const db = await fixture();
  const page = await rawPage(db);
  let fail = false,
    failed!: () => void;
  const failureSeen = new Promise<void>((resolve) => (failed = resolve));
  const unreliable: Database = {
    ...db,
    transaction: async (fn) => {
      if (fail) {
        fail = false;
        failed();
        throw new Error('Temporary database failure');
      }
      return db.transaction(fn);
    },
  };
  const app = Fastify();
  const auth = { api: { getSession: async () => ({ user: { id: 'owner' } }) } } as unknown as Auth;
  const collaboration = await collaborationRoutes(app, unreliable, auth, new Access(unreliable));
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('Socket fixture unavailable');
  const doc = new Y.Doc();
  const provider = new HocuspocusProvider({
    url: `ws://127.0.0.1:${address.port}/collaboration`,
    name: `${page}:1`,
    document: doc,
    token: 'fixture',
  });
  try {
    await new Promise<void>((resolve) => provider.on('synced', () => resolve()));
    await new Promise((resolve) => setTimeout(resolve, 30));
    fail = true;
    doc.getText('probe').insert(0, 'A');
    await failureSeen;
    doc.getText('probe').insert(1, 'B');
    await expect
      .poll(
        async () => {
          const saved = await new Documents(db).load(page);
          try {
            return saved.getText('probe').toString();
          } finally {
            saved.destroy();
          }
        },
        { timeout: 2500 },
      )
      .toBe('AB');
    const pages = new Pages(db);
    pages.onChanged = (workspace) => {
      void collaboration.invalidate(workspace);
    };
    const other = await pages.create({ userId: 'owner' }, 'studio', { title: 'Other page' });
    const disconnected = new Promise<boolean>((resolve) =>
      provider.on('close', () => resolve(true)),
    );
    await pages.update({ userId: 'owner' }, other.id, {
      title: 'Renamed other page',
      revision: other.revision,
    });
    expect(
      await Promise.race([
        disconnected,
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 150)),
      ]),
    ).toBe(false);
    doc.getText('probe').insert(2, 'C');
    await expect
      .poll(async () => {
        const saved = await new Documents(db).load(page);
        try {
          return saved.getText('probe').toString();
        } finally {
          saved.destroy();
        }
      })
      .toBe('ABC');
  } finally {
    provider.destroy();
    doc.destroy();
    await app.close();
    await db.close();
  }
});
