import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { projectDocument } from '../../../../packages/editor/src/schema.js';
import { documentStatistics } from '../../../../packages/editor/src/statistics.js';
import { useWorkspace } from '../state/store.js';

/** Derived UI only. The shared Y.Doc remains the sole writable content owner. */
export function useDocumentProjection(editor: Editor | null) {
  const [statistics, setStatistics] = useState({ words: 0, characters: 0, minutes: 0 });
  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const projection = projectDocument(editor.getJSON()),
        state = useWorkspace.getState();
      if (
        JSON.stringify(state.outline) !== JSON.stringify(projection.headings) ||
        JSON.stringify(state.linkedPageIds) !== JSON.stringify(projection.links)
      )
        useWorkspace.setState({ outline: projection.headings, linkedPageIds: projection.links });
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
  }, [editor]);
  return statistics;
}
