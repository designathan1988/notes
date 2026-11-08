import { parse, type DefaultTreeAdapterTypes } from 'parse5';
import type { JSONContent } from '@tiptap/core';

/** Static discovery only: no DOM, resource loading or authored code execution. */
export function projectWebsite(root: JSONContent) {
  const text: string[] = [],
    headings: { level: number; text: string }[] = [];
  const ignored = new Set(['script', 'style', 'template', 'noscript']);
  const blocks = new Set([
    'p',
    'div',
    'section',
    'article',
    'main',
    'li',
    'br',
    'tr',
    'title',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
  ]);
  function visit(node: DefaultTreeAdapterTypes.Node): string {
    if (node.nodeName === '#text') return (node as DefaultTreeAdapterTypes.TextNode).value;
    if (!('childNodes' in node)) return '';
    if (
      'tagName' in node &&
      (ignored.has(node.tagName) ||
        node.attrs.some(
          (attribute) =>
            attribute.name === 'hidden' ||
            (attribute.name === 'aria-hidden' && attribute.value === 'true'),
        ))
    )
      return '';
    let value = node.childNodes.map(visit).join('');
    if ('tagName' in node) {
      if (node.tagName === 'img')
        value += node.attrs.find((attribute) => attribute.name === 'alt')?.value ?? '';
      if (/^h[1-6]$/.test(node.tagName))
        headings.push({ level: Number(node.tagName[1]), text: value.replace(/\s+/g, ' ').trim() });
      if (blocks.has(node.tagName)) value += '\n';
    }
    return value;
  }
  for (const file of root.content ?? []) {
    if (
      file.type !== 'webFile' ||
      (file.attrs?.path !== root.attrs?.entry && !/\.html?$/i.test(String(file.attrs?.path)))
    )
      continue;
    text.push(visit(parse((file.content ?? []).map((child) => child.text ?? '').join(''))));
  }
  return {
    text: text
      .join('\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .trim(),
    headings,
  };
}
