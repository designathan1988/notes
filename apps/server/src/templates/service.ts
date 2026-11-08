import * as Y from 'yjs';
import type { Database } from '../platform/database.js';
import { DomainError, type Actor } from '@note/contracts';
import { Pages } from '../pages/service.js';
import { Access } from '../access/service.js';
import { toVisiblePage, type VisiblePageRow } from '../pages/model.js';
import { Documents } from '../documents/service.js';
import { assertSourceReady } from './metadata.js';

export interface TemplateQuery {
  q?: string;
  database?: string;
  kind?: string;
  after?: string;
  id?: string;
}

/** Read side of the template library. Writes go through TemplateClone and PageInstances. */
export class Templates {
  constructor(private readonly db: Database) {}

  async copyContext(actor: Actor, id: string) {
    const initial = await new Pages(this.db).get(actor, id);
    return this.db.transaction(async (tx) => {
      await new Access(tx).guardWorkspace(initial.workspaceId);
      const page = await new Pages(tx).get(actor, initial.id);
      await assertSourceReady(tx, page.id);
      const rows = await tx.query<{ id: string; generation: number; title: string }>(
        `WITH RECURSIVE branch AS (SELECT id,generation,title,0 AS depth FROM pages WHERE id=$1 AND deleted_at IS NULL UNION ALL SELECT p.id,p.generation,p.title,b.depth+1 FROM pages p JOIN branch b ON p.parent_id=b.id WHERE p.deleted_at IS NULL AND b.depth<200) SELECT id,generation,title FROM branch LIMIT 201`,
        [page.id],
      );
      if (rows.length > 200)
        throw new DomainError('LIMIT', 'A template can contain up to 200 owned pages.');
      return { userId: actor.userId, workspaceId: page.workspaceId, pages: rows };
    });
  }

  async preview(actor: Actor, id: string) {
    const initial = await new Pages(this.db).get(actor, id);
    return this.db.transaction(async (tx) => {
      await new Access(tx).guardWorkspace(initial.workspaceId);
      const page = await new Pages(tx).get(actor, initial.id);
      if (page.templateRootId !== page.id)
        throw new DomainError('INVALID', 'Choose a template root.');
      await assertSourceReady(tx, page.id);
      const doc = await new Documents(tx).load(page.id);
      try {
        return {
          pageId: page.id,
          state: Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64'),
        };
      } finally {
        doc.destroy();
      }
    });
  }

  /** Workspace of a copy source; access is checked by the copy command itself. */
  async sourceWorkspace(id: string): Promise<string> {
    const [row] = await this.db.query<{ workspace_id: string }>(
      'SELECT workspace_id FROM pages WHERE id=$1',
      [id],
    );
    if (!row) throw new DomainError('FORBIDDEN', 'This source is unavailable.');
    return row.workspace_id;
  }

  async list(actor: Actor, workspace: string, query: TemplateQuery) {
    const { q = '', database = '', kind = '', after, id = '' } = query;
    const scope = await new Access(this.db).scope(actor, workspace);
    if (after && (!Number.isFinite(Date.parse(after)) || !id || id.length > 128))
      throw new DomainError('INVALID', 'Invalid template cursor.');
    const rows = await this.db.query<VisiblePageRow>(
      `${scope.sql} SELECT p.* FROM visible p LEFT JOIN search_projection s ON s.page_id=p.id
      WHERE p.template_root_id=p.id AND ($3='' OR p.title ILIKE $4 OR p.description ILIKE $4 OR s.tokens @@ websearch_to_tsquery('simple',$3))
      AND ($5='' OR p.template_database_id=$5) AND ($6='' OR ($6='record' AND p.template_database_id IS NOT NULL) OR ($6='document' AND p.template_database_id IS NULL))
      AND ($7::timestamptz IS NULL OR (p.updated_at,p.id)<($7::timestamptz,$8))
      AND NOT EXISTS(SELECT 1 FROM transfer_jobs j CROSS JOIN LATERAL jsonb_each_text(j.mapping->'pages') m WHERE j.stage<>'complete' AND m.value=p.id)
      ORDER BY p.updated_at DESC,p.id DESC LIMIT 51`,
      [...scope.params, q.slice(0, 200), `%${q.slice(0, 200)}%`, database, kind, after ?? null, id],
    );
    const items = rows.slice(0, 50).map(toVisiblePage),
      last = items.at(-1),
      ids = items.flatMap((page) => (page.templateDatabaseId ? [page.templateDatabaseId] : []));
    const databases = await this.db.query<VisiblePageRow>(
      `${scope.sql} SELECT * FROM visible WHERE id=ANY($3::text[])`,
      [...scope.params, ids],
    );
    return {
      items,
      databases: databases.map(toVisiblePage),
      nextCursor: rows.length > 50 && last ? { after: last.updatedAt, id: last.id } : null,
    };
  }
}
