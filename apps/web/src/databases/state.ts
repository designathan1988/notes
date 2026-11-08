import type {
  DatabaseRecord,
  RecordField,
  RecordQuery,
  DatabaseViewConfig,
  SavedDatabaseView,
} from '../../../../packages/contracts/src/index.js';
import { api, ApiError, json } from '../state/api.js';
import type { WorkspaceState } from '../state/store.js';
export interface TableOptions extends DatabaseViewConfig, RecordQuery {}
export interface TableDefinition {
  templateRootId?: string | null;
  title: string;
  pageRevision: number;
  fieldsRevision: number;
  fields: RecordField[];
  viewsRevision: number;
  views: SavedDatabaseView[];
}
export interface TableSnapshot extends TableDefinition {
  records: DatabaseRecord[];
  total: number;
}
export function mergeDefinition(
  previous: TableDefinition | undefined,
  result: TableDefinition,
): TableDefinition {
  return {
    templateRootId:
      !previous || result.pageRevision >= previous.pageRevision
        ? (result.templateRootId ?? null)
        : (previous.templateRootId ?? null),
    title:
      !previous || result.pageRevision >= previous.pageRevision ? result.title : previous.title,
    pageRevision: Math.max(previous?.pageRevision ?? 0, result.pageRevision),
    fields:
      !previous || result.fieldsRevision > previous.fieldsRevision
        ? result.fields
        : previous.fields,
    fieldsRevision: Math.max(previous?.fieldsRevision ?? 0, result.fieldsRevision),
    viewsRevision: Math.max(previous?.viewsRevision ?? 0, result.viewsRevision ?? 0),
    views:
      !previous || (result.viewsRevision ?? 0) >= (previous.viewsRevision ?? 0)
        ? result.views
        : previous.views,
  };
}
function mergeRecord(current: DatabaseRecord | undefined, record: DatabaseRecord) {
  if (!current) return record;
  const values =
    record.revision > current.revision ||
    (record.revision === current.revision && record.updatedAt >= current.updatedAt)
      ? record
      : current;
  const details = (record.pageRevision ?? 0) >= (current.pageRevision ?? 0) ? record : current;
  return {
    ...values,
    title: details.title,
    pageRevision: Math.max(record.pageRevision ?? 0, current.pageRevision ?? 0),
    updatedAt: record.updatedAt >= current.updatedAt ? record.updatedAt : current.updatedAt,
  };
}
export const tableQueryKey = (id: string, options: TableOptions = {}) =>
  JSON.stringify([
    id,
    options.filter ?? '',
    options.sort ?? '',
    options.direction ?? 'asc',
    options.offset ?? 0,
    options.limit ?? 50,
    options.dateField ?? '',
    options.dateFrom ?? '',
    options.dateTo ?? '',
    options.undated ?? false,
  ]);
