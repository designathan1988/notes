import { Unzip, UnzipInflate, zipSync, strToU8, strFromU8 } from 'fflate';
import type { JSONContent } from '@tiptap/core';
import {
  DomainError,
  type PageKind,
  type RecordField,
  type Page,
} from '../../../../packages/contracts/src/index.js';
import { validateFields, validateValues } from '../databases/values.js';
import { validatePresentation } from '../pages/details.js';
import { validatePageProperties } from '../pages/properties.js';
import { templateValues } from '../templates/metadata.js';
export const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
export const MAX_MANIFEST_BYTES = 32 * 1024 * 1024;
export const MAX_ARCHIVED_PAGE_BYTES = 8 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 128 * 1024 * 1024;
export interface ArchivePage {
  templateRootId?: Page['templateRootId'];
  templateDatabaseId?: Page['templateDatabaseId'];
  templateValues?: Page['templateValues'];
  properties?: Page['properties'];
  icon?: Page['icon'];
  cover?: Page['cover'];
  tags?: Page['tags'];
  id: string;
  parentId: string | null;
  title: string;
  description: string;
  kind: PageKind;
  visibility: 'workspace' | 'private';
  content: JSONContent;
}
export interface Manifest {
  schemaVersion: 1 | 2;
  workspace: { name: string };
  pages: ArchivePage[];
  databases: { pageId: string; fields: RecordField[] }[];
  records: { pageId: string; databaseId: string; values: Record<string, unknown> }[];
  views: { databaseId: string; name: string; config: Record<string, unknown> }[];
  attachments: {
    id: string;
    pageId: string;
    filename: string;
    mediaType: string;
    size: number;
    path: string;
  }[];
}
export function pack(manifest: Manifest, files: Record<string, Uint8Array>) {
  const bytes = strToU8(JSON.stringify(manifest));
  if (bytes.length > MAX_MANIFEST_BYTES)
    throw new DomainError('LIMIT', 'The backup manifest exceeds the 32 MiB restore budget.');
  let total = bytes.length;
  for (const [path, content] of Object.entries(files)) {
    if (!/^attachments\/[\w-]{1,128}$/.test(path) || content.length > 25 * 1024 * 1024)
      throw new DomainError('LIMIT', 'A backup attachment exceeds restore limits.');
    total += content.length;
  }
  if (total > MAX_EXPANDED_BYTES || Object.keys(files).length > 9999)
    throw new DomainError('LIMIT', 'The backup exceeds the expanded restore budget.');
  validateManifest(manifest, files);
  const archive = zipSync({ 'manifest.json': bytes, ...files }, { level: 6 });
  if (archive.length > MAX_ARCHIVE_BYTES)
    throw new DomainError('LIMIT', 'The compressed backup exceeds 64 MiB.');
  return archive;
}
export function unpack(bytes: Uint8Array): {
  manifest: Manifest;
  files: Record<string, Uint8Array>;
} {
  if (bytes.length > MAX_ARCHIVE_BYTES)
    throw new DomainError('LIMIT', 'Workspace archives must be 64 MiB or smaller.');
  const files: Record<string, Uint8Array> = {};
  let total = 0;
  let count = 0;
  let failure: Error | null = null;
  try {
    const unzip = new Unzip((file) => {
      if (failure) return;
      count++;
      const limit = file.name === 'manifest.json' ? MAX_MANIFEST_BYTES : 25 * 1024 * 1024;
      if (
        count > 10000 ||
        !/^(manifest\.json|attachments\/[\w-]{1,128})$/.test(file.name) ||
        (file.originalSize ?? 0) > limit ||
        Object.hasOwn(files, file.name)
      ) {
        failure = new DomainError(
          'LIMIT',
          'Archive entries exceed the allowed paths, count, or size.',
        );
        return;
      }
      const chunks: Uint8Array[] = [];
      let size = 0;
      file.ondata = (error, data, final) => {
        if (error) {
          failure = error;
          return;
        }
        if (failure) return;
        size += data.length;
        total += data.length;
        if (size > limit || total > MAX_EXPANDED_BYTES) {
          failure = new DomainError('LIMIT', 'Expanded archive exceeds the import limit.');
          file.terminate();
          return;
        }
        chunks.push(data);
        if (final) {
          const output = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            output.set(chunk, offset);
            offset += chunk.length;
          }
          files[file.name] = output;
        }
      };
      file.start();
    });
    unzip.register(UnzipInflate);
    for (let offset = 0; offset < bytes.length; offset += 16384) {
      unzip.push(bytes.subarray(offset, offset + 16384), offset + 16384 >= bytes.length);
      if (failure) throw failure;
    }
    if (!files['manifest.json']) throw new Error('Manifest missing');
    const manifest = JSON.parse(strFromU8(files['manifest.json'])) as Manifest;
    validateManifest(manifest, files);
    return { manifest, files };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('INVALID', 'This is not a supported Note workspace archive.');
  }
}
export function orderedPages(pages: ArchivePage[]) {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const children = new Map<string, ArchivePage[]>();
  const queue: ArchivePage[] = [];
  for (const page of pages) {
    if (!page.parentId) queue.push(page);
    else {
      if (!byId.has(page.parentId)) throw new DomainError('INVALID', 'A page parent is missing.');
      const list = children.get(page.parentId) ?? [];
      list.push(page);
      children.set(page.parentId, list);
    }
  }
  const result: ArchivePage[] = [];
  for (let i = 0; i < queue.length; i++) {
    const page = queue[i];
    result.push(page);
    queue.push(...(children.get(page.id) ?? []));
  }
  if (result.length !== pages.length)
    throw new DomainError('INVALID', 'The archive contains a hierarchy cycle.');
  return result;
}
function validateManifest(manifest: Manifest, files: Record<string, Uint8Array>) {
  if (
    !manifest ||
    ![1, 2].includes(manifest.schemaVersion) ||
    !manifest.workspace ||
    typeof manifest.workspace.name !== 'string' ||
    !Array.isArray(manifest.pages) ||
    manifest.pages.length > 5000 ||
    !Array.isArray(manifest.databases) ||
    !Array.isArray(manifest.records) ||
    !Array.isArray(manifest.views) ||
    !Array.isArray(manifest.attachments)
  )
    throw new DomainError('INVALID', 'Unsupported archive structure or schema version.');
  const ids = new Set<string>();
  for (const page of manifest.pages) {
    if (
      !page ||
      typeof page.id !== 'string' ||
      !/^[\w-]{1,128}$/.test(page.id) ||
      ids.has(page.id) ||
      !['document', 'database', 'record'].includes(page.kind) ||
      !['private', 'workspace'].includes(page.visibility) ||
      typeof page.title !== 'string' ||
      !page.title.trim() ||
      page.title.length > 300 ||
      typeof page.description !== 'string' ||
      page.description.length > 2000 ||
      !page.content ||
      strToU8(JSON.stringify(page.content)).length > MAX_ARCHIVED_PAGE_BYTES
    )
      throw new DomainError('INVALID', 'An archived page is invalid or too large.');
    ids.add(page.id);
    validatePresentation(page);
    if (page.properties !== undefined) {
      if (page.kind !== 'document')
        throw new DomainError('INVALID', 'Record properties must use their database schema.');
      validatePageProperties(page.properties);
    }
  }
  orderedPages(manifest.pages);
  for (const page of manifest.pages) {
    const marker = page.templateRootId,
      database = page.templateDatabaseId;
    if (marker != null) {
      const root = manifest.pages.find((root) => root.id === marker);
      if (
        typeof marker !== 'string' ||
        !root ||
        root.templateRootId !== root.id ||
        root.parentId !== null ||
        root.kind === 'record' ||
        (page.id !== marker &&
          manifest.pages.find((parent) => parent.id === page.parentId)?.templateRootId !== marker)
      )
        throw new DomainError(
          'INVALID',
          'An archived template must have one root and an owned page tree.',
        );
    }
    if (
      page.parentId &&
      manifest.pages.find((parent) => parent.id === page.parentId)?.templateRootId != null &&
      page.templateRootId !==
        manifest.pages.find((parent) => parent.id === page.parentId)?.templateRootId
    )
      throw new DomainError('INVALID', 'Template descendants must share their root.');
    if (database != null) {
      const referenced = manifest.pages.find((item) => item.id === database);
      if (
        typeof database !== 'string' ||
        !/^[\w-]{1,128}$/.test(database) ||
        marker !== page.id ||
        page.kind !== 'document' ||
        (referenced && referenced.kind !== 'database') ||
        page.properties?.fields.length ||
        Object.keys(page.properties?.values ?? {}).length
      )
        throw new DomainError(
          'INVALID',
          'An archived record template must reference its database schema.',
        );
      templateValues(page.templateValues ?? {});
    } else if (Object.keys(page.templateValues ?? {}).length)
      throw new DomainError('INVALID', 'Template defaults require a database reference.');
  }
  const databases = new Set<string>();
  for (const database of manifest.databases) {
    if (
      databases.has(database.pageId) ||
      manifest.pages.find((page) => page.id === database.pageId)?.kind !== 'database'
    )
      throw new DomainError('INVALID', 'Invalid database ownership.');
    validateFields(database.fields);
    databases.add(database.pageId);
  }
  const recordIds = new Set<string>();
  for (const record of manifest.records) {
    const page = manifest.pages.find((page) => page.id === record.pageId);
    if (
      recordIds.has(record.pageId) ||
      page?.kind !== 'record' ||
      page.parentId !== record.databaseId ||
      !databases.has(record.databaseId) ||
      !record.values ||
      typeof record.values !== 'object' ||
      Array.isArray(record.values)
    )
      throw new DomainError('INVALID', 'Invalid record ownership.');
    validateValues(
      manifest.databases.find((database) => database.pageId === record.databaseId)!.fields,
      record.values,
    );
    recordIds.add(record.pageId);
  }
  for (const page of manifest.pages)
    if (
      (page.kind === 'record' && !recordIds.has(page.id)) ||
      (page.kind === 'database' && !databases.has(page.id))
    )
      throw new DomainError('INVALID', 'An archived schema or record is missing.');
  for (const page of manifest.pages)
    if (
      page.parentId &&
      manifest.pages.find((parent) => parent.id === page.parentId)?.kind === 'database' &&
      page.kind !== 'record'
    )
      throw new DomainError('INVALID', 'Database children must be records.');
  const attachmentIds = new Set<string>();
  for (const file of manifest.attachments) {
    if (
      attachmentIds.has(file.id) ||
      !/^[\w-]{1,128}$/.test(file.id) ||
      !ids.has(file.pageId) ||
      file.path !== `attachments/${file.id}` ||
      !files[file.path] ||
      files[file.path].length !== file.size ||
      typeof file.filename !== 'string' ||
      typeof file.mediaType !== 'string'
    )
      throw new DomainError('INVALID', 'An archived attachment is invalid or missing.');
    attachmentIds.add(file.id);
  }
  for (const page of manifest.pages) {
    if (page.cover?.type !== 'image') continue;
    const file = manifest.attachments.find(
      (file) => file.id === (page.cover as { attachmentId: string }).attachmentId,
    );
    if (
      !file ||
      file.pageId !== page.id ||
      !['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.mediaType)
    )
      throw new DomainError(
        'INVALID',
        'An archived cover must reference its own image attachment.',
      );
  }
  for (const view of manifest.views)
    if (
      !databases.has(view.databaseId) ||
      typeof view.name !== 'string' ||
      !view.config ||
      typeof view.config !== 'object'
    )
      throw new DomainError('INVALID', 'An archived view is invalid.');
}
export function rewriteContent(
  content: JSONContent,
  pages: Record<string, string>,
  attachments: Record<string, string>,
  preserveExternal = false,
): JSONContent {
  const copy = structuredClone(content);
  const queue = [copy];
  let nodes = 0;
  const reference = (map: Record<string, string>, id: unknown) =>
    map[String(id)] ?? (preserveExternal ? String(id) : 'unavailable');
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    if (++nodes > 100000) throw new DomainError('LIMIT', 'The document contains too many nodes.');
    if (node.attrs) {
      if (node.type === 'pageLink' || node.type === 'wikiLink')
        node.attrs.targetId = reference(pages, node.attrs.targetId);
      if (node.type === 'databaseView')
        node.attrs.databaseId = reference(pages, node.attrs.databaseId);
      if (node.type === 'attachment') node.attrs.id = reference(attachments, node.attrs.id);
    }
    for (const mark of node.marks ?? []) {
      const match =
        mark.type === 'link' && typeof mark.attrs?.href === 'string'
          ? /^#([\w-]{1,128})(\/(?:document|database))?$/.exec(mark.attrs.href)
          : null;
      if (match) mark.attrs!.href = `#${reference(pages, match[1])}${match[2] ?? '/document'}`;
    }
    queue.push(...(node.content ?? []));
  }
  return copy;
}
