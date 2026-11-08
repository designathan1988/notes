import { afterAll, beforeAll, expect, test } from 'vitest';
import * as Y from 'yjs';
import { fixture, rawPage } from './helpers.js';
import { migrate, type Database } from '../apps/server/src/platform/database.js';
import { Pages } from '../apps/server/src/pages/service.js';
import { PageInstances } from '../apps/server/src/pages/instantiation.js';
import { Documents } from '../apps/server/src/documents/service.js';
import { documentFromJSON, documentJSON, emptyDocument } from '../packages/editor/src/schema.js';
import { emptyCanvas } from '../packages/editor/src/canvas.js';
import type { JSONContent } from '@tiptap/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStorage } from '../apps/server/src/attachments/storage.js';
import { Attachments } from '../apps/server/src/attachments/service.js';
import { Transfer } from '../apps/server/src/transfer/service.js';
import { Access } from '../apps/server/src/access/service.js';
import { History } from '../apps/server/src/history/service.js';

let db: Database;
let directory: string, storage: FileStorage;
const actor = { userId: 'owner' };
beforeAll(async () => {
  db = await fixture();
  directory = await mkdtemp(join(tmpdir(), 'note-canvas-'));
  storage = new FileStorage(directory);
});
afterAll(async () => {
  await db.close();
  await rm(directory, { recursive: true, force: true });
});
const content = (): JSONContent => ({
  type: 'doc',
  content: [
    {
      type: 'canvasRoot',
      content: [
        {
          type: 'canvasCard',
          attrs: { id: 'card' },
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Durable canvas evidence' }] },
          ],
        },
      ],
    },
  ],
});

async function populatedCanvas() {
  const pages = new Pages(db),
    source = await pages.create(actor, 'studio', {
      title: `Canvas package ${crypto.randomUUID()}`,
      kind: 'canvas',
    });
  const child = await pages.create(actor, 'studio', {
    title: 'Owned evidence note',
    parentId: source.id,
  });
  const relation = { id: 'related', name: 'Related note', type: 'relation' as const };
  const defined = await pages.update(actor, source.id, {
    revision: source.revision,
    fields: [relation],
  });
  await pages.update(actor, source.id, {
    revision: defined.revision,
    property: { id: relation.id, value: child.id, expectedValue: null, expectedField: relation },
  });
  const attachments = new Attachments(db, storage),
    bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    );
  const image = await attachments.begin(actor, source.id, {
    filename: 'diagram.png',
    mediaType: 'image/png',
    size: bytes.length,
  });
  await attachments.upload(actor, image.id, bytes);
  const body = content();
  body.content![0].content![0].content!.push(
    { type: 'pageLink', attrs: { targetId: child.id, label: 'Linked page' } },
    {
      type: 'attachment',
      attrs: {
        id: image.id,
        filename: 'diagram.png',
        mediaType: 'image/png',
        caption: 'Visual source',
      },
    },
  );
  const doc = documentFromJSON(body);
  try {
    await new Documents(db).importContent(actor, source.id, doc, 1);
  } finally {
    doc.destroy();
  }
  return { source, child, image, bytes };
}

test('canvas duplication owns its rich document/media and remaps references without copying a second body', async () => {
  const { source, child, image, bytes } = await populatedCanvas();
  const copy = await new PageInstances(db).copyFrom(
    actor,
    'studio',
    source.id,
    { mode: 'duplicate', requestId: crypto.randomUUID(), expectedUserId: 'owner' },
    storage,
  );
  expect(copy.kind).toBe('canvas');
  expect(copy.id).not.toBe(source.id);
  const pages = await new Pages(db).list(actor, 'studio'),
    copiedChild = pages.find((page) => page.parentId === copy.id)!;
  expect(copiedChild.id).not.toBe(child.id);
  expect(copy.properties?.values.related).toBe(copiedChild.id);
  const doc = await new Documents(db).load(copy.id);
  try {
    const card = documentJSON(doc).content![0].content![0];
    expect(card.content!.find((node) => node.type === 'pageLink')!.attrs!.targetId).toBe(
      copiedChild.id,
    );
    const assetId = card.content!.find((node) => node.type === 'attachment')!.attrs!.id;
    expect(assetId).not.toBe(image.id);
    expect((await new Attachments(db, storage).read(actor, assetId)).bytes).toEqual(bytes);
  } finally {
    doc.destroy();
  }
});

