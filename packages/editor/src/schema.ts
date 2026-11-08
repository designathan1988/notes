import { Node, getSchema, mergeAttributes, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from 'y-prosemirror';
import type * as Y from 'yjs';
import { safeEmbedSource } from './embeds.js';
import { toggleBlock, toggleTitle, toggleContent, highlight } from './structure.js';
import { canvasExtensions, isCanvas, validateCanvas } from './canvas.js';
import type { PageKind } from '../../contracts/src/index.js';
export const documentRoot = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+ | canvasRoot',
});

export const pageLink = Node.create({
  name: 'pageLink',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return { targetId: { default: '' }, label: { default: 'Linked page' } };
  },
  parseHTML() {
    return [{ tag: 'a[data-page-link]' }];
  },
  renderHTML({ node }) {
    return [
      'a',
      {
        'data-page-link': node.attrs.targetId,
        href: `#${encodeURIComponent(node.attrs.targetId)}/document`,
        class: 'page-link',
      },
      [
        'http://www.w3.org/2000/svg svg',
        {
          viewBox: '0 0 24 24',
          width: '17',
          height: '17',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '1.5',
        },
        [
          'path',
          {
            d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h6',
          },
        ],
      ],
      ['span', {}, node.attrs.label],
      [
        'http://www.w3.org/2000/svg svg',
        {
          viewBox: '0 0 24 24',
          width: '17',
          height: '17',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '1.5',
        },
        ['path', { d: 'M5 12h14M13 6l6 6-6 6' }],
      ],
    ];
  },
});
const wikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { targetId: { default: '' }, label: { default: 'Linked page' } };
  },
  parseHTML() {
    return [{ tag: 'a[data-wiki-link]' }];
  },
  renderHTML({ node }) {
    return [
      'a',
      {
        'data-wiki-link': node.attrs.targetId,
        href: `#${encodeURIComponent(node.attrs.targetId)}/document`,
        class: 'wiki-link',
      },
      node.attrs.label,
    ];
  },
});
const attachment = Node.create({
  name: 'attachment',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      id: { default: '', parseHTML: (element) => element.getAttribute('data-attachment') },
      filename: {
        default: 'Attachment',
        parseHTML: (element) => element.getAttribute('data-filename') ?? 'Attachment',
      },
      mediaType: {
        default: 'application/octet-stream',
        parseHTML: (element) =>
          element.getAttribute('data-media-type') ?? 'application/octet-stream',
      },
      caption: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'figure[data-attachment]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const url = `/api/attachments/${encodeURIComponent(node.attrs.id)}/content`;
    const type = String(node.attrs.mediaType);
    const media = type.startsWith('image/')
      ? ['img', { src: url, alt: node.attrs.caption || node.attrs.filename, loading: 'lazy' }]
      : type.startsWith('video/')
        ? ['video', { src: url, controls: '', preload: 'metadata' }]
        : type.startsWith('audio/')
          ? ['audio', { src: url, controls: '', preload: 'metadata' }]
          : ['a', { href: url, download: node.attrs.filename }, node.attrs.filename];
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-attachment': node.attrs.id,
        class: 'attachment-block',
      }),
      media,
      ['figcaption', {}, node.attrs.caption || node.attrs.filename],
    ];
  },
});
export const databaseView = Node.create({
  name: 'databaseView',
  group: 'block',
  atom: true,
  addAttributes() {
    return { databaseId: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-database-view]' }];
  },
  renderHTML({ node }) {
    return [
      'div',
      { 'data-database-view': node.attrs.databaseId },
      ['a', { href: `#${encodeURIComponent(node.attrs.databaseId)}/database` }, 'Open database'],
    ];
  },
});
const embed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  addAttributes() {
    return { url: { default: '' }, title: { default: 'Embedded video' } };
  },
  renderHTML({ node }) {
    const source = safeEmbedSource(String(node.attrs.url));
    return source
      ? [
          'figure',
          { class: 'embed-block' },
          [
            'iframe',
            {
              src: source,
              title: node.attrs.title,
              sandbox: 'allow-scripts allow-presentation',
              allow: 'fullscreen',
              referrerpolicy: 'no-referrer',
              loading: 'lazy',
            },
          ],
          ['figcaption', {}, node.attrs.title],
        ]
      : ['p', {}, 'Unsupported embed. The original URL was preserved: ' + String(node.attrs.url)];
  },
});
const callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML() {
    return [{ tag: 'aside[data-callout]' }];
  },
  renderHTML() {
    return ['aside', { 'data-callout': '', class: 'callout-block' }, 0];
  },
});
export const editorExtensions = () => [
  documentRoot,
  StarterKit.configure({
    document: false,
    undoRedo: false,
    link: { openOnClick: false, defaultProtocol: 'https' },
  }),
  ...canvasExtensions(),
  TableKit.configure({ table: { resizable: false } }),
  TaskList,
  TaskItem.configure({ nested: true }),
  pageLink,
  wikiLink,
  attachment,
  databaseView,
  embed,
  callout,
  toggleBlock,
  toggleTitle,
  toggleContent,
  highlight,
];
export const editorSchema = () => getSchema(editorExtensions());
export const emptyDocument: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };
export function validateDocument(content: JSONContent, kind?: PageKind) {
  const node = editorSchema().nodeFromJSON(content);
  node.check();
  validateCanvas(node.toJSON());
  if (kind && (kind === 'canvas') !== isCanvas(node.toJSON()))
    throw new Error('The content does not match this page type.');
  return node;
}
export function documentFromJSON(content: JSONContent, kind?: PageKind): Y.Doc {
  const node = validateDocument(content, kind);
  return prosemirrorJSONToYDoc(node.type.schema, content, 'default');
}
export function documentJSON(doc: Y.Doc): JSONContent {
  return yDocToProsemirrorJSON(doc, 'default') as JSONContent;
}
export { projectDocument } from './projection.js';
