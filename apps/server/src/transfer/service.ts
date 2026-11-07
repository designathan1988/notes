import type { Database } from '../platform/database.js';
import type { Storage } from '../attachments/storage.js';
import {
  DomainError,
  type Actor,
  type RecordField,
} from '../../../../packages/contracts/src/index.js';
import { Access } from '../access/service.js';
import { Pages } from '../pages/service.js';
import { Databases } from '../databases/service.js';
import { Attachments } from '../attachments/service.js';
import { Documents } from '../documents/service.js';
import {
  documentJSON,
  documentFromJSON,
  emptyDocument,
} from '../../../../packages/editor/src/schema.js';
import * as Y from 'yjs';
import { randomUUID } from 'node:crypto';
import { pack, unpack, orderedPages, rewriteContent, type Manifest } from './archive.js';
export interface ImportReport {
  jobId: string;
  complete: boolean;
  stage: string;
  createdPages: number;
  warnings: string[];
}
interface Job {
  id: string;
  workspace_id: string;
  user_id: string;
  object_key: string;
  stage: string;
  offset_value: number;
  mapping: { pages: Record<string, string>; attachments: Record<string, string> };
  warnings: string[];
  page_count: number;
}
export class Transfer {
  private running = new Map<string, Promise<ImportReport>>();
  constructor(
    readonly db: Database,
    readonly storage: Storage,
  ) {}
  async exportWorkspace(actor: Actor, workspace: string): Promise<Uint8Array> {
    const access = new Access(this.db);
    const pages = await access.visiblePages(actor, workspace);
    const scope = await access.scope(actor, workspace);
    const [count] = await this.db.query<{ count: string }>(
      `${scope.sql} SELECT count(*)::text AS count FROM visible`,
      scope.params,
    );
    if (Number(count.count) > 5000)
      throw new DomainError('LIMIT', 'This export exceeds the beta limit of 5,000 pages.');
    const [info] = await this.db.query<{ name: string }>(
      'SELECT name FROM organization WHERE id=$1',
      [workspace],
    );
    const ids = pages.map((page) => page.id);
    const manifest: Manifest = {
      schemaVersion: 1,
      workspace: { name: info.name },
      pages: [],
      databases: [],
      records: [],
      views: [],
      attachments: [],
    };
    const documents = new Documents(this.db);
    for (const page of pages) {
      const doc = await documents.load(page.id);
      manifest.pages.push({
        id: page.id,
        parentId: page.parentId,
        title: page.title,
        description: page.description,
        kind: page.kind,
        visibility: page.visibility,
        content: documentJSON(doc),
      });
      doc.destroy();
    }
    manifest.databases = await this.db.query(
      'SELECT page_id AS "pageId",fields FROM database_definitions WHERE page_id=ANY($1::text[])',
      [ids],
    );
    for (const definition of manifest.databases)
      definition.fields = await new Databases(this.db).fields(actor, definition.pageId);
    manifest.records = await this.db.query(
      'SELECT page_id AS "pageId",database_id AS "databaseId",values FROM records WHERE page_id=ANY($1::text[])',
      [ids],
    );
    const visible = new Set(ids);
    for (const record of manifest.records) {
      const fields =
        manifest.databases.find((database) => database.pageId === record.databaseId)?.fields ?? [];
      for (const field of fields.filter((field) => field.type === 'relation'))
        if (record.values[field.id] && !visible.has(String(record.values[field.id])))
          record.values[field.id] = null;
    }
    manifest.views = await this.db.query(
      'SELECT database_id AS "databaseId",name,config FROM table_views WHERE database_id=ANY($1::text[])',
      [ids],
    );
    const rows = await this.db.query<{
      id: string;
      pageId: string;
      filename: string;
      mediaType: string;
      size: number;
    }>(
      'SELECT id,page_id AS "pageId",filename,media_type AS "mediaType",size FROM attachments WHERE page_id=ANY($1::text[]) AND status=\'ready\'',
      [ids],
    );
    if (rows.length > 1000 || rows.reduce((sum, file) => sum + file.size, 0) > 100 * 1024 * 1024)
      throw new DomainError('LIMIT', 'Attachment export exceeds the beta archive budget.');
    const files: Record<string, Uint8Array> = {};
    const attachments = new Attachments(this.db, this.storage);
    for (const row of rows) {
      const path = `attachments/${row.id}`;
      files[path] = (await attachments.read(actor, row.id)).bytes;
      manifest.attachments.push({ ...row, path });
    }
    for (const page of pages) await access.requirePage(actor, page.id, 'read');
    const archive = pack(manifest, files);
    if (archive.length > 64 * 1024 * 1024)
      throw new DomainError('LIMIT', 'The compressed export exceeds 64 MiB.');
    return archive;
  }
  async beginImport(actor: Actor, workspace: string, archive: Uint8Array): Promise<ImportReport> {
    await new Access(this.db).requireWorkspace(actor, workspace, 'editor');
    const { manifest } = unpack(archive);
    const [pending] = await this.db.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM transfer_jobs WHERE workspace_id=$1 AND stage<>$2',
      [workspace, 'complete'],
    );
    if (Number(pending.count) >= 3)
      throw new DomainError(
        'LIMIT',
        'Finish or resume the existing imports before starting another.',
      );
    const id = randomUUID();
    const key = `${workspace}/import-${id}`;
    await this.storage.write(key, Buffer.from(archive));
    const mapping = {
      pages: Object.fromEntries(manifest.pages.map((page) => [page.id, randomUUID()])),
      attachments: Object.fromEntries(manifest.attachments.map((file) => [file.id, randomUUID()])),
    };
    try {
      const job = await this.db.transaction(async (tx) => {
        await tx.query('SELECT id FROM organization WHERE id=$1 FOR UPDATE', [workspace]);
        const [active] = await tx.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM transfer_jobs WHERE workspace_id=$1 AND stage<>$2',
          [workspace, 'complete'],
        );
        if (Number(active.count) >= 3)
          throw new DomainError('LIMIT', 'Finish or resume existing imports first.');
        const [created] = await tx.query<Job>(
          'INSERT INTO transfer_jobs (id,workspace_id,user_id,object_key,archive_size,mapping,page_count) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
          [
            id,
            workspace,
            actor.userId,
            key,
            archive.length,
            JSON.stringify(mapping),
            manifest.pages.length,
          ],
        );
        return created;
      });
      return this.report(job);
    } catch (error) {
      await this.storage.remove(key);
      throw error;
    }
  }
  async list(actor: Actor, workspace: string) {
    await new Access(this.db).requireWorkspace(actor, workspace, 'editor');
    const jobs = await this.db.query<Job>(
      'SELECT * FROM transfer_jobs WHERE workspace_id=$1 AND user_id=$2 AND stage<>$3 ORDER BY created_at DESC',
      [workspace, actor.userId, 'complete'],
    );
    return jobs.map((job) => this.report(job));
  }
  private report(job: Job): ImportReport {
    return {
      jobId: job.id,
      complete: job.stage === 'complete',
      stage: job.stage,
      createdPages: job.stage === 'pages' ? job.offset_value : job.page_count,
      warnings: job.warnings,
    };
  }
  async advance(actor: Actor, id: string): Promise<ImportReport> {
    const active = this.running.get(id);
    if (active) {
      await active;
      return this.advance(actor, id);
    }
    const operation = this.advanceBatch(actor, id);
    this.running.set(id, operation);
    try {
      return await operation;
    } finally {
      this.running.delete(id);
    }
  }
  private async advanceBatch(actor: Actor, id: string): Promise<ImportReport> {
    const [job] = await this.db.query<Job>(
      'SELECT * FROM transfer_jobs WHERE id=$1 AND user_id=$2',
      [id, actor.userId],
    );
    if (!job) throw new DomainError('FORBIDDEN', 'This import is unavailable.');
    await new Access(this.db).requireWorkspace(actor, job.workspace_id, 'editor');
    if (job.stage === 'complete') return this.report(job);
    const { manifest, files } = unpack(await this.storage.read(job.object_key));
    const pages = orderedPages(manifest.pages);
    const stages = ['pages', 'attachments', 'documents', 'records', 'views', 'complete'];
    let nextOffset = job.offset_value;
    let nextStage = job.stage;
    const warnings = [...job.warnings];
    const items =
      job.stage === 'pages' || job.stage === 'documents'
        ? pages
        : job.stage === 'attachments'
          ? manifest.attachments
          : job.stage === 'records'
            ? manifest.records
            : manifest.views;
    const count = job.stage === 'attachments' ? 1 : 50;
    const end = Math.min(items.length, nextOffset + count);
    const start = nextOffset;
    nextOffset = end;
    if (end >= items.length) {
      nextStage = stages[stages.indexOf(job.stage) + 1];
      nextOffset = 0;
    }
    const storeProgress = async (tx: Database) => {
      const [updated] = await tx.query<Job>(
        'UPDATE transfer_jobs SET stage=$2,offset_value=$3,warnings=$4 WHERE id=$1 AND stage=$5 AND offset_value=$6 RETURNING *',
        [id, nextStage, nextOffset, JSON.stringify(warnings), job.stage, start],
      );
      if (!updated)
        throw new DomainError(
          'CONFLICT',
          'Another request advanced this import. Resume to load its latest progress.',
        );
      return updated;
    };
    let updated: Job;
    if (job.stage === 'attachments') {
      for (let i = start; i < end; i++) {
        const file = manifest.attachments[i];
        const attachments = new Attachments(this.db, this.storage);
        const target = await attachments.begin(
          actor,
          job.mapping.pages[file.pageId],
          { filename: file.filename, mediaType: file.mediaType, size: file.size },
          job.mapping.attachments[file.id],
        );
        await attachments.upload(actor, target.id, Buffer.from(files[file.path]));
      }
      updated = await this.db.transaction(storeProgress);
    } else
      updated = await this.db.transaction(async (tx) => {
        const [locked] = await tx.query<Job>('SELECT * FROM transfer_jobs WHERE id=$1 FOR UPDATE', [
          id,
        ]);
        if (locked.stage !== job.stage || locked.offset_value !== start)
          throw new DomainError(
            'CONFLICT',
            'Another request advanced this import. Resume to load its latest progress.',
          );
        const service = new Pages(tx);
        const databases = new Databases(tx);
        for (let i = start; i < end; i++) {
          if (job.stage === 'pages') {
            const page = pages[i];
            const newId = job.mapping.pages[page.id];
            const exists = await tx.query('SELECT id FROM pages WHERE id=$1', [newId]);
            if (exists.length) continue;
            if (page.kind === 'record') {
              await databases.createRecord(
                actor,
                job.mapping.pages[page.parentId!],
                { title: page.title, values: {} },
                newId,
              );
              if (page.description) {
                const created = await service.get(actor, newId);
                await service.update(actor, newId, {
                  description: page.description,
                  revision: created.revision,
                });
              }
            } else {
              await service.create(
                actor,
                job.workspace_id,
                {
                  title: page.title,
                  description: page.description,
                  parentId: page.parentId ? job.mapping.pages[page.parentId] : null,
                  kind: page.kind,
                  visibility: page.visibility,
                },
                newId,
              );
              if (page.kind === 'database') {
                const fields = manifest.databases.find(
                  (database) => database.pageId === page.id,
                )!.fields;
                await databases.setFields(actor, newId, fields);
              }
            }
          } else if (job.stage === 'documents') {
            const page = pages[i];
            let doc: Y.Doc;
            try {
              doc = documentFromJSON(
                rewriteContent(page.content, job.mapping.pages, job.mapping.attachments),
              );
            } catch {
              doc = documentFromJSON({
                type: 'doc',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', text: 'Unsupported content was preserved as JSON below.' },
                    ],
                  },
                  {
                    type: 'codeBlock',
                    attrs: { language: 'json' },
                    content: [{ type: 'text', text: JSON.stringify(page.content, null, 2) }],
                  },
                ],
              });
              warnings.push(`Original JSON preserved for ${page.title}`);
            }
            try {
              await new Documents(tx).save(
                actor,
                job.mapping.pages[page.id],
                Y.encodeStateAsUpdate(doc),
                1,
              );
            } finally {
              doc.destroy();
            }
          } else if (job.stage === 'records') {
            const record = manifest.records[i];
            const fields = manifest.databases.find(
              (database) => database.pageId === record.databaseId,
            )!.fields;
            const values = { ...record.values };
            for (const field of fields.filter((field) => field.type === 'relation'))
              if (values[field.id])
                values[field.id] = job.mapping.pages[String(values[field.id])] ?? null;
            const [row] = await tx.query<{ revision: number }>(
              'SELECT revision FROM records WHERE page_id=$1',
              [job.mapping.pages[record.pageId]],
            );
            await databases.updateRecord(
              actor,
              job.mapping.pages[record.databaseId],
              job.mapping.pages[record.pageId],
              { values, revision: row.revision },
            );
          } else if (job.stage === 'views') {
            const view = manifest.views[i];
            await databases.saveView(
              actor,
              job.mapping.pages[view.databaseId],
              view.name,
              view.config,
            );
          }
        }
        return storeProgress(tx);
      });
    if (updated.stage === 'complete') await this.storage.remove(job.object_key);
    return this.report(updated);
  }
}
