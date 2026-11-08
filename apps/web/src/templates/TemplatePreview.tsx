import { useMemo } from 'react';
import * as Y from 'yjs';
import { documentJSON } from '@note/editor/schema';
import VersionPreview from '../activity/VersionPreview.js';
export default function TemplatePreview({ state }: { state: string }) {
  const content = useMemo(() => {
    const doc = new Y.Doc();
    try {
      Y.applyUpdate(
        doc,
        Uint8Array.from(atob(state), (character) => character.charCodeAt(0)),
      );
      return documentJSON(doc);
    } finally {
      doc.destroy();
    }
  }, [state]);
  return <VersionPreview content={content} />;
}
