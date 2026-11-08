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
  editRecord(
    databaseId: string,
    pageId: string,
    patch: { title?: string; values?: Record<string, unknown> },
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
          set({ recordEntities: { ...get().recordEntities, [pageId]: updated } });
      });
    writes.set(pageId, operation);
    try {
      await operation;
    } finally {
      if (writes.get(pageId) === operation) writes.delete(pageId);
    }
  };
  return {
    tables: {},
    tableQueries: {},
    recordEntities: {},
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
        const previous = get().tables[id];
        const definition: TableDefinition = {
          title:
            !previous || result.pageRevision >= previous.pageRevision
              ? result.title
              : previous.title,
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
        const entities = { ...get().recordEntities };
        for (const record of result.records) {
          const current = entities[record.pageId];
          if (
            !current ||
            record.revision > current.revision ||
            (record.revision === current.revision &&
              ((record.pageRevision ?? 0) > (current.pageRevision ?? 0) ||
                ((record.pageRevision ?? 0) === (current.pageRevision ?? 0) &&
                  record.updatedAt >= current.updatedAt)))
          )
            entities[record.pageId] = record;
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
    editRecord(id, pageId, patch) {
      return mutate(pageId, (record) =>
        api<DatabaseRecord>(`/databases/${id}/records/${pageId}`, {
          method: 'PATCH',
          body: json({
            ...patch,
            values: patch.values ?? {},
            revision: record.revision,
            ...(patch.title !== undefined ? { pageRevision: record.pageRevision } : {}),
          }),
        }),
      );
    },
  };
}