test('canvas properties use the existing page metadata owner and stay out of the spatial body', async () => {
  const pages = new Pages(db),
    source = await pages.create(actor, 'studio', { title: 'Canvas properties', kind: 'canvas' });
  const field = { id: 'confidence', name: 'Confidence', type: 'number' as const };
  const defined = await pages.update(actor, source.id, {
    revision: source.revision,
    fields: [field],
  });
  const saved = await pages.update(actor, source.id, {
    revision: defined.revision,
    property: { id: field.id, value: 5, expectedValue: null, expectedField: field },
  });
  expect(saved.properties).toEqual({ fields: [field], values: { confidence: 5 } });
  const doc = await new Documents(db).load(source.id);
  try {
    expect(documentJSON(doc)).toEqual(emptyCanvas);
  } finally {
    doc.destroy();
  }
});

test('named canvas versions restore geometry and content through the existing generation boundary', async () => {
  const page = await new PageInstances(db).create(actor, 'studio', {
    title: 'Canvas history',
    kind: 'canvas',
    content: content(),
    requestId: 'canvas-history-command',
  });
  const history = new History(db),
    documents = new Documents(db),
    saved = await history.save(actor, page.id, 'Before moving');
  if (!saved.id) throw new Error('The named canvas checkpoint was not stored.');
  const doc = await documents.load(page.id);
  try {
    const card = (doc.getXmlFragment('default').get(0) as Y.XmlElement).get(0) as Y.XmlElement;
    card.setAttribute('x', 800 as unknown as string);
    await documents.save(actor, page.id, Y.encodeStateAsUpdate(doc), page.generation);
    const preview = await history.preview(actor, page.id, saved.id);
    expect(preview.content.content![0].content![0].attrs!.x).toBe(0);
    await history.restore(actor, page.id, saved.id, preview.version);
    const current = await new Pages(db).get(actor, page.id);
    expect(current.kind).toBe('canvas');
    expect(current.generation).toBe(page.generation + 1);
    const restored = await documents.load(page.id);
    try {
      expect(documentJSON(restored).content![0].content![0].attrs!.x).toBe(0);
    } finally {
      restored.destroy();
    }
    await expect(
      documents.save(actor, page.id, Y.encodeStateAsUpdate(doc), page.generation),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  } finally {
    doc.destroy();
  }
});

test('workspace ZIP keeps canvas kind, rich structure, remapped owned references and exact media bytes', async () => {
  const { source, image, bytes } = await populatedCanvas();
  const transfer = new Transfer(db, storage),
    archive = await transfer.exportWorkspace(actor, 'studio');
  const target = await new Access(db).createWorkspace(actor, 'Restored spatial workspace');
  let report = await transfer.beginImport(actor, target.id, archive);
  for (let i = 0; i < 100 && !report.complete; i++)
    report = await transfer.advance(actor, report.jobId);
  expect(report.complete).toBe(true);
  const pages = await new Pages(db).list(actor, target.id),
    restored = pages.find((page) => page.title === source.title)!;
  expect(restored.kind).toBe('canvas');
  expect(restored.properties?.values.related).toBe(
    pages.find((page) => page.parentId === restored.id)!.id,
  );
  const doc = await new Documents(db).load(restored.id);
  try {
    const card = documentJSON(doc).content![0].content![0],
      asset = card.content!.find((node) => node.type === 'attachment')!.attrs!.id;
    expect(card.type).toBe('canvasCard');
    expect(card.attrs!.id).toBe('card');
    expect(card.content!.find((node) => node.type === 'pageLink')!.attrs!.targetId).toBe(
      pages.find((page) => page.parentId === restored.id)!.id,
    );
    expect(asset).not.toBe(image.id);
    expect((await new Attachments(db, storage).read(actor, asset)).bytes).toEqual(bytes);
  } finally {
    doc.destroy();
  }
});

test('the existing page-kind migration admits canvas pages without losing original pages and is repeatable', async () => {
  const legacy = await fixture();
  try {
    const original = await rawPage(legacy, { title: 'Original note' });
    await legacy.exec(
      "ALTER TABLE pages DROP CONSTRAINT pages_kind_check; ALTER TABLE pages ADD CONSTRAINT pages_kind_check CHECK(kind IN ('document','database','record'))",
    );
    await migrate(legacy);
    await migrate(legacy);
    const canvas = await new Pages(legacy).create(actor, 'studio', {
      title: 'Spatial workspace',
      kind: 'canvas',
    });
    expect(canvas.kind).toBe('canvas');
    expect((await new Pages(legacy).get(actor, original)).title).toBe('Original note');
    const doc = await new Documents(legacy).load(canvas.id);
    try {
      expect(documentJSON(doc)).toEqual(emptyCanvas);
    } finally {
      doc.destroy();
    }
  } finally {
    await legacy.close();
  }
});

test('canonical content creation and retained recovery keep the canvas kind and independent durable rich state', async () => {
  const instances = new PageInstances(db),
    documents = new Documents(db);
  const input = {
    title: 'Canvas source',
    kind: 'canvas',
    content: content(),
    purpose: 'copy',
    requestId: 'canvas-creation-command',
  };
  const first = await instances.create(actor, 'studio', input),
    again = await instances.create(actor, 'studio', input);
  expect(first.kind).toBe('canvas');
  expect(again.id).toBe(first.id);
  const doc = await documents.load(first.id);
  try {
    expect(documentJSON(doc).content![0].content).toHaveLength(1);
    expect(documentJSON(doc).content![0].content![0].content![0].content![0].text).toBe(
      'Durable canvas evidence',
    );
    const recovered = await instances.create(actor, 'studio', {
      title: 'Recovered board',
      content: documentJSON(doc),
      purpose: 'recovery',
      expectedUserId: 'owner',
      requestId: 'canvas-recovery-command',
    });
    expect(recovered).toMatchObject({ kind: 'canvas', visibility: 'private', parentId: null });
    expect(recovered.id).not.toBe(first.id);
    const reopened = await documents.load(recovered.id);
    try {
      expect(documentJSON(reopened)).toEqual(documentJSON(doc));
    } finally {
      reopened.destroy();
    }
  } finally {
    doc.destroy();
  }
});

test('document persistence rejects content-kind changes and invalid canvas topology without changing the durable state', async () => {
  const pages = new Pages(db),
    documents = new Documents(db);
  const canvas = await pages.create(actor, 'studio', { title: 'Validated canvas', kind: 'canvas' });
  const ordinary = await pages.create(actor, 'studio', { title: 'Ordinary note' });
  const text = documentFromJSON(emptyDocument),
    board = documentFromJSON(content());
  try {
    await expect(documents.importContent(actor, ordinary.id, board, 1)).rejects.toMatchObject({
      code: 'INVALID',
    });
    await expect(documents.importContent(actor, canvas.id, text, 1)).rejects.toMatchObject({
      code: 'INVALID',
    });
    await documents.importContent(actor, canvas.id, board, 1);
    const current = await documents.load(canvas.id),
      before = documentJSON(current);
    try {
      const root = current.getXmlFragment('default').get(0) as Y.XmlElement;
      (root.get(0) as Y.XmlElement).setAttribute('width', -1 as unknown as string);
      await expect(
        documents.save(actor, canvas.id, Y.encodeStateAsUpdate(current), 1),
      ).rejects.toMatchObject({ code: 'INVALID' });
      const reopened = await documents.load(canvas.id);
      try {
        expect(documentJSON(reopened)).toEqual(before);
      } finally {
        reopened.destroy();
      }
    } finally {
      current.destroy();
    }
  } finally {
    text.destroy();
    board.destroy();
  }
});

test('canvas writes retain fresh viewer and membership-revocation checks', async () => {
  const page = await new PageInstances(db).create(actor, 'studio', {
    title: 'Shared canvas',
    kind: 'canvas',
    content: content(),
    requestId: 'canvas-acl-command',
  });
  const documents = new Documents(db),
    doc = await documents.load(page.id);
  try {
    const card = (doc.getXmlFragment('default').get(0) as Y.XmlElement).get(0) as Y.XmlElement;
    card.setAttribute('x', 500 as unknown as string);
    await expect(
      documents.save({ userId: 'viewer' }, page.id, Y.encodeStateAsUpdate(doc), 1),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await documents.save({ userId: 'editor' }, page.id, Y.encodeStateAsUpdate(doc), 1);
    await db.query("DELETE FROM member WHERE user_id='editor'");
    card.setAttribute('x', 900 as unknown as string);
    await expect(
      documents.save({ userId: 'editor' }, page.id, Y.encodeStateAsUpdate(doc), 1),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const reopened = await documents.load(page.id);
    try {
      expect(documentJSON(reopened).content![0].content![0].attrs!.x).toBe(500);
    } finally {
      reopened.destroy();
    }
  } finally {
    doc.destroy();
  }
});