export interface DatabaseSlice {
  settleRecordWrites(ids: string[]): Promise<void>;
  tables: Record<string, TableDefinition>;
  tableQueries: Record<string, { databaseId: string; ids: string[]; total: number }>;
  recordEntities: Record<string, DatabaseRecord>;
  createRecord(
    databaseId: string,
    title: string,
    values?: Record<string, unknown>,
  ): Promise<DatabaseRecord | null>;
  runRecordAction(databaseId: string, pageId: string, fieldId: string): Promise<void>;
  loadTable(id: string, options?: TableOptions): Promise<void>;
  loadRecord(databaseId: string, pageId: string): Promise<void>;
  editRecord(
    databaseId: string,
    pageId: string,
    patch: { title?: string; values?: Record<string, unknown> },
    expected?: { id: string; value: unknown; field: RecordField },
  ): Promise<void>;
}
export function databaseSlice(
  set: (partial: Partial<WorkspaceState>) => void,
  get: () => WorkspaceState,
): DatabaseSlice {
  const sequences = new Map<string, number>(),
    writes = new Map<string, Promise<void>>();
  const mutate = async (
    pageId: string,
    request: (record: DatabaseRecord) => Promise<DatabaseRecord>,
  ) => {
    const user = get().user?.id,
      workspace = get().workspaceId;
    const operation = (writes.get(pageId) ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        if (user !== get().user?.id || workspace !== get().workspaceId) return;
        const record = get().recordEntities[pageId];
        if (!record) throw new Error('Reload the record before editing.');
        const updated = await request(record);
        if (user === get().user?.id && workspace === get().workspaceId)
          set({
            recordEntities: {
              ...get().recordEntities,
              [pageId]: mergeRecord(get().recordEntities[pageId], updated),
            },
          });
      });
    writes.set(pageId, operation);
    try {
      await operation;
    } finally {
      if (writes.get(pageId) === operation) writes.delete(pageId);
    }
  };
  return {
    async settleRecordWrites(ids) {
      await Promise.all(ids.flatMap((id) => (writes.get(id) ? [writes.get(id)!] : [])));
    },
    tables: {},
    tableQueries: {},
    recordEntities: {},
    async loadRecord(id, pageId) {
      const user = get().user?.id,
        workspace = get().workspaceId,
        version = get().knowledgeVersion,
        key = `record:${pageId}`,
        sequence = (sequences.get(key) ?? 0) + 1;
      sequences.set(key, sequence);
      const current = () =>
        user === get().user?.id &&
        workspace === get().workspaceId &&
        version === get().knowledgeVersion &&
        sequence === sequences.get(key);
      try {
        const result = await api<TableDefinition & { record: DatabaseRecord }>(
          `/databases/${id}/records/${pageId}`,
        );
        if (!current()) return;
        set({
          tables: { ...get().tables, [id]: mergeDefinition(get().tables[id], result) },
          recordEntities: {
            ...get().recordEntities,
            [pageId]: mergeRecord(get().recordEntities[pageId], result.record),
          },
        });
      } catch (error) {
        if (current() && error instanceof ApiError && [401, 403, 404].includes(error.status)) {
          const records = { ...get().recordEntities };
          delete records[pageId];
          set({ recordEntities: records });
        }
        throw error;
      }
    },
    async createRecord(id, title, values = {}) {
      const user = get().user?.id,
        workspace = get().workspaceId;
      const record = await api<DatabaseRecord>(`/databases/${id}/records`, {
        method: 'POST',
        body: json({ title, values }),
      });
      if (user !== get().user?.id || workspace !== get().workspaceId) return null;
      set({ recordEntities: { ...get().recordEntities, [record.pageId]: record } });
      return record;
    },
    runRecordAction(id, pageId, fieldId) {
      return mutate(pageId, (record) =>
        api<DatabaseRecord>(`/databases/${id}/records/${pageId}/actions/${fieldId}`, {
          method: 'POST',
          body: json({ revision: record.revision }),
        }),
      );
    },
    async loadTable(id, options = {}) {
      const user = get().user?.id,
        workspace = get().workspaceId,
        key = tableQueryKey(id, options),
        sequence = (sequences.get(key) ?? 0) + 1;
      sequences.set(key, sequence);
      const query = new URLSearchParams(
        Object.entries(options)
          .filter(([key, value]) => key !== 'columns' && value !== undefined)
          .map(([key, value]) => [key, String(value)]),
      );
      try {
        const result = await api<TableSnapshot>(`/databases/${id}?${query}`);
        if (
          user !== get().user?.id ||
          workspace !== get().workspaceId ||
          sequence !== sequences.get(key)
        )
          return;
        const definition = mergeDefinition(get().tables[id], result);
        const entities = { ...get().recordEntities };
        for (const record of result.records) {
          entities[record.pageId] = mergeRecord(entities[record.pageId], record);
        }
        set({
          tables: { ...get().tables, [id]: definition },
          recordEntities: entities,
          tableQueries: {
            ...get().tableQueries,
            [key]: {
              databaseId: id,
              ids: result.records.map((record) => record.pageId),
              total: result.total,
            },
          },
        });
      } catch (error) {
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          const tables = { ...get().tables };
          delete tables[id];
          set({
            tables,
            tableQueries: Object.fromEntries(
              Object.entries(get().tableQueries).filter(([, query]) => query.databaseId !== id),
            ),
          });
        }
        throw error;
      }
    },
    editRecord(id, pageId, patch, expected) {
      return mutate(pageId, (record) =>
        api<DatabaseRecord>(`/databases/${id}/records/${pageId}`, {
          method: 'PATCH',
          body: json({
            ...patch,
            values: patch.values ?? {},
            expected,
            revision: record.revision,
            ...(patch.title !== undefined ? { pageRevision: record.pageRevision } : {}),
          }),
        }),
      );
    },
  };
}
