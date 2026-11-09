import { t } from '../i18n/index.js';
import type { Editor } from '@tiptap/react';
import { FileText } from 'lucide-react';
import { documentTemplates } from '@note/editor/templates';
import { Popover } from '../ui/Popover.js';
import { isolatedDocumentEdit } from './history.js';

export function Templates({
  editor,
  anchor,
  close,
}: {
  editor: Editor;
  anchor: HTMLElement | null;
  close(): void;
}) {
  return (
    <Popover anchor={anchor} label={t('Document templates')} close={close}>
      <div className="popover-caption">{t('Start from a template')}</div>
      {documentTemplates.map((template) => (
        <button
          key={template.id}
          className="template-choice"
          onClick={() => {
            const last = editor.state.doc.lastChild;
            const end = editor.state.doc.content.size;
            const placeholder = last?.type.name === 'paragraph' && !last.content.size;
            isolatedDocumentEdit(editor, () => {
              editor
                .chain()
                .focus()
                .insertContentAt(
                  placeholder ? { from: end - last.nodeSize, to: end } : end,
                  template.content,
                )
                .run();
            });
            close();
          }}
        >
          <FileText size={18} />
          <span>
            <strong>{t(template.title)}</strong>
            <small>{t(template.description)}</small>
          </span>
        </button>
      ))}
      <p className="template-hint">
        {t('Adds editable blocks to this page. Existing content is kept.')}
      </p>
    </Popover>
  );
}
