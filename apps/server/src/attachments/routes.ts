import type { FastifyInstance } from 'fastify';
import type { Database } from '../platform/database.js';
import { Attachments } from './service.js';
import { storageFromEnvironment, type Storage } from './storage.js';
import { assertObject, MAX_FILE_BYTES } from '../../../../packages/contracts/src/index.js';
export function attachmentRoutes(
  app: FastifyInstance,
  db: Database,
  storage: Storage = storageFromEnvironment(),
) {
  const attachments = new Attachments(db, storage);
  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer', bodyLimit: 64 * 1024 * 1024 },
    (_request, body, done) => done(null, body),
  );
  app.post<{ Params: { id: string } }>('/api/pages/:id/attachments', (request) => {
    assertObject(request.body);
    return attachments.begin(request.actor, request.params.id, {
      filename: String(request.body.filename ?? ''),
      mediaType: String(request.body.mediaType ?? ''),
      size: Number(request.body.size),
    });
  });
  app.put<{ Params: { id: string } }>(
    '/api/attachments/:id/content',
    { bodyLimit: MAX_FILE_BYTES },
    (request) => attachments.upload(request.actor, request.params.id, request.body as Buffer),
  );
  app.get<{ Params: { id: string } }>('/api/attachments/:id/content', async (request, reply) => {
    const file = await attachments.read(request.actor, request.params.id);
    reply.header('Content-Type', file.inline ? file.mediaType : 'application/octet-stream');
    reply.header(
      'Content-Disposition',
      `${file.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    );
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Content-Security-Policy', "sandbox; default-src 'none'");
    reply.header('Cache-Control', 'private, no-store');
    return reply.send(file.bytes);
  });
  return attachments;
}
