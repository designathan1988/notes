import { EditorContent, useEditor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import { editorExtensions } from '../../../../packages/editor/src/schema.js';
import { BlockSurface } from '../documents/BlockSurface.js';

/** Isolated read-only rendering: no provider, recovery session or application projections. */
export default function VersionPreview({ content }: { content: JSONContent }) {
  const editor = useEditor(
    {
      extensions: [...editorExtensions(), BlockSurface],
      content,
      editable: false,
      editorProps: { attributes: { class: 'note-editor', 'aria-label': 'Saved document content' } },
      onCreate: ({ editor }) => {
        editor.view.dom.querySelectorAll('input').forEach((input) => {
          input.disabled = true;
        });
      },
    },
    [content],
  );
  return (
    <div className="version-document">
      <EditorContent editor={editor} />
    </div>
  );
}
