import type { FastifyInstance } from 'fastify';
import type { Database } from '../platform/database.js';
import type { Storage } from '../attachments/storage.js';
import { Transfer } from './service.js';
import { MAX_ARCHIVE_BYTES } from './archive.js';
import { Access } from '../access/service.js';
import { Documents } from '../documents/service.js';
import { documentJSON, projectDocument } from '../../../../packages/editor/src/schema.js';
import { exportWebsite } from './website.js';
export function transferRoutes(app: FastifyInstance, db: Database, storage: Storage) {
  const transfer = new Transfer(db, storage);
  app.get<{ Params: { id: string }; Querystring: { position?: string } }>(
    '/api/pages/:id/website',
    async (request, reply) => {
      const bytes = await exportWebsite(
        db,
        storage,
        request.actor,
        request.params.id,
        Number(request.query.position ?? 0),
      );
      return reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', 'attachment; filename="website.zip"')
        .header('Cache-Control', 'no-store')
        .send(Buffer.from(bytes));
    },
  );
  app.get<{ Params: { workspace: string } }>(
    '/api/workspaces/:workspace/export',
    async (request, reply) => {
      const bytes = await transfer.exportWorkspace(request.actor, request.params.workspace);
      return reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', 'attachment; filename="note-workspace.zip"')
        .header('Cache-Control', 'no-store')
        .send(Buffer.from(bytes));
    },
  );
  app.post<{ Params: { workspace: string } }>(
    '/api/workspaces/:workspace/imports',
    { bodyLimit: MAX_ARCHIVE_BYTES },
    (request) =>
      transfer.beginImport(request.actor, request.params.workspace, request.body as Buffer),
  );
  app.get<{ Params: { workspace: string } }>('/api/workspaces/:workspace/imports', (request) =>
    transfer.list(request.actor, request.params.workspace),
  );
  app.post<{ Params: { id: string } }>('/api/imports/:id/advance', (request) =>
    transfer.advance(request.actor, request.params.id),
  );
  app.get<{ Params: { id: string } }>('/api/pages/:id/markdown', async (request, reply) => {
    const page = await new Access(db).requirePage(request.actor, request.params.id, 'read');
    const doc = await new Documents(db).load(page.id);
    const content = projectDocument(documentJSON(doc));
    doc.destroy();
    const text = `# ${page.title}\n\n${page.description}\n\n${content.text}\n\n<!-- Plain Markdown export preserves text; use the workspace ZIP for full-fidelity blocks, records, and media. -->\n`;
    return reply
      .header('Content-Type', 'text/markdown; charset=utf-8')
      .header(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(page.title + '.md')}`,
      )
      .send(text);
  });
}
