import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { projectDocument } from '@note/editor/schema';
import { documentStatistics } from '@note/editor/statistics';
import { useWorkspace } from '../state/store.js';

/** Derived UI only. The shared Y.Doc remains the sole writable content owner. */
export function useDocumentProjection(editor: Editor | null, pageId: string) {
  const [statistics, setStatistics] = useState({ words: 0, characters: 0, minutes: 0 });
  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const projection = projectDocument(editor.getJSON()),
        state = useWorkspace.getState();
      if (
        state.selectedId === pageId &&
        (JSON.stringify(state.outline) !== JSON.stringify(projection.headings) ||
          JSON.stringify(state.linkedPageIds) !== JSON.stringify(projection.links))
      )
        useWorkspace.getState().setDocumentProjection(projection.headings, projection.links);
      setStatistics(documentStatistics(editor.state.doc));
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(update, 140);
    };
    update();
    editor.on('update', schedule);
    return () => {
      clearTimeout(timer);
      editor.off('update', schedule);
    };
  }, [editor, pageId]);
  return statistics;
}
