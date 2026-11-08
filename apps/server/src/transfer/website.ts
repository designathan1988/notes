import { zipSync, strToU8 } from 'fflate';
import type { Database } from '../platform/database.js';
import type { Storage } from '../attachments/storage.js';
import { Access } from '../access/service.js';
import { Attachments } from '../attachments/service.js';
import { Documents } from '../documents/service.js';
import { documentJSON, validateDocument } from '../../../../packages/editor/src/schema.js';
import { webSource } from '../../../../packages/editor/src/web.js';
import { DomainError, type Actor } from '../../../../packages/contracts/src/index.js';

/** Portable output only; editable website files remain owned by Documents. */
export async function exportWebsite(
  db: Database,
  storage: Storage,
  actor: Actor,
  pageId: string,
  position: number,
) {
  if (!Number.isSafeInteger(position) || position < 0)
    throw new DomainError('INVALID', 'Choose a saved website to export.');
  const page = await new Access(db).requirePage(actor, pageId, 'read'),
    document = await new Documents(db).load(page.id);
  try {
    const node = validateDocument(documentJSON(document), page.kind).nodeAt(position);
    if (!node || !['webPage', 'webComponent'].includes(node.type.name))
      throw new DomainError('NOT_FOUND', 'The website source was removed or moved.');
    const source = webSource(node.toJSON()),
      files: Record<string, Uint8Array> = Object.create(null);
    for (const file of source.files) {
      if (file.path === '.note' || file.path.startsWith('.note/'))
        throw new DomainError(
          'INVALID',
          'Move source files out of the reserved .note folder before exporting.',
        );
      files[file.path] = strToU8(file.text);
    }
    let total = Object.values(files).reduce((sum, value) => sum + value.length, 0);
    const attachments = new Attachments(db, storage);
    for (const [logicalId, id] of Object.entries(source.assets)) {
      const [owned] = await db.query('SELECT id FROM attachments WHERE id=$1 AND page_id=$2', [
        id,
        pageId,
      ]);
      if (!owned)
        throw new DomainError('NOT_FOUND', 'This media does not belong to the exported page.');
      const attachment = await attachments.read(actor, id);
      total += attachment.size;
      if (total > 64 * 1024 * 1024)
        throw new DomainError('LIMIT', 'Website export supports up to 64 MiB including media.');
      files[`.note/assets/${logicalId}`] = attachment.bytes;
    }
    files['.note/website.json'] = strToU8(
      JSON.stringify({ schemaVersion: 1, title: page.title, entry: source.entry }, null, 2),
    );
    files['.note/README.txt'] = strToU8(
      `Website: ${page.title}\nEntry: ${source.entry}\n\nServe this folder with a static HTTP server and open the entry path. Original source files are unchanged. Modules follow ordinary browser CORS rules. External fonts, dependencies and links retain their original URLs. Managed media lives in .note/assets. No Note login or temporary preview URL is required.\n`,
    );
    return zipSync(files);
  } finally {
    document.destroy();
  }
}
