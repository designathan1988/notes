import type { Page } from '../../../../packages/contracts/src/index.js';
export interface PageRow {
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
