import { t } from '../i18n/index.js';
import { useEffect, useState, useRef } from 'react';
import { BlockGutter } from './BlockGutter.js';
import { Plus } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import type { Selection } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { blockAt } from '@note/editor/blocks';
import { blocksInRange } from '@note/editor/block-selection';
import { BlockMenu, insertBlock } from './BlockMenu.js';

export function BlockControls({
  editor,
  requested,
  actionsRequested,
  reset,
  attachment,
  embed,
  link,
  database,
}: {
  editor: Editor;
  requested: boolean;
  actionsRequested: boolean;
  reset(): void;
  attachment(): void;
  embed(): void;
  link(): void;
  database(): void;
}) {
  const [menu, setMenu] = useState<'insert' | 'actions' | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (requested || actionsRequested) {
      const current = editor.view.nodeDOM(
        blockAt(editor.state.doc, editor.state.selection.from)?.from ?? 0,
      );
      setAnchor(
        actionsRequested
          ? document.querySelector<HTMLElement>('[data-block-actions]')
          : current instanceof HTMLElement
            ? current
            : button.current,
      );
      opened.current = null;
      setMenu(actionsRequested ? 'actions' : 'insert');
      reset();
    }
  }, [requested, actionsRequested, reset, editor]);
  // Opening a block's actions selects the block. Closing the menu without choosing anything
  // gives the caret back where it was: otherwise the next keystroke would replace the block.
  const opened = useRef<{ before: Selection; doc: ProseMirrorNode; selected: Selection } | null>(
    null,
  );
  const close = () => {
    const state = opened.current;
    opened.current = null;
    if (
      state &&
      editor.state.doc === state.doc &&
      editor.state.selection.eq(state.selected) &&
      !editor.isDestroyed
    )
      editor.view.dispatch(editor.state.tr.setSelection(state.before));
    setMenu(null);
  };
  const open = (mode: 'insert' | 'actions', target: HTMLElement, position?: number) => {
    // A handle on a block inside a block selection acts on the whole selection.
    const index = position === undefined ? -1 : blockAt(editor.state.doc, position)?.index;
    if (position !== undefined && !blocksInRange(editor.state.selection).includes(index ?? -1)) {
      const before = editor.state.selection;
      editor.commands.setNodeSelection(position);
      opened.current = { before, doc: editor.state.doc, selected: editor.state.selection };
    } else opened.current = null;
    setAnchor(target);
    setMenu(mode);
  };
  return (
    <>
      <BlockGutter
        editor={editor}
        insert={(position, target) => {
          const block = blockAt(editor.state.doc, position);
          if (block) {
            insertBlock(editor, block.to, 'paragraph');
            open('insert', target);
          }
        }}
        actions={(position, target) => open('actions', target, position)}
      />
      <button
        ref={button}
        className="add-block-row"
        onClick={(event) => {
          const last = editor.state.doc.lastChild;
          const position = editor.state.doc.content.size - (last?.nodeSize ?? 0);
          if (last?.type.name === 'paragraph' && !last.content.size)
            editor.commands.setTextSelection(position + 1);
          else insertBlock(editor, editor.state.doc.content.size, 'paragraph');
          open('insert', event.currentTarget);
        }}
        aria-label={t('Add a block')}
      >
        <Plus size={15} />
        <span>{t('Add a block')}</span>
      </button>
      {menu && (
        <BlockMenu
          editor={editor}
          mode={menu}
          anchor={anchor}
          close={close}
          attachment={attachment}
          embed={embed}
          link={link}
          database={database}
        />
      )}
    </>
  );
}
