import { expect, test } from 'vitest';
import { documentFromJSON, documentJSON, validateDocument } from '../packages/editor/src/schema.js';
import type { JSONContent } from '@tiptap/core';
import { rewriteContent } from '../apps/server/src/transfer/archive.js';
import { webSource } from '../packages/editor/src/web.js';

const file = (path: string, text = ''): JSONContent => ({
  type: 'webFile',
  attrs: { path },
  ...(text ? { content: [{ type: 'text', text }] } : {}),
});
const site = (
  files = [
    file('index.html', '<!doctype html><h1>A personal website</h1>'),
    file('styles.css'),
    file('main.js'),
  ],
): JSONContent => ({ type: 'webPage', attrs: { version: 1, entry: 'index.html' }, content: files });
const document = (content: JSONContent): JSONContent => ({ type: 'doc', content: [content] });

test('a complete web page and extra relative module files have one exact canonical Yjs round trip', () => {
  const html =
    '<!doctype html>\n<html><body>日本語 🌌 <button>Explore</button><script type="module" src="main.js"></script></body></html>\n';
  const css = ':root { --color: oklch(60% 0.1 200); }\nbody::after { content: "</style>"; }\n';
  const js = 'import { greeting } from "./lib/helpers.js";\nconst literal = "</script>";\n';
  const content = document(
    site([
      file('index.html', html),
      file('styles.css', css),
      file('main.js', js),
      file('lib/helpers.js', 'export const greeting = "Hello";\n'),
      file('data.json', '{"title":"A site"}\n'),
    ]),
  );
  const doc = documentFromJSON(content, 'document');
  try {
    const restored = documentJSON(doc);
    expect(restored.content![0].type).toBe('webPage');
    expect(restored.content![0].content!.map((node) => node.content?.[0]?.text ?? '')).toEqual([
      html,
      css,
      js,
      'export const greeting = "Hello";\n',
      '{"title":"A site"}\n',
    ]);
    expect(restored.content![0].content!.map((node) => node.attrs!.path)).toEqual([
      'index.html',
      'styles.css',
      'main.js',
      'lib/helpers.js',
      'data.json',
    ]);
  } finally {
    doc.destroy();
  }
});
test('a web component can coexist with ordinary blocks without converting their content', () => {
  const content: JSONContent = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'The original note.' }] },
      { ...site(), type: 'webComponent', attrs: { version: 1, entry: 'index.html', height: 420 } },
      { type: 'paragraph' },
    ],
  };
  expect(() => validateDocument(content, 'document')).not.toThrow();
  expect(() => validateDocument(content, 'canvas')).toThrow();
  expect(() =>
    validateDocument({ type: 'doc', content: [site(), { type: 'paragraph' }] }),
  ).toThrow();
});
test('web ingress rejects traversal, duplicate paths, missing entry files and unsupported versions', () => {
  for (const path of [
    '../index.html',
    '/index.html',
    'lib/../index.html',
    'lib\\main.js',
    'https://example.com/main.js',
    'data\u0000.json',
    'empty//name.js',
  ]) {
    expect(() => validateDocument(document(site([file('index.html'), file(path)])))).toThrow();
  }
  expect(() =>
    validateDocument(document(site([file('index.html'), file('index.html')]))),
  ).toThrow();
  expect(() => validateDocument(document(site([file('other.html')])))).toThrow();
  expect(() =>
    validateDocument(document({ ...site(), attrs: { version: 999, entry: 'index.html' } })),
  ).toThrow();
  expect(() =>
    validateDocument(document({ ...site(), content: [file('index.html'), { type: 'paragraph' }] })),
  ).toThrow();
});

test('managed asset bindings remap independently while website source remains byte-exact', () => {
  const html =
    '<img src=".note/assets/picture-one"><script>const url = ".note/assets/picture-one";</script>';
  const content = document(
    site([
      file('index.html', html),
      { type: 'webAsset', attrs: { id: 'picture-one', attachmentId: 'original-asset' } },
    ]),
  );
  expect(() => validateDocument(content)).not.toThrow();
  const copied = rewriteContent(content, {}, { 'original-asset': 'copied-asset' });
  expect(webSource(copied.content![0])).toMatchObject({
    files: [{ path: 'index.html', text: html }],
    assets: { 'picture-one': 'copied-asset' },
  });
  expect(copied.content![0].content![0].content![0].text).toBe(html);
});
