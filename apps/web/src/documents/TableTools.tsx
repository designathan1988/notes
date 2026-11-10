import { t } from '../i18n/index.js';
import { useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { Table2 } from 'lucide-react';
import { Popover } from '../ui/Popover.js';
import { IconButton } from '../ui/IconButton.js';

type Corner = { top: number; left: number };

/** Top-right corner of the table holding the caret, relative to the editor wrapper. */
function tableCorner(editor: Editor): Corner | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name !== 'table') continue;
    const dom = editor.view.nodeDOM($from.before(depth));
    const wrap = editor.view.dom.closest('.editor-wrap');
    if (!(dom instanceof HTMLElement) || !wrap) return null;
    const table = dom.getBoundingClientRect(),
      origin = wrap.getBoundingClientRect();
    return { top: Math.round(table.top - origin.top), left: Math.round(table.right - origin.left) };
  }
  return null;
}

/**
 * The table's actions. In the phone toolbar they are one more button; on a desktop, where the
 * page has no toolbar, the button is attached to the table itself, in the margin at its top-right
 * corner, so it never covers a cell.
 */
export function TableTools({ editor, attached = false }: { editor: Editor; attached?: boolean }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor.isActive('table')
        ? { corner: attached ? tableCorner(editor) : null, focused: editor.view.hasFocus() }
        : null,
    equalityFn: (a, b) =>
      a === b ||
      (!!a &&
        !!b &&
        a.focused === b.focused &&
        a.corner?.top === b.corner?.top &&
        a.corner?.left === b.corner?.left),
  });
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // Attached to the table only while someone is working in it (or its menu is open).
  if (!state || (attached && (!state.corner || (!state.focused && !anchor)))) return null;
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
  const button = (
    <IconButton
      label={t('Table actions')}
      // Pressing it keeps the caret in the table, so the button does not vanish mid-click.
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => setAnchor(event.currentTarget)}
    >
      <Table2 />
    </IconButton>
  );
  return (
    <>
      {attached && state.corner ? (
        <div className="table-corner" style={{ top: state.corner.top, left: state.corner.left }}>
          {button}
        </div>
      ) : (
        button
      )}
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
