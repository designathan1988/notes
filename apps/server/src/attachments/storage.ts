import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
export interface Storage {
  write(key: string, bytes: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
function checkedKey(key: string) {
  if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(key)) throw new Error('Invalid storage key.');
  return key;
}
export class FileStorage implements Storage {
  constructor(readonly directory: string) {}
  private path(key: string) {
    return resolve(this.directory, checkedKey(key));
  }
  async write(key: string, bytes: Buffer): Promise<void> {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    const staging = `${path}.upload`;
    await writeFile(staging, bytes, { mode: 0o600 });
    await rename(staging, path);
  }
  async read(key: string): Promise<Buffer> {
    return readFile(this.path(key));
  }
  async remove(key: string): Promise<void> {
    try {
      await unlink(this.path(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
export class S3Storage implements Storage {
  readonly client: S3Client;
  constructor(
    readonly bucket: string,
    options: { region: string; endpoint?: string },
  ) {
    this.client = new S3Client({ ...options, forcePathStyle: !!options.endpoint });
  }
  async write(key: string, bytes: Buffer) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: checkedKey(key),
        Body: bytes,
        ContentType: 'application/octet-stream',
      }),
    );
  }
  async read(key: string) {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: checkedKey(key) }),
    );
    if (!result.Body) throw new Error('Attachment bytes are missing.');
    return Buffer.from(await result.Body.transformToByteArray());
  }
  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: checkedKey(key) }));
  }
}
export function storageFromEnvironment(): Storage {
  if (process.env.S3_BUCKET)
    return new S3Storage(process.env.S3_BUCKET, {
      region: process.env.S3_REGION ?? 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
    });
  if (process.env.NODE_ENV === 'production')
    throw new Error('S3_BUCKET and object-storage credentials are required in production.');
  return new FileStorage(resolve('.runtime/attachments'));
}
