import { afterAll, beforeAll, expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fixture, rawPage } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import { Attachments } from '../apps/server/src/attachments/service.js';
import { FileStorage } from '../apps/server/src/attachments/storage.js';
import { classifyPaste } from '../apps/web/src/documents/paste-policy.js';
import { safeEmbedSource } from '@note/editor/embeds';
let db: Database;
let path: string;
let attachments: Attachments;
let page: string;
beforeAll(async () => {
  db = await fixture();
  page = await rawPage(db);
  path = await mkdtemp(join(tmpdir(), 'note-files-'));
  attachments = new Attachments(db, new FileStorage(path));
});
afterAll(async () => {
  await db.close();
  await rm(path, { recursive: true, force: true });
});
test('rejects excessive uploads and storage path traversal', async () => {
  await expect(
    attachments.begin({ userId: 'owner' }, page, {
      filename: 'big.bin',
      mediaType: 'application/octet-stream',
      size: 25 * 1024 * 1024 + 1,
    }),
  ).rejects.toMatchObject({ code: 'LIMIT' });
  await expect(new FileStorage(path).read('../private')).rejects.toThrow();
});
test('pending bytes cannot be read, and only authorized users can finalize or read', async () => {
  const file = await attachments.begin({ userId: 'owner' }, page, {
    filename: 'notes.txt',
    mediaType: 'text/plain',
    size: 5,
  });
  await expect(attachments.read({ userId: 'owner' }, file.id)).rejects.toMatchObject({
    code: 'CONFLICT',
  });
  await expect(
    attachments.upload({ userId: 'outsider' }, file.id, Buffer.from('hello')),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await expect(
    attachments.upload({ userId: 'owner' }, file.id, Buffer.from('bad')),
  ).rejects.toMatchObject({ code: 'INVALID' });
  await attachments.upload({ userId: 'owner' }, file.id, Buffer.from('hello'));
  expect((await attachments.read({ userId: 'owner' }, file.id)).bytes.toString()).toBe('hello');
  await expect(attachments.read({ userId: 'outsider' }, file.id)).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
});
test('HTML originals download as files and never as active application content', async () => {
  const bytes = Buffer.from('<script>alert(1)</script><button>Keep me</button>');
  const file = await attachments.begin({ userId: 'owner' }, page, {
    filename: 'original.html',
    mediaType: 'text/html',
    size: bytes.length,
  });
  await attachments.upload({ userId: 'owner' }, file.id, bytes);
  const result = await attachments.read({ userId: 'owner' }, file.id);
  expect(result.inline).toBe(false);
  expect(result.bytes.equals(bytes)).toBe(true);
});
test('paste policy identifies JSON, Markdown, code mode, and unsupported rich originals', () => {
  expect(classifyPaste({ text: '{"a":1}' }).mode).toBe('code');
  expect(classifyPaste({ text: '# A heading\n\n- A point' }).mode).toBe('markdown');
  expect(classifyPaste({ text: '<tag>', mode: 'code' }).mode).toBe('code');
  expect(classifyPaste({ html: '<p>Hello</p><canvas>Original</canvas>' }).preserveOriginal).toBe(
    true,
  );
});
test('controlled embeds reject executable and unapproved origins', () => {
  expect(safeEmbedSource('javascript:alert(1)')).toBe(null);
  expect(safeEmbedSource('https://evil.test/embed/123')).toBe(null);
  expect(safeEmbedSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  );
});
