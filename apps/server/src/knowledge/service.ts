import type { Database } from '../platform/database.js';
import type {
  Actor,
  SearchResult,
  KnowledgeLink,
  GraphData,
} from '../../../../packages/contracts/src/index.js';
import { Access } from '../access/service.js';
import { documentJSON, projectDocument } from '../../../../packages/editor/src/schema.js';
import * as Y from 'yjs';
import { compileFormulas } from '../../../../packages/data/src/formulas.js';
import type { PageProperties } from '../../../../packages/contracts/src/index.js';
export class Knowledge {
  constructor(readonly db: Database) {}
  async applyProjection(
    id: string,
    version: number,
    content: { text: string; links: string[] },
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`projection:${id}`]);
      const [page] = await tx.query<{ title: string; workspace_id: string }>(
        'SELECT title,workspace_id FROM pages WHERE id=$1',
        [id],
      );
      if (!page) return;
      const updated = await tx.query(
        `INSERT INTO search_projection (page_id,version,body,tokens) VALUES ($1,$2,$3,setweight(to_tsvector('simple',$4),'A') || setweight(to_tsvector('simple',$3),'B'))
        ON CONFLICT (page_id) DO UPDATE SET version=excluded.version,body=excluded.body,tokens=excluded.tokens WHERE search_projection.version<excluded.version RETURNING page_id`,
        [id, version, content.text.slice(0, 2000000), page.title],
      );
      if (!updated.length) return;
      await tx.query('DELETE FROM link_projection WHERE source_id=$1', [id]);
      const excerpt =
        content.text
          .split('\n')
          .map((line) => line.trim())
          .find((line) => line && line !== page.title) ?? '';
      for (const target of [...new Set(content.links)].slice(0, 1000))
        await tx.query(
          `INSERT INTO link_projection (source_id,target_id,excerpt) SELECT $1,id,$3 FROM pages WHERE id=$2 AND workspace_id=$4 ON CONFLICT DO NOTHING`,
          [id, target, excerpt.slice(0, 180), page.workspace_id],
        );
    });
  }
  async projectLatest(id: string) {
    const [page] = await this.db.query<{
      index_revision: string | number;
      description: string;
      tags: string[];
      page_properties: PageProperties;
      state: Uint8Array | null;
      values: Record<string, unknown> | null;
      computed_values: Record<string, unknown> | null;
    }>(
      `SELECT p.index_revision,p.description,p.tags,p.page_properties,d.state,r.values,r.computed_values FROM pages p LEFT JOIN documents d ON d.page_id=p.id LEFT JOIN records r ON r.page_id=p.id WHERE p.id=$1`,
      [id],
    );
    if (!page) return;
    let projection = { text: '', links: [] as string[] };
    if (page.state) {
      const doc = new Y.Doc();
      try {
        Y.applyUpdate(doc, new Uint8Array(page.state));
        projection = projectDocument(documentJSON(doc));
      } finally {
        doc.destroy();
      }
    }
    await this.applyProjection(id, Number(page.index_revision), {
      text: [
        page.description,
        ...page.tags,
        ...page.page_properties.fields.map((field) => field.name),
        ...Object.values(page.page_properties.values)
          .filter((value) => value !== null)
          .map(String),
        ...Object.values(compileFormulas(page.page_properties.fields)(page.page_properties.values))
          .filter((value) => value !== null)
          .map(String),
        projection.text,
        ...Object.values(page.values ?? {})
          .filter((value) => value !== null)
          .map(String),
        ...Object.values(page.computed_values ?? {})
          .filter((value) => value !== null)
          .map(String),
      ].join('\n'),
      links: [
        ...projection.links,
        ...page.page_properties.fields
          .filter((field) => field.type === 'relation' && !field.archived)
          .flatMap((field) =>
            page.page_properties.values[field.id]
              ? [String(page.page_properties.values[field.id])]
              : [],
          ),
      ],
    });
    await this.db.query(
      'UPDATE outbox SET processed_at=now() WHERE page_id=$1 AND version<=$2 AND processed_at IS NULL',
      [id, page.index_revision],
    );
  }
  async processOutbox() {
    const rows = await this.db.query<{ page_id: string }>(
      'SELECT DISTINCT page_id FROM outbox WHERE processed_at IS NULL LIMIT 100',
    );
    for (const row of rows) await this.projectLatest(row.page_id);
  }
  async rebuild() {
    await this.db.transaction(async (tx) => {
      await tx.query('DELETE FROM search_projection');
      await tx.query('DELETE FROM link_projection');
      await tx.query('INSERT INTO outbox (page_id,version) SELECT id,index_revision FROM pages');
    });
  }
  async search(
    actor: Actor,
    workspace: string,
    query: string,
    filters: { kind?: string; after?: string; tag?: string } = {},
  ): Promise<{ results: SearchResult[]; indexing: boolean }> {
    const scope = await new Access(this.db).scope(actor, workspace);
    const term = query.slice(0, 500).trim();
    const kind = ['document', 'database', 'record'].includes(filters.kind ?? '')
      ? filters.kind
      : '';
    const after = filters.after && /^\d{4}-\d{2}-\d{2}$/.test(filters.after) ? filters.after : null;
    const results = await this.db.query<SearchResult>(
      `${scope.sql}, search_query AS (SELECT websearch_to_tsquery('simple',$3) AS q),
      tagged AS (SELECT id FROM pages WHERE workspace_id=$1 AND tags @> ARRAY[$7]::text[])
      SELECT p.id,p.title,p.kind,left(coalesce(s.body,''),180) AS snippet,parent.title AS "parentTitle" FROM visible p
      LEFT JOIN search_projection s ON s.page_id=p.id LEFT JOIN visible parent ON parent.id=p.parent_id CROSS JOIN search_query
      WHERE ($3='' OR s.tokens@@search_query.q OR p.title ILIKE $4 OR similarity(p.title,$3)>0.25) AND ($5='' OR p.kind=$5) AND ($6::date IS NULL OR p.updated_at >= $6::date) AND ($7='' OR p.id IN (SELECT id FROM tagged))
      ORDER BY CASE WHEN lower(p.title)=lower($3) THEN 0 WHEN p.title ILIKE $3 || '%' THEN 1 ELSE 2 END,ts_rank_cd(s.tokens,search_query.q) DESC NULLS LAST,p.updated_at DESC LIMIT 50`,
      [
        ...scope.params,
        term,
        `%${term}%`,
        kind,
        after,
        (filters.tag ?? '').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US').slice(0, 80),
      ],
    );
    const pending = await this.db.query(
      `${scope.sql} SELECT 1 FROM outbox o JOIN visible p ON p.id=o.page_id WHERE o.processed_at IS NULL LIMIT 1`,
      scope.params,
    );
    return { results, indexing: pending.length > 0 };
  }
  async backlinks(actor: Actor, pageId: string): Promise<KnowledgeLink[]> {
    const access = new Access(this.db);
    const page = await access.requirePage(actor, pageId, 'read');
    const scope = await access.scope(actor, page.workspaceId);
    return this.db.query<KnowledgeLink>(
      `${scope.sql} SELECT l.source_id AS "sourceId",l.target_id AS "targetId",p.title,l.excerpt FROM link_projection l JOIN visible p ON p.id=l.source_id WHERE l.target_id=$3 ORDER BY p.title LIMIT 100`,
      [...scope.params, pageId],
    );
  }
  async graph(actor: Actor, workspace: string, center?: string): Promise<GraphData> {
    const access = new Access(this.db);
    const scope = await access.scope(actor, workspace);
    if (center) await access.requirePage(actor, center, 'read');
    const edges = await this.db.query<{ source: string; target: string }>(
      `${scope.sql} SELECT l.source_id AS source,l.target_id AS target FROM link_projection l JOIN visible s ON s.id=l.source_id JOIN visible t ON t.id=l.target_id ${center ? 'WHERE l.source_id=$3 OR l.target_id=$3' : ''} LIMIT 500`,
      center ? [...scope.params, center] : scope.params,
    );
    const ids = center
      ? [...new Set([center, ...edges.flatMap((edge) => [edge.source, edge.target])])].slice(0, 60)
      : null;
    const nodes = await this.db.query<GraphData['nodes'][number]>(
      `${scope.sql} SELECT id,title,kind FROM visible ${ids ? 'WHERE id=ANY($3::text[])' : ''} ORDER BY position LIMIT 180`,
      ids ? [...scope.params, ids] : scope.params,
    );
    const allowed = new Set(nodes.map((node) => node.id));
    return {
      nodes,
      edges: edges.filter((edge) => allowed.has(edge.source) && allowed.has(edge.target)),
    };
  }
}
