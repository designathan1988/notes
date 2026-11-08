import type { Database } from '../platform/database.js';
import type { Storage } from './storage.js';
import {
  DomainError,
  MAX_FILE_BYTES,
  type Actor,
} from '../../../../packages/contracts/src/index.js';
import { Access } from '../access/service.js';
import { randomUUID } from 'node:crypto';
import { availableStorage } from '../platform/storage-capacity.js';
export interface Attachment {
  id: string;
  pageId: string;
  filename: string;
  mediaType: string;
  size: number;
  status: string;
  objectKey: string;
}
type Row = {
  id: string;
  page_id: string;
  filename: string;
  media_type: string;
  size: number;
  status: string;
  object_key: string;
};
const map = (row: Row): Attachment => ({
  id: row.id,
  pageId: row.page_id,
  filename: row.filename,
  mediaType: row.media_type,
  size: row.size,
  status: row.status,
  objectKey: row.object_key,
});
function safeInline(type: string, bytes: Buffer) {
  if (type === 'image/png')
    return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/gif') return bytes.toString('ascii', 0, 4) === 'GIF8';
  if (type === 'image/webp')
    return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (type === 'video/mp4' || type === 'audio/mp4') return bytes.toString('ascii', 4, 8) === 'ftyp';
  if (type === 'video/webm' || type === 'audio/webm')
    return bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]));
  if (type === 'audio/mpeg')
    return (
      bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224)
    );
  if (type === 'audio/wav')
    return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE';
  if (type === 'audio/ogg' || type === 'video/ogg') return bytes.toString('ascii', 0, 4) === 'OggS';
  return false;
}
export class Attachments {
  constructor(
    readonly db: Database,
    readonly storage: Storage,
  ) {}
  /** Internal publication of bytes staged by an authorized clone; not an upload endpoint. */
  async publishPrepared(
    actor: Actor,
    pageId: string,
    input: { id: string; filename: string; mediaType: string; size: number },
  ) {
    const attachment = await this.begin(actor, pageId, input, input.id);
    await new Access(this.db).lockPage(actor, pageId);
    await this.db.query("UPDATE attachments SET status='ready' WHERE id=$1 AND page_id=$2", [
      attachment.id,
      pageId,
    ]);
    return attachment;
  }
  async begin(
    actor: Actor,
    pageId: string,
    input: { filename: string; mediaType: string; size: number },
    internalId?: string,
  ): Promise<Attachment> {
    const page = await new Access(this.db).requirePage(actor, pageId, 'write');
    if (!Number.isSafeInteger(input.size) || input.size < 0)
      throw new DomainError('INVALID', 'Invalid file size.');
    if (input.size > MAX_FILE_BYTES)
      throw new DomainError('LIMIT', 'Files must be 25 MiB or smaller.');
    const filename =
      input.filename.replace(/[\\/\u0000-\u001f\u007f]/g, '_').slice(0, 200) || 'Attachment';
    const mediaType = /^[\w.+-]+\/[\w.+-]+$/.test(input.mediaType)
      ? input.mediaType.toLowerCase()
      : 'application/octet-stream';
    return this.db.transaction(async (tx) => {
      await new Access(tx).lockPage(actor, pageId);
      await tx.query('SELECT id FROM organization WHERE id=$1 FOR UPDATE', [page.workspaceId]);
      if (internalId) {
        const [existing] = await tx.query<Row>(
          'SELECT * FROM attachments WHERE id=$1 AND page_id=$2',
          [internalId, pageId],
        );
        if (existing) return map(existing);
      }
      if (input.size > (await availableStorage(tx, page.workspaceId)))
        throw new DomainError('LIMIT', 'This workspace has reached its storage allowance.');
      const id = internalId ?? randomUUID();
      const [row] = await tx.query<Row>(
        'INSERT INTO attachments (id,page_id,filename,media_type,size,object_key) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [id, pageId, filename, mediaType, input.size, `${page.workspaceId}/${id}`],
      );
      return map(row);
    });
  }
  private async get(actor: Actor, id: string, mode: 'read' | 'write') {
    const [row] = await this.db.query<Row>('SELECT * FROM attachments WHERE id=$1', [id]);
    if (!row) throw new DomainError('NOT_FOUND', 'Attachment not found.');
    await new Access(this.db).requirePage(actor, row.page_id, mode);
    return row;
  }
  async upload(actor: Actor, id: string, bytes: Buffer): Promise<Attachment> {
    const row = await this.get(actor, id, 'write');
    if (row.status === 'ready') return map(row);
    if (bytes.length !== row.size || bytes.length > MAX_FILE_BYTES)
      throw new DomainError(
        'INVALID',
        'The uploaded byte count does not match the file. Retry the upload.',
      );
    await this.storage.write(row.object_key, bytes);
    const mediaType =
      /^(image|video|audio)\//.test(row.media_type) && !safeInline(row.media_type, bytes)
        ? 'application/octet-stream'
        : row.media_type;
    const ready = await this.db.transaction(async (tx) => {
      await new Access(tx).lockPage(actor, row.page_id);
      const [updated] = await tx.query<Row>(
        "UPDATE attachments SET status='ready',media_type=$2 WHERE id=$1 RETURNING *",
        [id, mediaType],
      );
      return updated;
    });
    return map(ready);
  }
  async read(actor: Actor, id: string): Promise<Attachment & { bytes: Buffer; inline: boolean }> {
    const row = await this.get(actor, id, 'read');
    if (row.status !== 'ready')
      throw new DomainError('CONFLICT', 'This attachment is still uploading.');
    const bytes = await this.storage.read(row.object_key);
    return { ...map(row), bytes, inline: safeInline(row.media_type, bytes) };
  }
}
