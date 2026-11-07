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
  const { schema } = state;
  let source = block.node;
  while (!source.isTextblock && source.childCount === 1) source = source.firstChild!;
  if (!source.isTextblock) return null;
  const content = source.content;
  const paragraph = schema.nodes.paragraph.create(null, content);
  const replacement =
    kind === 'heading'
      ? schema.nodes.heading.create({ level }, content)
      : kind === 'codeBlock'
        ? schema.nodes.codeBlock.create(
            null,
            source.textContent ? schema.text(source.textContent) : null,
          )
        : ['callout', 'blockquote'].includes(kind)
          ? schema.nodes[kind].create(null, paragraph)
          : ['bulletList', 'orderedList', 'taskList'].includes(kind)
            ? schema.nodes[kind].create(
                null,
                schema.nodes[kind === 'taskList' ? 'taskItem' : 'listItem'].create(
                  kind === 'taskList' ? { checked: false } : null,
                  paragraph,
                ),
              )
            : paragraph;
  const tr = state.tr.replaceWith(block.from, block.to, replacement);
  return tr.setSelection(NodeSelection.create(tr.doc, block.from)).scrollIntoView();
}
