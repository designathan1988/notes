import { setTemplateMetadata } from '../pages/revisions.js';
import { assertObject, DomainError, type Actor } from '../../../../packages/contracts/src/index.js';
import type { Database } from '../platform/database.js';
import { Access } from '../access/service.js';

/** Defaults are blueprint values, never a duplicate database schema or a live record. */
export function templateValues(input: unknown): Record<string, unknown> {
  assertObject(input);
  if (Object.keys(input).length > 50)
    throw new DomainError('LIMIT', 'Use up to 50 template defaults.');
  for (const [id, value] of Object.entries(input)) {
    if (!/^[\w-]{1,64}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id))
      throw new DomainError('INVALID', 'Invalid template property ID.');
    if (
      value === null ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    )
      continue;
    if (typeof value === 'string' && value.length <= 10000 && !value.includes('\0')) continue;
    if (
      Array.isArray(value) &&
      value.length <= 100 &&
      value.every((item) => typeof item === 'string' && item.length <= 100 && !item.includes('\0'))
    )
      continue;
    throw new DomainError('INVALID', 'Template defaults need supported typed values.');
  }
  if (Buffer.byteLength(JSON.stringify(input)) > 64 * 1024)
    throw new DomainError('LIMIT', 'Template defaults must fit within 64 KiB.');
  return input;
}

export async function markTemplate(
  db: Database,
  actor: Actor,
  pageId: string,
  rootId: string,
  databaseId: string | null = null,
  values: Record<string, unknown> = {},
) {
  const access = new Access(db),
    page = await access.lockPage(actor, pageId),
    root = await access.requirePage(actor, rootId, 'write');
  if (
    root.workspaceId !== page.workspaceId ||
    root.parentId !== null ||
    root.kind === 'record' ||
    (pageId !== rootId &&
      (await access.requirePage(actor, page.parentId!, 'write')).templateRootId !== rootId)
  )
    throw new DomainError('INVALID', 'A template must have one root and an owned page tree.');
  if (
    databaseId &&
    (pageId !== rootId ||
      page.kind !== 'document' ||
      databaseId.length > 128 ||
      !/^[\w-]+$/.test(databaseId) ||
      page.properties?.fields.length)
  )
    throw new DomainError('INVALID', 'Record templates use their database schema.');
  templateValues(values);
  if (!databaseId && Object.keys(values).length)
    throw new DomainError('INVALID', 'Record defaults require a database reference.');
  await setTemplateMetadata(db, pageId, { rootId, databaseId, values });
}

export async function assertSourceReady(db: Database, id: string) {
  const importing = await db.query(
    "SELECT 1 FROM transfer_jobs j CROSS JOIN LATERAL jsonb_each_text(j.mapping->'pages') p WHERE j.stage<>'complete' AND p.value=$1 LIMIT 1",
    [id],
  );
  if (importing.length)
    throw new DomainError(
      'CONFLICT',
      'This page is still being restored. Finish its import before copying it.',
    );
}
