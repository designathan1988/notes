import { Hocuspocus } from '@hocuspocus/server';
import websocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import type { Database } from '../platform/database.js';
import type { Auth } from '../identity/auth.js';
import { Access } from '../access/service.js';
import { Documents } from './service.js';
import { DomainError, type Actor } from '../../../../packages/contracts/src/index.js';
import { requestHeaders } from '../platform/http.js';
type Context = { actor: Actor; generation: number };
function documentIdentity(name: string) {
  const [pageId, generation] = name.split(':');
  if (!pageId || !/^\d+$/.test(generation ?? ''))
    throw new DomainError('INVALID', 'Invalid document identity.');
  return { pageId, generation: Number(generation) };
}
export async function collaborationRoutes(
  app: FastifyInstance,
  db: Database,
  auth: Auth,
  access: Access,
) {
  const documents = new Documents(db);
  const pending = new Set<Promise<unknown>>();
  const hub = new Hocuspocus<Context>({
    name: 'Note',
    quiet: true,
    debounce: 0,
    maxDebounce: 0,
    async onAuthenticate({ documentName, requestHeaders, connectionConfig }) {
      const session = await auth.api.getSession({ headers: requestHeaders });
      if (!session) throw new Error('Sign in again.');
      const actor = { userId: session.user.id };
      const { pageId, generation } = documentIdentity(documentName);
      const page = await access.requirePage(actor, pageId, 'read');
      if (page.generation !== generation) throw new Error('Document generation changed.');
      const role = await access.requireWorkspace(actor, page.workspaceId);
      connectionConfig.readOnly = role === 'viewer';
      return { actor, generation };
    },
    async onLoadDocument({ documentName }) {
      return documents.load(documentIdentity(documentName).pageId);
    },
    async beforeHandleMessage({ context, documentName, requestHeaders, connection }) {
      const session = await auth.api.getSession({ headers: requestHeaders });
      if (!session || session.user.id !== context.actor.userId) throw new Error('Session expired.');
      const page = await access.requirePage(
        context.actor,
        documentIdentity(documentName).pageId,
        'read',
      );
      const role = await access.requireWorkspace(context.actor, page.workspaceId);
      connection.readOnly = role === 'viewer';
      if (page.generation !== context.generation) throw new Error('Document generation changed.');
    },
    async onChange({ context, documentName, update, document }) {
      if (!context.actor) return;
      const saving = documents.save(
        context.actor,
        documentIdentity(documentName).pageId,
        update,
        context.generation,
      );
      pending.add(saving);
      try {
        const ack = await saving;
        document.broadcastStateless(JSON.stringify(ack));
      } catch (error) {
        document.broadcastStateless(
          JSON.stringify({
            type: 'save-error',
            message: error instanceof Error ? error.message : 'Saving failed.',
          }),
        );
      } finally {
        pending.delete(saving);
      }
    },
    async onStateless({ connection, documentName, payload }) {
      if (payload === 'checkpoint') {
        const ack = await documents.acknowledgement(
          connection.context.actor,
          documentIdentity(documentName).pageId,
        );
        connection.sendStateless(JSON.stringify(ack));
      }
    },
  });
  await app.register(websocket, { options: { maxPayload: 4 * 1024 * 1024 } });
  app.get('/collaboration', { websocket: true }, (socket, request) => {
    const origin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173';
    if (request.headers.origin && request.headers.origin !== origin) {
      socket.close(1008, 'Origin not allowed');
      return;
    }
    const client = hub.handleConnection(
      socket,
      new Request(new URL(request.url, origin), { headers: requestHeaders(request) }),
    );
    socket.on('message', (data: Buffer) => client.handleMessage(data));
    socket.on('close', () => client.handleClose());
    socket.on('error', () => client.handleClose());
  });
  const invalidate = async (workspace: string) => {
    const pages = await db.query<{ id: string; generation: number }>(
      'SELECT id,generation FROM pages WHERE workspace_id=$1',
      [workspace],
    );
    for (const page of pages) hub.closeConnections(`${page.id}:${page.generation}`);
  };
  access.onChanged = (workspace) => {
    void invalidate(workspace);
  };
  app.addHook('onClose', async () => {
    hub.closeConnections();
    await Promise.allSettled(pending);
    hub.flushPendingStores();
    for (const doc of hub.documents.values()) await hub.unloadDocument(doc);
  });
  app.get<{ Params: { id: string } }>('/api/pages/:id/document', async (request) => {
    const page = await access.requirePage(request.actor, request.params.id, 'read');
    return {
      generation: page.generation,
      readOnly: (await access.requireWorkspace(request.actor, page.workspaceId)) === 'viewer',
    };
  });
  return { hub, invalidate };
}
