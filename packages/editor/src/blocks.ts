import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection, Selection, type EditorState, type Transaction } from '@tiptap/pm/state';

export type BlockKind =
  | 'paragraph'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'codeBlock'
  | 'blockquote'
  | 'toggleBlock'
  | 'callout';
export function blockAt(doc: ProseMirrorNode, position: number) {
  if (position < 0 || position >= doc.content.size) return null;
  const resolved = doc.resolve(position);
  const index = resolved.index(0);
  const node = doc.maybeChild(index);
  if (!node) return null;
  let from = 0;
  for (let i = 0; i < index; i++) from += doc.child(i).nodeSize;
  return { node, index, from, to: from + node.nodeSize };
}
export function moveBlock(
  state: EditorState,
  position: number,
  direction: -1 | 1,
): Transaction | null {
  const block = blockAt(state.doc, position);
  if (!block || block.index + direction < 0 || block.index + direction >= state.doc.childCount)
    return null;
  const target =
    direction === -1
      ? block.from - state.doc.child(block.index - 1).nodeSize
      : block.from + state.doc.child(block.index + 1).nodeSize;
  const tr = state.tr.delete(block.from, block.to).insert(target, block.node);
  return tr.setSelection(NodeSelection.create(tr.doc, target)).scrollIntoView();
}
export function moveBlockTo(
  state: EditorState,
  position: number,
  destination: number,
): Transaction | null {
  const block = blockAt(state.doc, position);
  if (!block) return null;
  const boundaries = new Set<number>([state.doc.content.size]);
  state.doc.forEach((_node, from) => boundaries.add(from));
  if (!boundaries.has(destination) || (destination >= block.from && destination <= block.to))
    return null;
  const target = destination > block.from ? destination - block.node.nodeSize : destination;
  const tr = state.tr.delete(block.from, block.to).insert(target, block.node);
  return tr.setSelection(NodeSelection.create(tr.doc, target)).scrollIntoView();
}
export function duplicateBlock(state: EditorState, position: number): Transaction | null {
  const block = blockAt(state.doc, position);
  if (!block) return null;
  const tr = state.tr.insert(block.to, block.node.copy(block.node.content));
  return tr.setSelection(NodeSelection.create(tr.doc, block.to)).scrollIntoView();
}
export function removeBlock(state: EditorState, position: number): Transaction | null {
  const block = blockAt(state.doc, position);
  if (!block) return null;
  const tr = state.tr.delete(block.from, block.to);
  return tr
    .setSelection(Selection.near(tr.doc.resolve(Math.min(block.from, tr.doc.content.size))))
    .scrollIntoView();
}
// Never silently flatten tables, media, or nested structures during a conversion.
export function changeBlock(
  state: EditorState,
  position: number,
  kind: BlockKind,
  level = 2,
): Transaction | null {
  const block = blockAt(state.doc, position);
  if (!block) return null;
  const replacement = convertedBlock(block.node, kind, level);
  if (!replacement) return null;
  const tr = state.tr.replaceWith(block.from, block.to, replacement);
  return tr.setSelection(NodeSelection.create(tr.doc, block.from)).scrollIntoView();
}
/**
 * The block rewritten as another kind, or null when converting would lose structure.
 * A toggle section converts its title and keeps its contents as the blocks that follow it.
 */
export function convertedBlock(
  node: ProseMirrorNode,
  kind: BlockKind,
  level = 2,
): ProseMirrorNode[] | null {
  const schema = node.type.schema;
  if (node.type.name === 'toggleBlock') {
    if (kind === 'toggleBlock') return [node];
    const title = node.firstChild;
    if (!title?.isTextblock) return null;
    const contents: ProseMirrorNode[] = [];
    node.lastChild?.forEach((child) => {
      // An untouched toggle holds one empty paragraph: nothing worth keeping.
      if (!(child.type.name === 'paragraph' && !child.content.size)) contents.push(child);
    });
    const converted = convertTextblock(title, kind, level);
    return converted ? [converted, ...contents] : null;
  }
  let source = node;
  while (!source.isTextblock && source.childCount === 1) source = source.firstChild!;
  if (!source.isTextblock) return null;
  const converted = convertTextblock(source, kind, level);
  return converted ? [converted] : null;
  function convertTextblock(textblock: ProseMirrorNode, target: BlockKind, headingLevel: number) {
    const content = textblock.content;
    const paragraph = schema.nodes.paragraph.create(null, content);
    return target === 'toggleBlock'
      ? schema.nodes.toggleBlock.create(null, [
          schema.nodes.toggleTitle.create(null, content),
          schema.nodes.toggleContent.create(null, schema.nodes.paragraph.create()),
        ])
      : target === 'heading'
        ? schema.nodes.heading.create({ level: headingLevel }, content)
        : target === 'codeBlock'
          ? schema.nodes.codeBlock.create(
              null,
              textblock.textContent ? schema.text(textblock.textContent) : null,
            )
          : ['callout', 'blockquote'].includes(target)
            ? schema.nodes[target].create(null, paragraph)
            : ['bulletList', 'orderedList', 'taskList'].includes(target)
              ? schema.nodes[target].create(
                  null,
                  schema.nodes[target === 'taskList' ? 'taskItem' : 'listItem'].create(
                    target === 'taskList' ? { checked: false } : null,
                    paragraph,
                  ),
                )
              : paragraph;
  }
}
