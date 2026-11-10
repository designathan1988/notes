import { VISUAL_FILE, newVisualDocument, renderVisual, type VisualDocument } from './visual.js';
import { Node, type JSONContent } from '@tiptap/core';

/** A source file is text in the existing collaborative body, never a second document. */
export const webFile = Node.create({
  name: 'webFile',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  isolating: true,
  addAttributes: () => ({ path: { default: 'index.html' }, id: { default: null } }),
  parseHTML: () => [{ tag: 'pre[data-web-file]', preserveWhitespace: 'full' as const }],
  renderHTML: ({ node }) => [
    'pre',
    { 'data-web-file': node.attrs.path, class: 'web-source-file' },
    ['code', 0],
  ],
});
const attributes = () => ({ version: { default: 1 }, entry: { default: 'index.html' } });
export const webPage = Node.create({
  name: 'webPage',
  content: '(webFile | webAsset)+',
  isolating: true,
  defining: true,
  addAttributes: attributes,
  parseHTML: () => [{ tag: 'section[data-web-page]' }],
  renderHTML: ({ node }) => [
    'section',
    {
      'data-web-page': node.attrs.version,
      'data-entry': node.attrs.entry,
      class: 'web-source-document',
    },
    0,
  ],
});
export const webComponent = Node.create({
  name: 'webComponent',
  group: 'block',
  content: '(webFile | webAsset)+',
  isolating: true,
  defining: true,
  addAttributes: () => ({ ...attributes(), height: { default: 420 } }),
  parseHTML: () => [{ tag: 'section[data-web-component]' }],
  renderHTML: ({ node }) => [
    'section',
    {
      'data-web-component': node.attrs.version,
      'data-entry': node.attrs.entry,
      class: 'web-source-document',
    },
    0,
  ],
});
export const webAsset = Node.create({
  name: 'webAsset',
  atom: true,
  selectable: false,
  addAttributes: () => ({ id: { default: '' }, attachmentId: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-web-asset]' }],
  renderHTML: ({ node }) => [
    'span',
    { 'data-web-asset': node.attrs.id, hidden: '', class: 'web-asset-binding' },
  ],
});
export const webExtensions = () => [webPage, webComponent, webFile, webAsset];
export interface WebSource {
  entry: string;
  files: { path: string; text: string }[];
  assets: Record<string, string>;
}
export async function sourceFingerprint(source: WebSource) {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(source)),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function isWebPage(content: JSONContent): boolean {
  return (
    content.type === 'doc' && content.content?.length === 1 && content.content[0].type === 'webPage'
  );
}
export function validWebPath(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    path.length > 0 &&
    path.length <= 240 &&
    !/[\\:#?\x00-\x1f\x7f]/u.test(path) &&
    path.split('/').every((part) => !!part && part !== '.' && part !== '..')
  );
}
export function webSource(node: JSONContent): WebSource {
  if (!['webPage', 'webComponent'].includes(node.type ?? ''))
    throw new Error('Choose a web page or component.');
  return {
    entry: String(node.attrs?.entry ?? 'index.html'),
    assets: Object.fromEntries(
      (node.content ?? [])
        .filter((child) => child.type === 'webAsset')
        .map((asset) => [String(asset.attrs?.id), String(asset.attrs?.attachmentId)]),
    ),
    files: (node.content ?? [])
      .filter((child) => child.type === 'webFile')
      .map((file) => ({
        path: String(file.attrs?.path ?? 'index.html'),
        text: (file.content ?? []).map((text) => text.text ?? '').join(''),
      })),
  };
}
export function validateWeb(content: JSONContent) {
  let bytes = 0,
    count = 0;
  const visit = (node: JSONContent, parent?: JSONContent) => {
    if (node.type === 'webPage' && (parent?.type !== 'doc' || parent.content?.length !== 1))
      throw new Error('A full website occupies the page body. Use a web component inside a note.');
    if (node.type === 'webPage' || node.type === 'webComponent') {
      if (node.attrs?.version !== 1) throw new Error('Unsupported web source version.');
      const source = webSource(node),
        paths = new Set<string>(),
        ids = new Set<string>();
      const fileNodes = (node.content ?? []).filter((child) => child.type === 'webFile');
      const assetIds = new Set<string>();
      for (const asset of (node.content ?? []).filter((child) => child.type === 'webAsset')) {
        for (const id of [asset.attrs?.id, asset.attrs?.attachmentId])
          if (
            typeof id !== 'string' ||
            !/^[\w-]{1,128}$/.test(id) ||
            ['__proto__', 'constructor', 'prototype'].includes(id)
          )
            throw new Error('Use valid managed asset identities.');
        if (assetIds.has(asset.attrs!.id)) throw new Error('Use unique managed asset references.');
        assetIds.add(asset.attrs!.id);
      }
      if (assetIds.size > 256)
        throw new Error('Use up to 256 managed asset references per website.');
      for (const [index, file] of source.files.entries()) {
        const id = fileNodes[index].attrs?.id;
        if (id !== undefined && id !== null) {
          if (typeof id !== 'string' || !/^[\w-]{1,128}$/.test(id) || ids.has(id))
            throw new Error('Use a unique identity for each website file.');
          ids.add(id);
        }
        if (!validWebPath(file.path) || paths.has(file.path))
          throw new Error('Use unique relative file paths without traversal.');
        paths.add(file.path);
        bytes += new TextEncoder().encode(file.text).byteLength;
        count++;
      }
      if (!validWebPath(source.entry) || !paths.has(source.entry))
        throw new Error('Choose an existing HTML entry file.');
      if (
        node.type === 'webComponent' &&
        (typeof node.attrs?.height !== 'number' ||
          !Number.isFinite(node.attrs.height) ||
          node.attrs.height < 80 ||
          node.attrs.height > 4096)
      )
        throw new Error('Use a component height between 80 and 4,096 pixels.');
    }
    for (const child of node.content ?? []) visit(child, node);
  };
  visit(content);
  if (count > 128 || bytes > 2 * 1024 * 1024)
    throw new Error('Use up to 128 source files and 2 MiB of source text per document.');
}
export function newWebContent(
  component = false,
  visual: VisualDocument = newVisualDocument(),
): JSONContent {
  const source = (path: string, text: string): JSONContent => ({
    type: 'webFile',
    attrs: { path, id: crypto.randomUUID() },
    content: text ? [{ type: 'text', text }] : [],
  });
  const root: JSONContent = {
    type: component ? 'webComponent' : 'webPage',
    attrs: { version: 1, entry: 'index.html', ...(component ? { height: 420 } : {}) },
    content: [
      source(
        'index.html',
        '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <link rel="stylesheet" href="./styles.css">\n  <script type="module" src="./main.js"></script>\n</head>\n<body>\n  <main></main>\n</body>\n</html>\n',
      ),
      source('styles.css', ''),
      source('main.js', ''),
    ],
  };
  if (component) return root;
  // A new Document opens in the visual editor: its model, and the page generated from it.
  const { html, css } = renderVisual(visual);
  root.content = [
    source('index.html', html),
    source('styles.css', css),
    source('main.js', ''),
    source(VISUAL_FILE, JSON.stringify(visual)),
  ];
  return { type: 'doc', content: [root] };
}
