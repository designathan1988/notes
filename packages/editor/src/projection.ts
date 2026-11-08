import type { JSONContent } from '@tiptap/core';

/** Read-only document projection; it does not load editor extensions or own content. */
export function projectDocument(content: JSONContent) {
  const text: string[] = [];
  const links = new Set<string>();
  const headings: { level: number; text: string }[] = [];
  function visit(node: JSONContent) {
    if (node.text) text.push(node.text);
    if (node.type === 'attachment') {
      for (const value of [node.attrs?.filename, node.attrs?.caption])
        if (typeof value === 'string' && value) text.push(value);
    }
    if (['pageLink', 'wikiLink'].includes(node.type ?? '') && node.attrs?.targetId) {
      links.add(String(node.attrs.targetId));
      text.push(String(node.attrs.label ?? ''));
    }
    if (node.type === 'heading')
      headings.push({
        level: Number(node.attrs?.level ?? 2),
        text: (node.content ?? []).map((child) => child.text ?? '').join(''),
      });
    for (const child of node.content ?? []) visit(child);
    if (
      [
        'paragraph',
        'heading',
        'listItem',
        'taskItem',
        'codeBlock',
        'toggleTitle',
        'canvasCard',
        'canvasGroup',
        'canvasEdge',
      ].includes(node.type ?? '')
    )
      text.push('\n');
  }
  visit(content);
  return {
    text: text
      .join(' ')
      .replace(/ *\n */g, '\n')
      .trim(),
    links: [...links],
    headings,
  };
}
