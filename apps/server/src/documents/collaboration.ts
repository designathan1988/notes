import { Hocuspocus } from '@hocuspocus/server';
import { pageGenerations } from '../pages/revisions.js';
import * as Y from 'yjs';
import websocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import type { Database } from '../platform/database.js';
import type { Auth } from '../identity/auth.js';
import { Access } from '../access/service.js';
import { Documents, type DurableAcknowledgement } from './service.js';
import { DOCUMENT_ACCESS_CHANGED, DomainError, type Actor } from '@note/contracts';
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
    async beforeSync({ context, documentName, document, connection, type, payload }) {
      if (type === 0) {
        const durable = await documents.load(documentIdentity(documentName).pageId);
        try {
          Y.applyUpdate(document, Y.encodeStateAsUpdate(durable));
        } finally {
          durable.destroy();
        }
        return;
      }
      if (![1, 2].includes(type) || connection.readOnly) return;
      // Persist and validate before the hub applies or broadcasts an update. A failed
      // write stays queued on its connection, so dependent Yjs clocks cannot be lost.
      const saving = (async () => {
        for (let attempt = 0; ; attempt++) {
          try {
            return await documents.merge(
              context.actor,
              documentIdentity(documentName).pageId,
              payload,
              context.generation,
            );
          } catch (error) {
            if (error instanceof DomainError || attempt >= 2) throw error;
            await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
          }
        }
      })();
      pending.add(saving);
      try {
        const { acknowledgement: ack, repair } = await saving;
        // Publish the accepted payload and its reference repair atomically. The
        // hub's later application of the same payload is idempotent in Yjs.
        if (repair) Y.applyUpdate(document, Y.mergeUpdates([payload, repair]));
        document.broadcastStateless(JSON.stringify(ack));
      } catch (error) {
        connection.sendStateless(
          JSON.stringify({
            type: 'save-error',
            message:
              error instanceof Error
                ? error.message
                : 'Saving failed. Your local copy is retained.',
          }),
        );
        if (error instanceof DomainError)
          connection.close({
            code: 4403,
            reason: 'The update cannot be accepted. Keep your local recovery copy.',
          });
        throw error;
      } finally {
        pending.delete(saving);
      }
    },
    async onStateless({ connection, documentName, document, payload }) {
      if (payload === 'checkpoint') {
        await access.requirePage(
          connection.context.actor,
          documentIdentity(documentName).pageId,
          'read',
        );
        const durable = await documents.load(documentIdentity(documentName).pageId);
        try {
          Y.applyUpdate(document, Y.encodeStateAsUpdate(durable));
        } finally {
          durable.destroy();
        }
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
  const invalidate = async (workspace: string, pageId?: string) => {
    const pages = await pageGenerations(db, workspace, pageId);
    for (const page of pages)
      for (const connection of hub.documents
        .get(`${page.id}:${page.generation}`)
        ?.getConnections() ?? [])
        connection.close({ code: 1000, reason: DOCUMENT_ACCESS_CHANGED });
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
  app.get<{ Params: { id: string } }>('/api/pages/:id/document/acknowledgement', (request) =>
    documents.acknowledgement(request.actor, request.params.id),
  );
  const publish = async (ack: DurableAcknowledgement) => {
    // Restore commits a new generation. Old writers must retain their recovery copy,
    // rather than merge unsent text into deleted structures from a prior generation.
    for (const name of hub.documents.keys()) {
      const identity = documentIdentity(name);
      if (identity.pageId === ack.pageId && identity.generation !== ack.generation)
        hub.closeConnections(name);
    }
  };
  return { hub, invalidate, publish };
}
