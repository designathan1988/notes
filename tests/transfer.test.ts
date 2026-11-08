import { afterAll, beforeAll, expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import * as Y from 'yjs';
import type { Database } from '../apps/server/src/platform/database.js';
import { fixture, rawPage } from './helpers.js';
import { Transfer } from '../apps/server/src/transfer/service.js';
import { FileStorage } from '../apps/server/src/attachments/storage.js';
import { Attachments } from '../apps/server/src/attachments/service.js';
import { Access } from '../apps/server/src/access/service.js';
import { Documents } from '../apps/server/src/documents/service.js';
import { documentFromJSON, documentJSON } from '../packages/editor/src/schema.js';
import { Invitations } from '../apps/server/src/access/invitations.js';
import { FileMail } from '../apps/server/src/identity/mail.js';
import { Pages } from '../apps/server/src/pages/service.js';
let db: Database;
let directory: string;
let transfer: Transfer;
let storage: FileStorage;
const actor = { userId: 'owner' };
beforeAll(async () => {
  db = await fixture();
  directory = await mkdtemp(join(tmpdir(), 'note-transfer-'));
  storage = new FileStorage(directory);
  transfer = new Transfer(db, storage);
});
afterAll(async () => {
  await db.close();
  await rm(directory, { recursive: true, force: true });
});
test('workspace archive round trip remaps pages and retains attachment bytes and internal links', async () => {
  const target = await rawPage(db, { title: 'Link target' });
  const source = await rawPage(db, { title: 'Original note' });
  const attachments = new Attachments(db, storage);
  const file = await attachments.begin(actor, source, {
    filename: 'proof.txt',
    mediaType: 'text/plain',
    size: 6,
  });
  await attachments.upload(actor, file.id, Buffer.from('proof!'));
  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  );
  const cover = await attachments.begin(actor, source, {
    filename: 'cover.png',
    mediaType: 'image/png',
    size: image.length,
  });
  await attachments.upload(actor, cover.id, image);
  await new Pages(db).update(actor, source, {
    revision: 1,
    icon: '🧭',
    tags: ['Field research'],
    cover: { type: 'image', attachmentId: cover.id, positionY: 38 },
  });
  const doc = documentFromJSON({
    type: 'doc',
    content: [
      { type: 'pageLink', attrs: { targetId: target, label: 'Link target' } },
      {
        type: 'attachment',
        attrs: { id: file.id, filename: 'proof.txt', mediaType: 'text/plain' },
      },
    ],
  });
  await new Documents(db).save(actor, source, Y.encodeStateAsUpdate(doc), 1);
  doc.destroy();
  const archive = await transfer.exportWorkspace(actor, 'studio');
  const destination = await new Access(db).createWorkspace(actor, 'Restored workspace');
  let report = await transfer.beginImport(actor, destination.id, archive);
  for (let i = 0; i < 100 && !report.complete; i++)
    report = await transfer.advance(actor, report.jobId);
  expect(report.complete).toBe(true);
  const pages = await new Access(db).visiblePages(actor, destination.id);
  const restored = pages.find((page) => page.title === 'Original note')!;
  const linked = pages.find((page) => page.title === 'Link target')!;
  expect(restored.id).not.toBe(source);
  expect(restored).toMatchObject({
    icon: '🧭',
    tags: ['field research'],
    cover: { type: 'image', positionY: 38 },
  });
  expect(restored.cover?.type).toBe('image');
  if (restored.cover?.type !== 'image') throw new Error('The image cover was lost');
  expect(restored.cover.attachmentId).not.toBe(cover.id);
  expect((await attachments.read(actor, restored.cover.attachmentId)).bytes).toEqual(image);
  const loaded = await new Documents(db).load(restored.id);
  const content = documentJSON(loaded);
  loaded.destroy();
  expect(content.content?.find((node) => node.type === 'pageLink')?.attrs?.targetId).toBe(
    linked.id,
  );
  const attachmentId = content.content?.find((node) => node.type === 'attachment')?.attrs?.id;
  expect(attachmentId).not.toBe(file.id);
  expect((await attachments.read(actor, attachmentId)).bytes.toString()).toBe('proof!');
  expect((await new Access(db).requirePage(actor, source, 'read')).workspaceId).toBe('studio');
});
test('invalid archive versions and unauthorized exports fail before importing data', async () => {
  await expect(transfer.exportWorkspace({ userId: 'outsider' }, 'studio')).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  await expect(
    transfer.beginImport(actor, 'studio', new Uint8Array([1, 2, 3])),
  ).rejects.toMatchObject({ code: 'INVALID' });
  await expect(
    transfer.beginImport(
      actor,
      'studio',
      zipSync({ 'manifest.json': strToU8(JSON.stringify({ schemaVersion: 999, pages: [] })) }),
    ),
  ).rejects.toMatchObject({ code: 'INVALID' });
});
test('invitations are recipient-bound, expiring, and single-use without ownership escalation', async () => {
  await db.query(
    "INSERT INTO \"user\" (id,name,email,email_verified) VALUES ('invitee','Invitee','invitee@note.test',true)",
  );
  const invitations = new Invitations(db, new FileMail(join(directory, 'mail')));
  const first = await invitations.create(actor, 'studio', 'invitee@note.test', 'viewer');
  await expect(invitations.accept({ userId: 'outsider' }, first.id)).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  await db.query("UPDATE invitation SET expires_at=now()-interval '1 day' WHERE id=$1", [first.id]);
  await expect(invitations.accept({ userId: 'invitee' }, first.id)).rejects.toMatchObject({
    code: 'CONFLICT',
  });
  const valid = await invitations.create(actor, 'studio', 'invitee@note.test', 'viewer');
  await invitations.accept({ userId: 'invitee' }, valid.id);
  expect(await new Access(db).requireWorkspace({ userId: 'invitee' }, 'studio')).toBe('viewer');
  await expect(invitations.accept({ userId: 'invitee' }, valid.id)).rejects.toMatchObject({
    code: 'CONFLICT',
  });
  await expect(
    invitations.create({ userId: 'admin' }, 'studio', 'another@note.test', 'owner'),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
test.each([
  { count: 5, bytes: 1800000 },
  { count: 1, bytes: 3400000 },
])(
  'own exports restore valid large documents ($count × $bytes bytes)',
  async ({ count, bytes }) => {
    const access = new Access(db);
    const source = await access.createWorkspace(actor, 'Large document backup');
    for (let index = 0; index < count; index++) {
      const page = await new Pages(db).create(actor, source.id, { title: `Large ${index}` });
      const doc = documentFromJSON({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a'.repeat(bytes) }] }],
      });
      await new Documents(db).importContent(actor, page.id, doc, 1);
      doc.destroy();
    }
    const archive = await transfer.exportWorkspace(actor, source.id);
    const destination = await access.createWorkspace(actor, 'Large backup restore');
    let report = await transfer.beginImport(actor, destination.id, archive);
    while (!report.complete) report = await transfer.advance(actor, report.jobId);
    const restored = await new Pages(db).list(actor, destination.id);
    expect(restored).toHaveLength(count);
    const doc = await new Documents(db).load(restored[0].id);
    expect(documentJSON(doc).content?.[0].content?.[0].text?.length).toBe(bytes);
    doc.destroy();
  },
);
