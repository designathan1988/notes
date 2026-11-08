import { randomUUID } from 'node:crypto';
import type { Database } from '../platform/database.js';
import { Access } from '../access/service.js';
import {
  DomainError,
  type Actor,
  type DatabaseViewConfig,
  type RecordField,
  type SavedDatabaseView,
} from '@note/contracts';
import { defaultFields } from './values.js';

export class DatabaseViews {
  constructor(private readonly db: Database) {}
  async snapshot(actor: Actor, id: string) {
    await new Access(this.db).requirePage(actor, id, 'read');
    const [row] = await this.db.query<{ viewsRevision: number; views: SavedDatabaseView[] }>(
      `SELECT views_revision AS "viewsRevision", COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'config',v.config,'revision',v.revision) ORDER BY v.name,v.id) FROM table_views v WHERE v.database_id=d.page_id),'[]'::jsonb) AS views FROM database_definitions d WHERE d.page_id=$1`,
      [id],
    );
    if (!row) throw new DomainError('NOT_FOUND', 'Database not found.');
    return row;
  }
  private validate(name: string, config: DatabaseViewConfig, fields: RecordField[]) {
    if (!name.trim() || name.length > 100)
      throw new DomainError('INVALID', 'Use a short view name.');
    const layout = config.layout ?? 'table';
    if (!['table', 'board', 'list', 'calendar'].includes(layout))
      throw new DomainError('INVALID', 'Unsupported database layout.');
    if (
      config.groupBy &&
      !fields.some(
        (field) =>
          field.id === config.groupBy &&
          ['select', 'checkbox'].includes(field.type) &&
          !field.archived,
      )
    )
      throw new DomainError('INVALID', 'Group by an active select or checkbox property.');
    if (
      config.dateField &&
      !fields.some(
        (field) => field.id === config.dateField && field.type === 'date' && !field.archived,
      )
    )
      throw new DomainError('INVALID', 'Choose an active date property.');
    return {
      layout,
      ...(config.groupBy ? { groupBy: config.groupBy } : {}),
      ...(config.dateField ? { dateField: config.dateField } : {}),
      ...(Array.isArray(config.columns)
        ? {
            columns: config.columns
              .filter(
                (value) => typeof value === 'string' && fields.some((field) => field.id === value),
              )
              .slice(0, 50),
          }
        : {}),
      filter: String(config.filter ?? '').slice(0, 1000),
      sort: String(config.sort ?? '').slice(0, 64),
      direction: config.direction === 'desc' ? 'desc' : 'asc',
    } satisfies DatabaseViewConfig;
  }
  async save(
    actor: Actor,
    database: string,
    name: string,
    config: DatabaseViewConfig,
    existing?: { id: string; revision?: number },
  ) {
    return this.db.transaction(async (tx) => {
      await new Access(tx).lockPage(actor, database);
      const [definition] = await tx.query<{ fields: RecordField[]; revision: number }>(
        'SELECT fields,revision FROM database_definitions WHERE page_id=$1 FOR UPDATE',
        [database],
      );
      if (!definition) throw new DomainError('INVALID', 'This page is not a database.');
      const safe = this.validate(
        name,
        config,
        definition.fields.length || definition.revision > 1 ? definition.fields : defaultFields,
      );
      const id = existing?.id ?? randomUUID();
      const rows = existing
        ? await tx.query<SavedDatabaseView>(
            'UPDATE table_views SET name=$3,config=$4,revision=revision+1 WHERE database_id=$1 AND id=$2 AND ($5::integer IS NULL OR revision=$5) RETURNING id,name,config,revision',
            [database, id, name.trim(), JSON.stringify(safe), existing.revision ?? null],
          )
        : await tx.query<SavedDatabaseView>(
            'INSERT INTO table_views (id,database_id,name,config) VALUES ($1,$2,$3,$4) RETURNING id,name,config,revision',
            [id, database, name.trim(), JSON.stringify(safe)],
          );
      if (!rows[0])
        throw new DomainError(
          'CONFLICT',
          'This view changed or was removed. Reload before editing it.',
        );
      await tx.query(
        'UPDATE database_definitions SET views_revision=views_revision+1 WHERE page_id=$1',
        [database],
      );
      return rows[0];
    });
  }
  async delete(actor: Actor, database: string, id: string, revision?: number) {
    await this.db.transaction(async (tx) => {
      await new Access(tx).lockPage(actor, database);
      await tx.query('SELECT page_id FROM database_definitions WHERE page_id=$1 FOR UPDATE', [
        database,
      ]);
      const deleted = await tx.query(
        'DELETE FROM table_views WHERE database_id=$1 AND id=$2 AND ($3::integer IS NULL OR revision=$3) RETURNING id',
        [database, id, revision ?? null],
      );
      if (!deleted[0])
        throw new DomainError(
          'CONFLICT',
          'This view changed or was removed. Reload before removing it.',
        );
      await tx.query(
        'UPDATE database_definitions SET views_revision=views_revision+1 WHERE page_id=$1',
        [database],
      );
    });
  }
}
