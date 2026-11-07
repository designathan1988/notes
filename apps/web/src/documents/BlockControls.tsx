import { useEffect, useState, useRef } from 'react';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import { GripVertical, Plus } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { blockAt } from '../../../../packages/editor/src/blocks.js';
import { BlockMenu, insertBlock } from './BlockMenu.js';

export function BlockControls({
  editor,
  requested,
  actionsRequested,
  reset,
  attachment,
  embed,
  link,
}: {
  editor: Editor;
  requested: boolean;
  actionsRequested: boolean;
  reset(): void;
  attachment(): void;
  embed(): void;
  link(): void;
}) {
  const [menu, setMenu] = useState<'insert' | 'actions' | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const hovered = useRef(0);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (requested || actionsRequested) {
      const current = editor.view.nodeDOM(
        blockAt(editor.state.doc, editor.state.selection.from)?.from ?? 0,
      );
      setAnchor(
        actionsRequested
          ? document.querySelector<HTMLElement>('[aria-label="Block actions"]')
          : current instanceof HTMLElement
            ? current
            : button.current,
      );
      setMenu(actionsRequested ? 'actions' : 'insert');
      reset();
    }
  }, [requested, actionsRequested, reset, editor]);
  const close = () => setMenu(null);
  const open = (mode: 'insert' | 'actions', target: HTMLElement, position?: number) => {
    if (position !== undefined) editor.commands.setNodeSelection(position);
    setAnchor(target);
    setMenu(mode);
  };
  return (
    <>
      <DragHandle
        editor={editor}
        className="block-drag-handle"
        onNodeChange={({ pos }) => {
          hovered.current = pos;
        }}
      >
        <button
          aria-label="Insert block here"
          onClick={(event) => {
            const block = blockAt(editor.state.doc, hovered.current);
            if (!block) return;
            insertBlock(editor, block.to, 'paragraph');
            open('insert', event.currentTarget);
          }}
        >
          <Plus size={16} />
        </button>
        <button
          aria-label="Drag or open block actions"
          onClick={(event) => open('actions', event.currentTarget, hovered.current)}
        >
          <GripVertical size={17} />
        </button>
      </DragHandle>
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
        aria-label="Add a block"
      >
        <Plus size={15} />
        <span>Add a block</span>
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
        />
      )}
    </>
  );
}
