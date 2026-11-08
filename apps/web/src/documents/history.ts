import type { Editor } from '@tiptap/core';
import { yUndoPluginKey } from '@tiptap/y-tiptap';

/** A discrete command must not share an undo item with preceding or following typing. */
export function isolatedDocumentEdit(editor: Editor, edit: () => void) {
  const manager = yUndoPluginKey.getState(editor.state)?.undoManager;
  manager?.stopCapturing();
  try {
    edit();
  } finally {
    manager?.stopCapturing();
  }
}
