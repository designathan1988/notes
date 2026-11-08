import type { Editor } from '@tiptap/core';
import { canvasItems } from '../../../../packages/editor/src/canvas-commands.js';
import type { ClipboardInserter } from '../documents/capture.js';

/** Keep asynchronous clipboard conversion in the note created by this capture,
 * even if selection moves while embedded media or the original is uploading. */
export function canvasCaptureTarget(editor: Editor, id: string): ClipboardInserter {
  return (content, fullWhitespace) => {
    if (editor.isDestroyed || !editor.isEditable)
      throw new Error('The capture destination is no longer editable.');
    const card = canvasItems(editor.state.doc).find(
      (item) => item.id === id && item.node.type.name === 'canvasCard',
    );
    if (!card) throw new Error('The capture destination was removed.');
    const empty =
      card.node.childCount === 1 &&
      card.node.firstChild?.type.name === 'paragraph' &&
      card.node.firstChild.content.size === 0;
    const end = card.pos + card.node.nodeSize - 1;
    const range = empty ? { from: card.pos + 1, to: end } : end;
    const selection = editor.state.selection;
    const selected = selection.from > card.pos && selection.to < card.pos + card.node.nodeSize;
    const accepted = editor.commands.insertContentAt(range, content, {
      updateSelection: editor.view.hasFocus() && selected,
      ...(fullWhitespace ? { parseOptions: { preserveWhitespace: 'full' as const } } : {}),
    });
    if (!accepted) throw new Error('The captured content could not be inserted.');
  };
}
