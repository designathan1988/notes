import { enqueueMissingProjections } from './queue.js';
import type { FastifyInstance } from 'fastify';
import { Knowledge } from './service.js';
import type { Database } from '../platform/database.js';
import { assertObject } from '@note/contracts';
export async function knowledgeRoutes(app: FastifyInstance, db: Database) {
  const knowledge = new Knowledge(db);
  app.post<{ Params: { workspace: string } }>(
    '/api/workspaces/:workspace/references',
    (request) => {
      assertObject(request.body);
      return knowledge.references(request.actor, request.params.workspace, request.body.ids);
    },
  );
  let processing: Promise<void> | null = null;
  await enqueueMissingProjections(db);
  const tick = () => {
    if (!processing)
      processing = knowledge
        .processOutbox()
        .catch((error) => app.log.error(error))
        .finally(() => {
          processing = null;
        });
  };
  tick();
  const timer = setInterval(tick, 350);
  timer.unref();
  app.addHook('onClose', async () => {
    clearInterval(timer);
    await processing;
  });
  app.get<{
    Params: { workspace: string };
    Querystring: { q?: string; kind?: string; after?: string; tag?: string };
  }>('/api/workspaces/:workspace/search', (request) =>
    knowledge.search(request.actor, request.params.workspace, request.query.q ?? '', request.query),
  );
  app.get<{ Params: { workspace: string }; Querystring: { center?: string } }>(
    '/api/workspaces/:workspace/graph',
    (request) => knowledge.graph(request.actor, request.params.workspace, request.query.center),
  );
  app.get<{ Params: { id: string } }>('/api/pages/:id/backlinks', (request) =>
    knowledge.backlinks(request.actor, request.params.id),
  );
  return knowledge;
}
