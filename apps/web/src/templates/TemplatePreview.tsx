import { t } from '../i18n/index.js';
import { useMemo } from 'react';
import * as Y from 'yjs';
import { documentJSON } from '@note/editor/schema';
import VersionPreview from '../activity/VersionPreview.js';
export default function TemplatePreview({
  state,
  readOnly = false,
}: {
  state: string;
  readOnly?: boolean;
}) {
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
  const empty =
    !content.content?.length ||
    content.content.every((node) => node.type === 'paragraph' && !node.content?.length);
  return empty ? (
    <div className="template-empty">
      <p>{t('This template has no content yet.')}</p>
      <p>
        {readOnly
          ? t('Open template to review its properties.')
          : t('Choose Edit template to add a starting point for future pages.')}
      </p>
    </div>
  ) : (
    <VersionPreview content={content} />
  );
}
