import { t } from '../i18n/index.js';
import { useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { Table2 } from 'lucide-react';
import { Popover } from '../ui/Popover.js';
import { IconButton } from '../ui/IconButton.js';
export function TableTools({ editor }: { editor: Editor }) {
  const active = useEditorState({ editor, selector: ({ editor }) => editor.isActive('table') });
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!active) return null;
  const actions = [
    ['Add row above', 'addRowBefore'],
    ['Add row below', 'addRowAfter'],
    ['Add column before', 'addColumnBefore'],
    ['Add column after', 'addColumnAfter'],
    ['Toggle header row', 'toggleHeaderRow'],
    ['Merge cells', 'mergeCells'],
    ['Split cell', 'splitCell'],
    ['Delete row', 'deleteRow'],
    ['Delete column', 'deleteColumn'],
    ['Delete table', 'deleteTable'],
  ] as const;
  return (
    <>
      <IconButton label={t('Table actions')} onClick={(event) => setAnchor(event.currentTarget)}>
        <Table2 />
      </IconButton>
      {anchor && (
        <Popover anchor={anchor} label={t('Table actions')} close={() => setAnchor(null)}>
          <div className="menu-list">
            {actions.map(([label, command]) => (
              <button
                key={command}
                disabled={!editor.can()[command]()}
                className={command.startsWith('delete') ? 'danger' : ''}
                onClick={() => {
                  editor.chain().focus()[command]().run();
                  setAnchor(null);
                }}
              >
                {t(label)}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </>
  );
}
