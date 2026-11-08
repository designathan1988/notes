import type { Page } from '../../../../packages/contracts/src/index.js';
export interface PageRow {
  icon?: string | null;
  cover?: Page['cover'];
  tags?: string[];
  private_owner_id?: string | null;
  has_children?: boolean;
  id: string;
  workspace_id: string;
  parent_id: string | null;
  title: string;
  description: string;
  kind: Page['kind'];
  visibility: Page['visibility'];
  created_by: string;
  position: number;
  revision: number;
  generation: number;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}
export function toPage(row: PageRow): Page {
  return {
    icon: row.icon ?? null,
    cover: row.cover ?? null,
    tags: row.tags ?? [],
    accessOwnerId: row.private_owner_id ?? row.created_by,
    ...(row.has_children !== undefined ? { hasChildren: row.has_children } : {}),
    id: row.id,
    workspaceId: row.workspace_id,
    parentId: row.parent_id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    visibility: row.visibility,
    createdBy: row.created_by,
    position: row.position,
    revision: row.revision,
    generation: row.generation,
    updatedAt: new Date(row.updated_at).toISOString(),
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
  };
}
export type VisiblePageRow = PageRow & {
  inherited_visibility: Page['visibility'];
  visibility_owner: string;
};
export function toVisiblePage(row: VisiblePageRow): Page {
  return toPage({
    ...row,
    visibility: row.inherited_visibility,
    private_owner_id: row.visibility_owner,
  });
}
