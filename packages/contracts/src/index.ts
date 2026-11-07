export type Role = 'owner' | 'admin' | 'editor' | 'viewer';
export type PageKind = 'document' | 'database' | 'record';
export interface Actor {
  userId: string;
}
export interface Workspace {
  id: string;
  name: string;
  role: Role;
}
export interface Page {
  accessOwnerId: string;
  hasChildren?: boolean;
  id: string;
  workspaceId: string;
  parentId: string | null;
  title: string;
  description: string;
  kind: PageKind;
  visibility: 'workspace' | 'private';
  createdBy: string;
  position: number;
  revision: number;
  generation: number;
  updatedAt: string;
  deletedAt: string | null;
}
export type SaveStatus = 'connecting' | 'saving' | 'saved' | 'local' | 'error' | 'read-only';
export interface PageCursor {
  position: number;
  id: string;
}
export interface NavigationSnapshot {
  pages: Page[];
  selectedId: string | null;
  expanded: string[];
  cursors: Record<string, PageCursor | null>;
  loaded: string[];
}
export interface RecordField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'checkbox' | 'select' | 'multi-select' | 'date' | 'url' | 'relation';
  options?: string[];
}
export interface DatabaseRecord {
  pageId: string;
  title: string;
  values: Record<string, unknown>;
  revision: number;
  updatedAt: string;
}
export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  kind: PageKind;
  parentTitle?: string;
}
export interface KnowledgeLink {
  sourceId: string;
  targetId: string;
  title: string;
  excerpt: string;
}
export interface GraphData {
  nodes: Pick<Page, 'id' | 'title' | 'kind'>[];
  edges: { source: string; target: string }[];
}
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export class DomainError extends Error {
  constructor(
    public code: 'INVALID' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'UNAUTHENTICATED' | 'LIMIT',
    message: string,
  ) {
    super(message);
  }
}
export function validateTitle(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > 300 ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new DomainError('INVALID', 'Use a title between 1 and 300 characters.');
  return value.trim();
}
export function assertObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new DomainError('INVALID', 'Expected an object.');
}
export const roleRank: Record<Role, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };
