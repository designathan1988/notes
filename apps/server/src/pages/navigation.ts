import type { Database } from '../platform/database.js';
import {
  DomainError,
  type Actor,
  type Page,
  type PageCursor,
  type NavigationSnapshot,
} from '../../../../packages/contracts/src/index.js';
import { Access } from '../access/service.js';
import { toPage, toVisiblePage, type VisiblePageRow, type PageRow } from './model.js';
export interface Children {
  pages: Page[];
  nextCursor: PageCursor | null;
}
export class Navigation {
  constructor(readonly db: Database) {}
  private async siblings(
    actor: Actor,
    workspace: string,
    parent: Page | null,
    cursor: PageCursor | null,
  ): Promise<Children> {
    const rows = await this.db.query<PageRow>(
      `SELECT p.*,EXISTS(SELECT 1 FROM pages child WHERE child.parent_id=p.id AND child.deleted_at IS NULL AND child.kind<>'record') AS has_children FROM pages p
      WHERE p.workspace_id=$1 AND p.parent_id IS NOT DISTINCT FROM $2::text AND p.deleted_at IS NULL AND p.kind<>'record' AND p.template_root_id IS NOT DISTINCT FROM $6::text
      AND ($2::text IS NOT NULL OR p.visibility='workspace' OR coalesce(p.private_owner_id,p.created_by)=$3) AND ($4::integer IS NULL OR (p.position,p.id)>($4::integer,$5::text)) ORDER BY p.position,p.id LIMIT 101`,
      [
        workspace,
        parent?.id ?? null,
        actor.userId,
        cursor?.position ?? null,
        cursor?.id ?? null,
        parent?.templateRootId ?? null,
      ],
    );
    const batch = rows.slice(0, 100);
    const last = batch.at(-1);
    return {
      pages: batch.map((row) =>
        toPage({
          ...row,
          visibility: parent?.visibility ?? row.visibility,
          private_owner_id: parent?.accessOwnerId ?? row.private_owner_id,
        }),
      ),
      nextCursor: rows.length > 100 && last ? { position: last.position, id: last.id } : null,
    };
  }
  async children(
    actor: Actor,
    workspace: string,
    parent: string | null = null,
    cursor: PageCursor | null = null,
  ): Promise<Children> {
    const access = new Access(this.db);
    await access.requireWorkspace(actor, workspace);
    const page = parent ? await access.requirePage(actor, parent, 'read') : null;
    if (page && page.workspaceId !== workspace)
      throw new DomainError('FORBIDDEN', 'This location belongs to another workspace.');
    return this.siblings(actor, workspace, page, cursor);
  }
  async bootstrap(
    actor: Actor,
    workspace: string,
    selected?: string | null,
  ): Promise<NavigationSnapshot> {
    const access = new Access(this.db);
    const roots = await this.children(actor, workspace);
    const pages = new Map(roots.pages.map((page) => [page.id, page]));
    const cursors: NavigationSnapshot['cursors'] = { root: roots.nextCursor };
    const loaded = ['root'];
    if (!selected) {
      const [favorite] = await this.db.query<{ page_id: string }>(
        'SELECT f.page_id FROM favorites f JOIN pages p ON p.id=f.page_id WHERE f.user_id=$1 AND p.workspace_id=$2 AND p.deleted_at IS NULL AND p.template_root_id IS NULL ORDER BY p.position LIMIT 1',
        [actor.userId, workspace],
      );
      selected = favorite?.page_id ?? roots.pages[0]?.id;
    }
    let current: Page | null = null;
    if (selected) {
      try {
        current = await access.requirePage(actor, selected, 'read');
        if (current.workspaceId !== workspace) current = null;
      } catch {
        current = null;
      }
    }
    if (!current) current = roots.pages[0] ?? null;
    const expanded: string[] = [];
    const scope = await access.scope(actor, workspace);
    const favorites = await this.db.query<VisiblePageRow>(
      `${scope.sql} SELECT p.*,EXISTS(SELECT 1 FROM pages child WHERE child.parent_id=p.id AND child.deleted_at IS NULL AND child.kind<>'record') AS has_children FROM visible p JOIN favorites f ON f.page_id=p.id AND f.user_id=$2 WHERE p.template_root_id IS NULL`,
      scope.params,
    );
    for (const row of favorites) pages.set(row.id, toVisiblePage(row));
    if (current) {
      const lineage = await this.db.query<PageRow & { depth: number }>(
        `WITH RECURSIVE lineage AS (SELECT p.*,0 AS depth FROM pages p WHERE id=$1 UNION ALL SELECT p.*,l.depth+1 FROM pages p JOIN lineage l ON p.id=l.parent_id) SELECT * FROM lineage ORDER BY depth DESC`,
        [current.id],
      );
      for (const row of lineage) {
        const page = toPage({
          ...row,
          visibility: current.visibility,
          private_owner_id: current.accessOwnerId,
        });
        pages.set(page.id, { ...pages.get(page.id), ...page });
        if (page.id !== current.id) {
          expanded.push(page.id);
          const children = await this.siblings(actor, workspace, page, null);
          for (const child of children.pages) pages.set(child.id, child);
          cursors[page.id] = children.nextCursor;
          loaded.push(page.id);
        }
      }
    }
    return {
      pages: [...pages.values()],
      selectedId: current?.id ?? null,
      expanded,
      cursors,
      loaded,
    };
  }
  async refresh(
    actor: Actor,
    workspace: string,
    loadedIds: string[],
    selected: string | null,
    expandedIds: string[] = [],
  ): Promise<NavigationSnapshot> {
    const snapshot = await this.bootstrap(actor, workspace, selected);
    const scope = await new Access(this.db).scope(actor, workspace);
    const rows = await this.db.query<VisiblePageRow>(
      `${scope.sql} SELECT p.*,EXISTS(SELECT 1 FROM pages child WHERE child.parent_id=p.id AND child.deleted_at IS NULL AND child.kind<>'record') AS has_children FROM visible p WHERE p.id=ANY($3::text[])`,
      [...scope.params, loadedIds.slice(0, 5000)],
    );
    const pages = new Map(rows.map((row) => [row.id, toVisiblePage(row)]));
    for (const page of snapshot.pages) pages.set(page.id, { ...pages.get(page.id), ...page });
    for (const id of expandedIds) {
      const page = pages.get(id);
      if (!page || snapshot.loaded.includes(id)) continue;
      const children = await this.siblings(actor, workspace, page, null);
      for (const child of children.pages) pages.set(child.id, child);
      snapshot.cursors[id] = children.nextCursor;
      snapshot.loaded.push(id);
    }
    return { ...snapshot, pages: [...pages.values()] };
  }
  async flat(
    actor: Actor,
    workspace: string,
    offset = 0,
    kind = '',
    query = '',
    templateRoot: string | null = null,
  ) {
    const scope = await new Access(this.db).scope(actor, workspace);
    const rows = await this.db.query<VisiblePageRow & { parent_title: string | null }>(
      `${scope.sql} SELECT p.*,parent.title AS parent_title FROM visible p LEFT JOIN visible parent ON parent.id=p.parent_id WHERE (p.template_root_id IS NULL OR p.template_root_id=$6) AND ($4='' OR p.kind=$4) AND p.title ILIKE $5 ORDER BY p.updated_at DESC,p.id LIMIT 51 OFFSET $3`,
      [
        ...scope.params,
        Math.max(0, Math.min(100000, offset)),
        kind,
        `%${query.slice(0, 256)}%`,
        templateRoot,
      ],
    );
    return {
      pages: rows
        .slice(0, 50)
        .map((row) => ({ ...toVisiblePage(row), parentTitle: row.parent_title ?? undefined })),
      more: rows.length > 50,
    };
  }
}
