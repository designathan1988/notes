import type { Database } from '../platform/database.js';
import {
  DomainError,
  type Actor,
  type RecordField,
  type DatabaseRecord,
  type DatabaseViewConfig,
  type RecordQuery,
  validDate,
} from '../../../../packages/contracts/src/index.js';
import { Access } from '../access/service.js';
import { Pages } from '../pages/service.js';
import { defaultFields, validateFields, validateValues } from './values.js';
import { DatabaseViews } from './views.js';
import { compileFormulas } from '../../../../packages/data/src/formulas.js';
import { isDeepStrictEqual } from 'node:util';
interface RecordRow {
  page_id: string;
  page_revision: number;
  title: string;
  values: Record<string, unknown>;
  computed_values: Record<string, number | null>;
  revision: number;
  updated_at: string | Date;
}
const map = (row: RecordRow): DatabaseRecord => ({
  pageId: row.page_id,
  pageRevision: row.page_revision,
  title: row.title,
  values: row.values,
  computedValues: row.computed_values ?? {},
  revision: row.revision,
  updatedAt: new Date(row.updated_at).toISOString(),
});
export class Databases {
  constructor(readonly db: Database) {}
  async record(actor: Actor, id: string, pageId: string): Promise<DatabaseRecord> {
    const access = new Access(this.db);
    await access.requirePage(actor, id, 'read');
    const page = await access.requirePage(actor, pageId, 'read');
    if (page.kind !== 'record' || page.parentId !== id)
      throw new DomainError('NOT_FOUND', 'Record not found in this database.');
    const [row] = await this.db.query<RecordRow>(
      'SELECT r.*,p.title,p.updated_at,p.revision AS page_revision FROM records r JOIN pages p ON p.id=r.page_id WHERE r.page_id=$1 AND r.database_id=$2',
      [pageId, id],
    );
    if (!row) throw new DomainError('NOT_FOUND', 'Record not found.');
    const record = map(row);
    for (const field of (await this.fields(actor, id)).filter(
      (field) => field.type === 'relation',
    )) {
      if (!record.values[field.id]) continue;
      try {
        await access.requirePage(actor, String(record.values[field.id]), 'read');
      } catch {
        record.values = { ...record.values, [field.id]: null };
      }
    }
    return record;
  }
  async fields(actor: Actor, id: string) {
    return (await this.definition(actor, id)).fields;
  }
  async definition(actor: Actor, id: string) {
    const page = await new Access(this.db).requirePage(actor, id, 'read');
    const [row] = await this.db.query<{ fields: RecordField[]; revision: number }>(
      'SELECT fields,revision FROM database_definitions WHERE page_id=$1',
      [id],
    );
    if (!row) throw new DomainError('INVALID', 'This page is not a database.');
    return {
      ...(await new DatabaseViews(this.db).snapshot(actor, id)),
      title: page.title,
      pageRevision: page.revision,
      fields: row.fields.length || row.revision > 1 ? row.fields : defaultFields,
      fieldsRevision: row.revision,
    };
  }
  async setFields(
    actor: Actor,
    id: string,
    fields: RecordField[],
    expectedRevision?: number,
  ): Promise<void> {
    await new Access(this.db).requirePage(actor, id, 'write');
    validateFields(fields);
    const revision = expectedRevision ?? (await this.definition(actor, id)).fieldsRevision;
    await this.db.transaction(async (tx) => {
      await this.lock(actor, id, tx);
      const [definition] = await tx.query<{ revision: number }>(
        'SELECT revision FROM database_definitions WHERE page_id=$1',
        [id],
      );
      if (!definition || definition.revision !== revision)
        throw new DomainError(
          'CONFLICT',
          'The properties changed. Review the latest schema and retry.',
        );
      const calculate = compileFormulas(fields);
      let cursor = '';
      while (true) {
        const rows = await tx.query<{
          page_id: string;
          values: Record<string, unknown>;
          computed_values: Record<string, number | null>;
        }>(
          'SELECT page_id,values,computed_values FROM records WHERE database_id=$1 AND page_id>$2 ORDER BY page_id LIMIT 500',
          [id, cursor],
        );
        if (!rows.length) break;
        const changed = [];
        for (const row of rows) {
          validateValues(fields, row.values);
          const computed = calculate(row.values);
          if (
            Object.keys(computed).length !== Object.keys(row.computed_values).length ||
            Object.entries(computed).some(([key, value]) => row.computed_values[key] !== value)
          )
            changed.push({ page_id: row.page_id, computed_values: computed });
        }
        if (changed.length)
          await tx.query(
            `WITH changed AS (
          UPDATE records r SET computed_values=x.computed_values
          FROM jsonb_to_recordset($1::jsonb) AS x(page_id text,computed_values jsonb)
          WHERE r.page_id=x.page_id AND r.database_id=$2 RETURNING r.page_id
        ), indexed AS (
          UPDATE pages p SET index_revision=index_revision+1 FROM changed c WHERE p.id=c.page_id RETURNING p.id,p.index_revision
        ) INSERT INTO outbox (page_id,version) SELECT id,index_revision FROM indexed`,
            [JSON.stringify(changed), id],
          );
        cursor = rows[rows.length - 1].page_id;
      }
      await tx.query(
        'UPDATE database_definitions SET fields=$2,revision=revision+1 WHERE page_id=$1',
        [id, JSON.stringify(fields)],
      );
    });
  }
  private async lock(actor: Actor, id: string, tx: Database) {
    const page = await new Access(tx).lockPage(actor, id);
    await tx.query('SELECT page_id FROM database_definitions WHERE page_id=$1 FOR UPDATE', [id]);
    return page;
  }
  private async check(actor: Actor, id: string, values: Record<string, unknown>) {
    const access = new Access(this.db);
    const database = await access.requirePage(actor, id, 'write');
    const fields = await this.fields(actor, id);
    validateValues(fields, values);
    for (const field of fields.filter((item) => item.type === 'relation'))
      if (values[field.id]) {
        const target = await access.requirePage(actor, String(values[field.id]), 'read');
        if (target.workspaceId !== database.workspaceId || target.kind !== 'record')
          throw new DomainError(
            'INVALID',
            'Relations must target accessible records in this workspace.',
          );
      }
  }
  async createRecord(
    actor: Actor,
    id: string,
    input: { title: string; values: Record<string, unknown> },
    internalPageId?: string,
  ): Promise<DatabaseRecord> {
    return this.db.transaction(async (tx) => {
      const database = await this.lock(actor, id, tx);
      await new Databases(tx).check(actor, id, input.values);
      const page = await new Pages(tx).create(
        actor,
        database.workspaceId,
        { title: input.title, parentId: id, kind: 'record' },
        internalPageId,
      );
      const computedValues = compileFormulas(await new Databases(tx).fields(actor, id))(
        input.values,
      );
      await tx.query(
        'INSERT INTO records (page_id,database_id,values,computed_values) VALUES ($1,$2,$3,$4)',
        [page.id, id, JSON.stringify(input.values), JSON.stringify(computedValues)],
      );
      return {
        pageId: page.id,
        pageRevision: page.revision,
        title: page.title,
        values: input.values,
        computedValues,
        revision: 1,
        updatedAt: page.updatedAt,
      };
    });
  }
  async updateRecord(
    actor: Actor,
    id: string,
    pageId: string,
    input: {
      title?: string;
      pageRevision?: number;
      values: Record<string, unknown>;
      revision: number;
      expected?: { id: string; value: unknown; field: RecordField };
    },
  ): Promise<DatabaseRecord> {
    if (
      input.title !== undefined &&
      (!Number.isSafeInteger(input.pageRevision) || Number(input.pageRevision) < 1)
    )
      throw new DomainError('INVALID', 'A page revision is required to edit a record title.');
    return this.db.transaction(async (tx) => {
      await this.lock(actor, id, tx);
      const [current] = await tx.query<RecordRow>(
        'SELECT r.*,p.title,p.updated_at,p.revision AS page_revision FROM records r JOIN pages p ON p.id=r.page_id WHERE r.page_id=$1 AND r.database_id=$2 FOR UPDATE OF r',
        [pageId, id],
      );
      if (!current) throw new DomainError('NOT_FOUND', 'Record not found.');
      if (input.expected !== undefined) {
        const expected = input.expected,
          field = (await new Databases(tx).fields(actor, id)).find(
            (field) => field.id === expected?.id,
          );
        if (
          Object.keys(input.values).length !== 1 ||
          !Object.hasOwn(input.values, expected?.id ?? '') ||
          !field ||
          field.archived
        )
          throw new DomainError('INVALID', 'Choose an active record property.');
        if (
          !isDeepStrictEqual(field, expected.field) ||
          !isDeepStrictEqual(
            Object.hasOwn(current.values, field.id) ? current.values[field.id] : null,
            expected.value,
          )
        )
          throw new DomainError(
            'CONFLICT',
            'This property changed while you were editing. Review the latest value before saving.',
          );
      }
      const values = { ...current.values, ...input.values };
      await new Databases(tx).check(actor, id, values);
      const computedValues = compileFormulas(await new Databases(tx).fields(actor, id))(values);
      const [row] = await tx.query<RecordRow>(
        'UPDATE records SET values=$3,computed_values=$5,revision=revision+1 WHERE page_id=$1 AND database_id=$2 AND revision=$4 RETURNING *',
        [pageId, id, JSON.stringify(values), input.revision, JSON.stringify(computedValues)],
      );
      if (!row)
        throw new DomainError('CONFLICT', 'This record changed. Reload it before editing again.');
      const pages = new Pages(tx);
      const page = await pages.get(actor, pageId);
      const updated = await pages.update(actor, pageId, {
        title: input.title ?? page.title,
        revision: input.title !== undefined ? input.pageRevision! : page.revision,
      });
      return {
        ...map({
          ...row,
          title: updated.title,
          updated_at: updated.updatedAt,
          page_revision: updated.revision,
        }),
        values,
        computedValues,
      };
    });
  }
  async records(
    actor: Actor,
    id: string,
    options: RecordQuery = {},
  ): Promise<{ records: DatabaseRecord[]; total: number }> {
    const access = new Access(this.db);
    await access.requirePage(actor, id, 'read');
    const fields = await this.fields(actor, id);
    const direction = options.direction === 'desc' ? 'DESC' : 'ASC';
    const field = fields.find((item) => item.id === options.sort);
    const filter = String(options.filter ?? '').slice(0, 1000);
    const params: unknown[] = [id, `%${filter}%`];
    let where =
      'r.database_id=$1 AND p.deleted_at IS NULL AND (p.title ILIKE $2 OR r.values::text ILIKE $2 OR r.computed_values::text ILIKE $2)';
    if (
      options.dateFrom ||
      options.dateTo ||
      options.undated === true ||
      options.undated === 'true'
    ) {
      if (
        !fields.some(
          (field) => field.id === options.dateField && field.type === 'date' && !field.archived,
        )
      )
        throw new DomainError('INVALID', 'Choose an active date property.');
      params.push(options.dateField);
      const date = `NULLIF(r.values->>$${params.length},'')`;
      if (options.undated === true || options.undated === 'true') where += ` AND ${date} IS NULL`;
      else {
        if (
          !validDate(options.dateFrom) ||
          !validDate(options.dateTo) ||
          options.dateFrom > options.dateTo
        )
          throw new DomainError('INVALID', 'Use a valid calendar date range.');
        params.push(options.dateFrom, options.dateTo);
        where += ` AND ${date} >= $${params.length - 1} AND ${date} <= $${params.length}`;
      }
    }
    const countParams = [...params];
    if (field) params.push(field.id);
    const order = field
      ? ['number', 'formula'].includes(field.type)
        ? `(r.${field.type === 'formula' ? 'computed_values' : 'values'}->>$${params.length})::numeric`
        : `r.values->>$${params.length}`
      : options.sort === 'updated'
        ? 'p.updated_at'
        : options.sort === 'title'
          ? 'p.title'
          : 'p.position';
    params.push(
      Math.min(200, Math.max(1, Number(options.limit) || 50)),
      Math.max(0, Math.min(100000, Number(options.offset) || 0)),
    );
    const rows = await this.db.query<RecordRow>(
      `SELECT r.*,p.title,p.updated_at,p.revision AS page_revision FROM records r JOIN pages p ON p.id=r.page_id WHERE ${where} ORDER BY ${order} ${direction},p.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const [count] = await this.db.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM records r JOIN pages p ON p.id=r.page_id WHERE ${where}`,
      countParams,
    );
    const relations = fields.filter((item) => item.type === 'relation');
    const records = await Promise.all(
      rows.map(async (row) => {
        const record = map(row);
        for (const field of relations)
          if (record.values[field.id]) {
            try {
              await access.requirePage(actor, String(record.values[field.id]), 'read');
            } catch {
              record.values = { ...record.values, [field.id]: null };
            }
          }
        return record;
      }),
    );
    return { records, total: Number(count.total) };
  }
  runAction(actor: Actor, id: string, pageId: string, fieldId: string, revision: number) {
    return this.db.transaction(async (tx) => {
      await this.lock(actor, id, tx);
      const field = (await new Databases(tx).fields(actor, id)).find(
        (field) => field.id === fieldId && field.type === 'button' && !field.archived,
      );
      if (!field?.action) throw new DomainError('INVALID', 'This action is unavailable.');
      return new Databases(tx).updateRecord(actor, id, pageId, {
        values: { [field.action.fieldId]: field.action.value },
        revision,
      });
    });
  }
  async views(actor: Actor, id: string) {
    return (await new DatabaseViews(this.db).snapshot(actor, id)).views;
  }
  async saveView(actor: Actor, id: string, name: string, config: DatabaseViewConfig) {
    return new DatabaseViews(this.db).save(actor, id, name, config);
  }
  updateView(
    actor: Actor,
    id: string,
    viewId: string,
    name: string,
    config: DatabaseViewConfig,
    revision?: number,
  ) {
    return new DatabaseViews(this.db).save(actor, id, name, config, { id: viewId, revision });
  }
  deleteView(actor: Actor, id: string, viewId: string, revision?: number) {
    return new DatabaseViews(this.db).delete(actor, id, viewId, revision);
  }
}
