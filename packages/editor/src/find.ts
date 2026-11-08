import type { Node } from '@tiptap/pm/model';

export interface DocumentMatch {
  from: number;
  to: number;
}
export const matchLimit = 2000;
/** Literal text search. Offsets remain ProseMirror positions across inline marks and atoms. */
export function findDocumentMatches(
  doc: Node,
  query: string,
  caseSensitive = false,
): DocumentMatch[] {
  if (!query) return [];
  const pattern = new RegExp(
    query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    caseSensitive ? 'gu' : 'giu',
  );
  const matches: DocumentMatch[] = [];
  doc.descendants((node, position) => {
    if (matches.length >= matchLimit) return false;
    if (!node.isTextblock) return true;
    const text = node.textBetween(0, node.content.size, '\n', '\uFFFC');
    for (const match of text.matchAll(pattern)) {
      matches.push({
        from: position + 1 + match.index,
        to: position + 1 + match.index + match[0].length,
      });
      if (matches.length >= matchLimit) break;
    }
    return false;
  });
  return matches;
}
