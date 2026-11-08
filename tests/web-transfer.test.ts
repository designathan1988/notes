import { afterAll, beforeAll, expect, test } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { fixture, rawPage } from './helpers.js';
import type { Database } from '../apps/server/src/platform/database.js';
import type { Storage } from '../apps/server/src/attachments/storage.js';
import { Attachments } from '../apps/server/src/attachments/service.js';
import { Documents } from '../apps/server/src/documents/service.js';
import { documentFromJSON, documentJSON } from '../packages/editor/src/schema.js';
import { exportWebsite } from '../apps/server/src/transfer/website.js';
import { Transfer } from '../apps/server/src/transfer/service.js';
import { Access } from '../apps/server/src/access/service.js';

let db: Database;
const bytes = new Map<string, Buffer>();
const storage: Storage = {
  read: async (key) => Buffer.from(bytes.get(key)!),
  write: async (key, value) => {
    bytes.set(key, Buffer.from(value));
  },
  remove: async (key) => {
    bytes.delete(key);
  },
};
const actor = { userId: 'owner' };
beforeAll(async () => {
  db = await fixture();
});
afterAll(async () => {
  await db.close();
});
const html =
  '<!doctype html>\n<h1>日本語 🌌</h1>\n<img src="../.note/assets/picture">\n<script type="module" src="../main.js"></script>\n';
const script = 'const literal = "</script>";\nexport const greeting = "exact whitespace  ";\n';
async function website() {
  const pageId = await rawPage(db, { title: 'Portable authored website' });
  const attachments = new Attachments(db, storage),
    png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    );
  const image = await attachments.begin(actor, pageId, {
    filename: 'Own picture.png',
    mediaType: 'image/png',
    size: png.length,
  });
  await attachments.upload(actor, image.id, png);
  const content = {
    type: 'doc',
    content: [
      {
        type: 'webPage',
        attrs: { version: 1, entry: 'site/index.html' },
        content: [
          {
            type: 'webFile',
            attrs: { path: 'site/index.html' },
            content: [{ type: 'text', text: html }],
          },
          {
            type: 'webFile',
            attrs: { path: 'main.js' },
            content: [{ type: 'text', text: script }],
          },
          { type: 'webAsset', attrs: { id: 'picture', attachmentId: image.id } },
        ],
      },
    ],
  };
  const document = documentFromJSON(content);
  try {
    await new Documents(db).importContent(actor, pageId, document, 1);
  } finally {
    document.destroy();
  }
  return { pageId, image, png };
}

test('portable website archives preserve exact files, nested entry paths and logical owned media without preview URLs', async () => {
  const { pageId, png } = await website();
  const files = unzipSync(await exportWebsite(db, storage, { userId: 'viewer' }, pageId, 0));
  expect(strFromU8(files['site/index.html'])).toBe(html);
  expect(strFromU8(files['main.js'])).toBe(script);
  expect(Buffer.from(files['.note/assets/picture'])).toEqual(png);
  expect(JSON.parse(strFromU8(files['.note/website.json']))).toMatchObject({
    entry: 'site/index.html',
    schemaVersion: 1,
  });
  expect(Object.keys(files).some((path) => path.includes('preview-'))).toBe(false);
  await expect(exportWebsite(db, storage, { userId: 'outsider' }, pageId, 0)).rejects.toMatchObject(
    { code: 'FORBIDDEN' },
  );
});

test('a website cannot export another page attachment through a fabricated logical binding', async () => {
  const { image } = await website(),
    pageId = await rawPage(db, { title: 'Fabricated binding' });
  const document = documentFromJSON({
    type: 'doc',
    content: [
      {
        type: 'webPage',
        attrs: { version: 1, entry: 'index.html' },
        content: [
          {
            type: 'webFile',
            attrs: { path: 'index.html' },
            content: [{ type: 'text', text: '<img src=".note/assets/stolen">' }],
          },
          { type: 'webAsset', attrs: { id: 'stolen', attachmentId: image.id } },
        ],
      },
    ],
  });
  try {
    await new Documents(db).importContent(actor, pageId, document, 1);
  } finally {
    document.destroy();
  }
  await expect(exportWebsite(db, storage, actor, pageId, 0)).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('native workspace transfer remaps website attachment ownership while preserving source bytes and logical paths', async () => {
  const { image } = await website(),
    transfer = new Transfer(db, storage),
    archive = await transfer.exportWorkspace(actor, 'studio');
  const workspace = await new Access(db).createWorkspace(actor, 'Website round trip');
  let report = await transfer.beginImport(actor, workspace.id, archive);
  while (!report.complete) report = await transfer.advance(actor, report.jobId);
  const [restored] = await db.query<{ id: string }>(
    'SELECT id FROM pages WHERE workspace_id=$1 AND title=$2',
    [workspace.id, 'Portable authored website'],
  );
  const document = await new Documents(db).load(restored.id);
  try {
    const root = documentJSON(document).content![0],
      asset = root.content!.find((node) => node.type === 'webAsset')!;
    expect(
      root.content!.find((node) => node.attrs?.path === 'site/index.html')!.content![0].text,
    ).toBe(html);
    expect(asset.attrs?.id).toBe('picture');
    expect(asset.attrs?.attachmentId).not.toBe(image.id);
    expect((await new Attachments(db, storage).read(actor, asset.attrs!.attachmentId)).pageId).toBe(
      restored.id,
    );
    expect(
      unzipSync(await exportWebsite(db, storage, actor, restored.id, 0))['.note/assets/picture'],
    ).toBeDefined();
  } finally {
    document.destroy();
  }
});
