import type { DatabaseRecord, RecordField } from '../../../../packages/contracts/src/index.js';
import { api, ApiError, json } from '../state/api.js';
import type { WorkspaceState } from '../state/store.js';
export interface TableOptions {
  columns?: string[];
  filter?: string;
  sort?: string;
  direction?: string;
  offset?: number;
  limit?: number;
}
export interface TableDefinition {
  title: string;
  pageRevision: number;
  fieldsRevision: number;
  fields: RecordField[];
  views: { id: string; name: string; config: TableOptions }[];
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
  ]);
export interface DatabaseSlice {
  tables: Record<string, TableDefinition>;
  tableQueries: Record<string, { databaseId: string; ids: string[]; total: number }>;
  recordEntities: Record<string, DatabaseRecord>;
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
  return {
    tables: {},
    tableQueries: {},
    recordEntities: {},
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
            !previous || result.fieldsRevision >= previous.fieldsRevision
              ? result.fields
              : previous.fields,
          fieldsRevision: Math.max(previous?.fieldsRevision ?? 0, result.fieldsRevision),
          views: [
            ...new Map(
              [...(previous?.views ?? []), ...result.views].map((view) => [view.id, view]),
            ).values(),
          ],
        };
        const entities = { ...get().recordEntities };
        for (const record of result.records) {
          const current = entities[record.pageId];
          if (
            !current ||
            record.revision > current.revision ||
            (record.revision === current.revision && record.updatedAt >= current.updatedAt)
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
    async editRecord(id, pageId, patch) {
      const user = get().user?.id,
        workspace = get().workspaceId;
      const operation = (writes.get(pageId) ?? Promise.resolve())
        .catch(() => {})
        .then(async () => {
          if (user !== get().user?.id || workspace !== get().workspaceId) return;
          const record = get().recordEntities[pageId];
          if (!record) throw new Error('Reload the record before editing.');
          const updated = await api<DatabaseRecord>(`/databases/${id}/records/${pageId}`, {
            method: 'PATCH',
            body: json({ ...patch, values: patch.values ?? {}, revision: record.revision }),
          });
          if (user === get().user?.id && workspace === get().workspaceId)
            set({ recordEntities: { ...get().recordEntities, [pageId]: updated } });
        });
      writes.set(pageId, operation);
      try {
        await operation;
      } finally {
        if (writes.get(pageId) === operation) writes.delete(pageId);
      }
    },
  };
}
