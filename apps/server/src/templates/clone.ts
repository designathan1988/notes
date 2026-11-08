import { findOperation, recordOperation } from '../platform/operations.js';
import { createHash, randomUUID } from 'node:crypto';
import type {
  Actor,
  Page,
  PageKind,
  RecordField,
} from '../../../../packages/contracts/src/index.js';
import { DomainError, validateTitle } from '../../../../packages/contracts/src/index.js';
import { documentFromJSON, emptyDocument } from '../../../../packages/editor/src/schema.js';
import type { Database } from '../platform/database.js';
import type { Storage } from '../attachments/storage.js';
import { Access } from '../access/service.js';
import { Attachments } from '../attachments/service.js';
import { Pages } from '../pages/service.js';
import { PageDetails } from '../pages/details.js';
import { PageInstances } from '../pages/instantiation.js';
import { Databases } from '../databases/service.js';
import { rewriteContent } from '../transfer/archive.js';
import { readBlueprint, type Blueprint } from './blueprint.js';
import { markTemplate, templateValues } from './metadata.js';
import { inspectDefaults } from './defaults.js';

export interface CloneInput {
  mode: 'template' | 'instance' | 'duplicate';
  requestId: unknown;
  expectedUserId: unknown;
  title?: unknown;
  parentId?: unknown;
  visibility?: unknown;
}
interface Receipt {
  intent: string;
  pageId: string;
}
export class TemplateClone {
  constructor(
    readonly db: Database,
    readonly storage: Storage,
  ) {}
  async blank(
    actor: Actor,
    workspace: string,
    input: Pick<CloneInput, 'requestId' | 'expectedUserId' | 'title' | 'visibility'>,
  ) {
    if (input.expectedUserId !== actor.userId)
      throw new DomainError('CONFLICT', 'The account changed. Reopen templates before continuing.');
    if (typeof input.requestId !== 'string' || !/^[\w-]{8,100}$/.test(input.requestId))
      throw new DomainError('INVALID', 'A stable creation request ID is required.');
    const title = validateTitle(input.title ?? 'Untitled template'),
      visibility = input.visibility ?? 'private';
    if (!['private', 'workspace'].includes(String(visibility)))
      throw new DomainError('INVALID', 'Choose a valid visibility.');
    const key =
        'tree-instance:' +
        createHash('sha256')
          .update(JSON.stringify([actor.userId, workspace, input.requestId]))
          .digest('hex'),
      intent = createHash('sha256')
        .update(JSON.stringify(['blank', title, visibility]))
        .digest('hex');
    return this.db.transaction(async (tx) => {
      const access = new Access(tx);
      await access.guardWorkspace(workspace);
      await access.requireWorkspace(actor, workspace, 'editor');
      const receipt = await findOperation<Receipt>(tx, key);
      const existing = receipt && { result: receipt };
      if (existing) {
        if (existing.result.intent !== intent)
          throw new DomainError(
            'CONFLICT',
            'This request belongs to a different creation operation.',
          );
        return new Pages(tx).get(actor, existing.result.pageId);
      }
      const doc = documentFromJSON(emptyDocument);
      try {
        const page = await new PageInstances(tx).persist(actor, workspace, {
          title,
          visibility: visibility as Page['visibility'],
          kind: 'document',
          parentId: null,
          content: doc,
        });
        await markTemplate(tx, actor, page.id, page.id);
        await recordOperation(tx, key, { intent, pageId: page.id });
        return new Pages(tx).get(actor, page.id);
      } finally {
        doc.destroy();
      }
    });
  }
  async create(
    actor: Actor,
    workspace: string,
    sourceId: string,
    input: CloneInput,
  ): Promise<Page> {
    if (input.expectedUserId !== actor.userId)
      throw new DomainError('CONFLICT', 'The account changed. Reopen templates before continuing.');
    if (
      !['template', 'instance', 'duplicate'].includes(input.mode) ||
      typeof input.requestId !== 'string' ||
      !/^[\w-]{8,100}$/.test(input.requestId)
    )
      throw new DomainError(
        'INVALID',
        'A supported copy operation and stable request ID are required.',
      );
    if (input.parentId != null && typeof input.parentId !== 'string')
      throw new DomainError('INVALID', 'Choose a valid destination.');
    if (
      input.visibility !== undefined &&
      !['private', 'workspace'].includes(String(input.visibility))
    )
      throw new DomainError('INVALID', 'Choose a valid visibility.');
    if (input.title !== undefined) validateTitle(input.title);
    if (input.mode === 'template' && input.parentId != null)
      throw new DomainError('INVALID', 'Save templates in the template library.');
    const intent = createHash('sha256')
      .update(
        JSON.stringify([
          sourceId,
          input.mode,
          input.title ?? null,
          input.parentId ?? null,
          input.visibility ?? null,
        ]),
      )
      .digest('hex');
    const key =
      'tree-instance:' +
      createHash('sha256')
        .update(JSON.stringify([actor.userId, workspace, input.requestId]))
        .digest('hex');
    const replay = async (tx: Database) => {
      const receipt = await findOperation<Receipt>(tx, key);
      const row = receipt && { result: receipt };
      if (!row) return null;
      if (row.result.intent !== intent)
        throw new DomainError(
          'CONFLICT',
          'This request already belongs to a different copy operation.',
        );
      return new Pages(tx).get(actor, row.result.pageId);
    };
    const prepared = await this.db.transaction(async (tx) => {
      const access = new Access(tx);
      await access.guardWorkspace(workspace);
      await access.requireWorkspace(actor, workspace, 'editor');
      const existing = await replay(tx);
      if (existing) return { existing };
      const plan = await readBlueprint(tx, actor, workspace, sourceId),
        root = plan.nodes[0].page;
      if (input.mode === 'instance' && root.templateRootId !== root.id)
        throw new DomainError('INVALID', 'Choose a template root.');
      if (input.mode === 'instance' && root.templateDatabaseId) {
        const review = await inspectDefaults(tx, actor, root);
        if (review.issues.length)
          throw new DomainError(
            'INVALID',
            'Review this template’s defaults: a database property, option or relation changed.',
          );
      }
      return { plan };
    });
    if (prepared.existing) return prepared.existing;
    const plan = prepared.plan!,
      mapping = Object.fromEntries(plan.nodes.map((node) => [node.page.id, randomUUID()])),
      rootId = mapping[sourceId];
    const assets = plan.nodes
      .flatMap((node) =>
        node.assets.map((asset) => ({
          source: asset,
          sourcePageId: node.page.id,
          id: randomUUID(),
          key: '',
          pageId: mapping[node.page.id],
        })),
      )
      .map((asset) => ({ ...asset, key: `${workspace}/${asset.id}` }));
    const staged: string[] = [];
    let published = false;
    try {
      for (const asset of assets) {
        const file = await new Attachments(this.db, this.storage).read(actor, asset.source.id);
        staged.push(asset.key);
        await this.storage.write(asset.key, file.bytes);
      }
      const result = await this.db.transaction(async (tx) => {
        const access = new Access(tx);
        await access.guardWorkspace(workspace);
        await access.requireWorkspace(actor, workspace, 'editor');
        const existing = await replay(tx);
        if (existing) return { page: existing, created: false };
        if ((await readBlueprint(tx, actor, workspace, sourceId)).proof !== plan.proof)
          throw new DomainError(
            'CONFLICT',
            'The source changed while copying. Retry to use its latest content.',
          );
        const source = plan.nodes[0].page,
          saving =
            input.mode === 'template' ||
            (input.mode === 'duplicate' && source.templateRootId === source.id),
          recordDatabase = !saving
            ? (source.templateDatabaseId ?? (source.kind === 'record' ? source.parentId : null))
            : null;
        if (saving && input.parentId != null)
          throw new DomainError('INVALID', 'Save template roots in the template library.');
        const parentId =
          recordDatabase ??
          (saving
            ? null
            : input.parentId === undefined
              ? input.mode === 'duplicate'
                ? source.parentId
                : null
              : (input.parentId as string | null));
        if (recordDatabase && input.parentId != null && input.parentId !== recordDatabase)
          throw new DomainError('INVALID', 'Record templates belong to their owning database.');
        const parent = parentId ? await access.requirePage(actor, parentId, 'write') : null;
        if (parent && parent.workspaceId !== workspace)
          throw new DomainError('FORBIDDEN', 'Choose a destination in this workspace.');
        const marker = saving ? rootId : (parent?.templateRootId ?? null);
        const title = validateTitle(
          input.title ??
            (input.mode === 'duplicate' ? `${source.title} (copy)`.slice(0, 300) : source.title),
        );
        const visibility =
          (input.visibility as Page['visibility'] | undefined) ??
          (saving ? 'private' : source.visibility);
        const pages = new Pages(tx),
          databases = new Databases(tx);
        for (const node of plan.nodes) {
          const isRoot = node.page.id === sourceId,
            ownAssets = assets.filter((asset) => asset.sourcePageId === node.page.id),
            assetMap = Object.fromEntries(ownAssets.map((asset) => [asset.source.id, asset.id]));
          const content = documentFromJSON(rewriteContent(node.content, mapping, assetMap, true));
          const kind: PageKind = isRoot
            ? saving && node.page.kind === 'record'
              ? 'document'
              : recordDatabase
                ? 'record'
                : node.page.kind
            : node.page.kind;
          try {
            await new PageInstances(tx).persist(actor, workspace, {
              id: mapping[node.page.id],
              title: isRoot ? title : node.page.title,
              description: node.page.description,
              kind,
              parentId: isRoot ? parentId : mapping[node.page.parentId!],
              visibility,
              content,
            });
          } finally {
            content.destroy();
          }
          if (marker) {
            const databaseId =
              saving && isRoot
                ? (source.templateDatabaseId ?? (source.kind === 'record' ? source.parentId : null))
                : null;
            const values = databaseId
              ? structuredClone(source.templateValues ?? node.record?.values ?? {})
              : {};
            // Relations are remapped below after every owned record has an ID.
            await markTemplate(
              tx,
              actor,
              mapping[node.page.id],
              marker,
              databaseId,
              templateValues(values),
            );
          }
        }
        for (const asset of assets)
          await new Attachments(tx, this.storage).publishPrepared(actor, asset.pageId, {
            id: asset.id,
            filename: asset.source.filename,
            mediaType: asset.source.media_type,
            size: asset.source.size,
          });
        for (const node of plan.nodes)
          if (node.database) {
            await databases.setFields(actor, mapping[node.page.id], node.database.fields);
            for (const view of node.database.views)
              await databases.saveView(actor, mapping[node.page.id], view.name, view.config);
          }
        for (const node of plan.nodes) {
          const id = mapping[node.page.id],
            current = await pages.get(actor, id),
            ownAssets = assets.filter((asset) => asset.sourcePageId === node.page.id),
            assetMap = Object.fromEntries(ownAssets.map((asset) => [asset.source.id, asset.id]));
          await pages.update(actor, id, {
            revision: current.revision,
            description: node.page.description,
            icon: node.page.icon ?? null,
            appearance: node.page.appearance ?? {},
            tags: node.page.tags ?? [],
            cover:
              node.page.cover?.type === 'image'
                ? { ...node.page.cover, attachmentId: assetMap[node.page.cover.attachmentId] }
                : (node.page.cover ?? null),
          });
          const properties = node.page.properties;
          if (
            properties &&
            !node.page.templateDatabaseId &&
            Object.keys(properties.values).length + properties.fields.length &&
            ['document', 'canvas'].includes(current.kind)
          ) {
            const values = structuredClone(properties.values);
            for (const field of properties.fields.filter((field) => field.type === 'relation'))
              if (values[field.id])
                values[field.id] = mapping[String(values[field.id])] ?? values[field.id];
            await new PageDetails(tx).importProperties(
              actor,
              id,
              { fields: properties.fields, values },
              (await pages.get(actor, id)).revision,
            );
          }
          if (current.templateDatabaseId) {
            let fields: RecordField[] = [];
            try {
              fields = await databases.fields(actor, current.templateDatabaseId);
            } catch (error) {
              if (
                !(error instanceof DomainError) ||
                !['FORBIDDEN', 'NOT_FOUND', 'INVALID'].includes(error.code)
              )
                throw error;
            }
            const values = structuredClone(current.templateValues ?? {});
            for (const field of fields.filter((field) => field.type === 'relation'))
              if (values[field.id])
                values[field.id] = mapping[String(values[field.id])] ?? values[field.id];
            await markTemplate(tx, actor, id, marker!, current.templateDatabaseId, values);
          } else if (current.kind === 'record') {
            const values = structuredClone(
                node.page.id === sourceId && source.templateDatabaseId
                  ? (source.templateValues ?? {})
                  : (node.record?.values ?? {}),
              ),
              fields = await databases.fields(actor, current.parentId!);
            for (const field of fields.filter((field) => field.type === 'relation'))
              if (values[field.id])
                values[field.id] = mapping[String(values[field.id])] ?? values[field.id];
            const record = await databases.record(actor, current.parentId!, id);
            await databases.updateRecord(actor, current.parentId!, id, {
              revision: record.revision,
              values,
            });
          }
        }
        await recordOperation(tx, key, { intent, pageId: rootId });
        return { page: await pages.get(actor, rootId), created: true };
      });
      published = result.created;
      return result.page;
    } finally {
      if (!published) await Promise.allSettled(staged.map((key) => this.storage.remove(key)));
    }
  }
}
