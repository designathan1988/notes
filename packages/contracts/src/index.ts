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
  templateRootId?: string | null;
  templateDatabaseId?: string | null;
  templateValues?: Record<string, unknown>;
  properties?: PageProperties;
  icon?: string | null;
  cover?: PageCover | null;
  tags?: string[];
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
export type PageCover =
  { type: 'color'; color: string } | { type: 'image'; attachmentId: string; positionY: number };
export interface PageUpdate {
  templateDefaults?: {
    fieldsRevision: number;
    property?: NonNullable<PageUpdate['property']>;
    resetInvalid?: boolean;
  };
  fields?: RecordField[];
  property?: { id: string; value: unknown; expectedValue: unknown; expectedField: RecordField };
  propertyAction?: string;
  title?: string;
  description?: string;
  icon?: string | null;
  cover?: PageCover | null;
  tags?: string[];
}
export interface PageProperties {
  fields: RecordField[];
  values: Record<string, unknown>;
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
  type:
    | 'text'
    | 'number'
    | 'checkbox'
    | 'select'
    | 'multi-select'
    | 'date'
    | 'url'
    | 'relation'
    | 'formula'
    | 'button';
  options?: string[];
  formula?: string;
  archived?: boolean;
  action?: { fieldId: string; value: unknown };
}
export interface DatabaseRecord {
  pageId: string;
  pageRevision: number;
  title: string;
  values: Record<string, unknown>;
  computedValues?: Record<string, number | null>;
  revision: number;
  updatedAt: string;
}
export interface DatabaseViewConfig {
  layout?: 'table' | 'board' | 'list' | 'calendar';
  groupBy?: string;
  dateField?: string;
  columns?: string[];
  filter?: string;
  sort?: string;
  direction?: string;
}
export interface SavedDatabaseView {
  id: string;
  name: string;
  config: DatabaseViewConfig;
  revision: number;
}
export interface RecordQuery {
  filter?: string;
  sort?: string;
  direction?: string;
  offset?: number;
  limit?: number;
  dateField?: string;
  dateFrom?: string;
  dateTo?: string;
  undated?: boolean | string;
}
export const validDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  kind: PageKind;
  parentTitle?: string;
}
export interface PageLookup extends Page {
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
export interface DiscussionMessage {
  id: string;
  threadId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
}
export const ACTIVITY_PAGE_SIZE = 40;
export interface DiscussionThread {
  id: string;
  pageId: string;
  quote: string;
  resolved: boolean;
  revision: number;
  messageCount: number;
  firstMessage: DiscussionMessage;
  updatedAt: string;
}
export interface HistoryEntry {
  id: string;
  pageId: string;
  label: string;
  kind: 'automatic' | 'named' | 'before-restore';
  authorName: string;
  version: number;
  createdAt: string;
}
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
