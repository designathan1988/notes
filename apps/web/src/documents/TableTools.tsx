import { useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { Table2 } from 'lucide-react';
import { Dialog } from '../ui/Dialog.js';
import { IconButton } from '../ui/IconButton.js';
export function TableTools({ editor }: { editor: Editor }) {
  const active = useEditorState({ editor, selector: ({ editor }) => editor.isActive('table') });
  const [open, setOpen] = useState(false);
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
      <IconButton label="Table actions" onClick={() => setOpen(true)}>
        <Table2 />
      </IconButton>
      {open && (
        <Dialog title="Table actions" onClose={() => setOpen(false)}>
          <div className="menu-list">
            {actions.map(([label, command]) => (
              <button
                key={command}
                disabled={!editor.can()[command]()}
                className={command.startsWith('delete') ? 'danger' : ''}
                onClick={() => {
                  editor.chain().focus()[command]().run();
                  setOpen(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </Dialog>
      )}
    </>
  );
}
