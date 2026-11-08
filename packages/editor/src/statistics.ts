import type { Node } from '@tiptap/pm/model';

export function documentStatistics(doc: Node) {
  const text = doc
    .textBetween(0, doc.content.size, '\n', (node) =>
      ['wikiLink', 'pageLink'].includes(node.type.name) ? String(node.attrs.label ?? '') : '',
    )
    .trim();
  const words = text.match(/\S+/gu)?.length ?? 0;
  return { words, characters: [...text].length, minutes: Math.ceil(words / 200) };
}
