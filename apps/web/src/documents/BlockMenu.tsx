import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { newWebContent } from '@note/editor/web';
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Code2,
  Copy,
  Database,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  MessageSquareQuote,
  Minus,
  Paperclip,
  Quote,
  Search,
  Table2,
  Trash2,
  Type,
  Video,
  Link,
  ChevronRight,
} from 'lucide-react';
import { blockAt, changeBlock, duplicateBlock, moveBlock, removeBlock } from '@note/editor/blocks';

const choices = [
  {
    type: 'toggleBlock',
    label: 'Toggle section',
    description: 'A heading with collapsible content',
    Icon: ChevronRight,
  },
  { type: 'paragraph', label: 'Text', description: 'A clear place for your thoughts', Icon: Type },
  {
    type: 'heading',
    level: 1,
    label: 'Heading 1',
    description: 'A large section heading',
    Icon: Heading1,
  },
  {
    type: 'heading',
    level: 2,
    label: 'Heading 2',
    description: 'A medium section heading',
    Icon: Heading2,
  },
  {
    type: 'heading',
    level: 3,
    label: 'Heading 3',
    description: 'A small section heading',
    Icon: Heading3,
  },
  { type: 'bulletList', label: 'Bullet list', description: 'A simple unordered list', Icon: List },
  {
    type: 'orderedList',
    label: 'Numbered list',
    description: 'Steps in a meaningful order',
    Icon: ListOrdered,
  },
  {
    type: 'taskList',
    label: 'Checklist',
    description: 'Keep track of what needs doing',
    Icon: CheckSquare,
  },
  {
    type: 'callout',
    label: 'Callout',
    description: 'Bring an important idea into focus',
    Icon: MessageSquareQuote,
  },
  {
    type: 'blockquote',
    label: 'Quote',
    description: 'Make room for another perspective',
    Icon: Quote,
  },
  {
    type: 'codeBlock',
    label: 'Code block',
    description: 'Code with its formatting preserved',
    Icon: Code2,
  },
] as const;
export function insertBlock(editor: Editor, position: number, type: string, level = 2) {
  const paragraph = { type: 'paragraph' };
  const node =
    type === 'webComponent'
      ? newWebContent(true)
      : type === 'toggleBlock'
        ? {
            type,
            content: [{ type: 'toggleTitle' }, { type: 'toggleContent', content: [paragraph] }],
          }
        : ['callout', 'blockquote'].includes(type)
          ? { type, content: [paragraph] }
          : ['bulletList', 'orderedList', 'taskList'].includes(type)
            ? {
                type,
                content: [
                  {
                    type: type === 'taskList' ? 'taskItem' : 'listItem',
                    attrs: type === 'taskList' ? { checked: false } : undefined,
                    content: [paragraph],
                  },
                ],
              }
            : type === 'table'
              ? {
                  type,
                  content: Array.from({ length: 3 }, (_, row) => ({
                    type: 'tableRow',
                    content: Array.from({ length: 3 }, () => ({
                      type: row === 0 ? 'tableHeader' : 'tableCell',
                      content: [paragraph],
                    })),
                  })),
                }
              : { type, attrs: type === 'heading' ? { level } : undefined };
  const selected = blockAt(editor.state.doc, editor.state.selection.from);
  const empty =
    selected?.node.type.name === 'paragraph' &&
    !selected.node.content.size &&
    position === selected.to;
  if (empty) position = selected.from;
  editor
    .chain()
    .focus()
    .insertContentAt(empty ? { from: selected.from, to: selected.to } : position, node)
    .run();
  focusBlockContent(editor, position);
}
function focusBlockContent(editor: Editor, position: number) {
  const inserted = editor.state.doc.nodeAt(position);
  if (inserted) {
    let depth = 1;
    let child = inserted;
    while (!child.isTextblock && child.firstChild) {
      child = child.firstChild;
      depth++;
    }
    if (child.isTextblock) editor.commands.setTextSelection(position + depth);
  }
}
export function BlockMenu({
  editor,
  mode,
  anchor,
  close,
  attachment,
  embed,
  link,
  database,
}: {
  editor: Editor;
  mode: 'insert' | 'actions';
  anchor: HTMLElement | null;
  close(): void;
  attachment(): void;
  embed(): void;
  link(): void;
  database(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const selected = blockAt(editor.state.doc, editor.state.selection.from);
  const box = anchor?.getBoundingClientRect();
  const width = Math.min(306, window.innerWidth - 24);
  const left = Math.max(
    12,
    Math.min(box?.left ?? window.innerWidth / 2 - width / 2, window.innerWidth - width - 12),
  );
  const top = Math.max(12, Math.min((box?.bottom ?? 180) + 8, window.innerHeight - 470));
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node) && !anchor?.contains(event.target as Node))
        close();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [anchor, close]);
  const run = (command: () => void) => {
    command();
    close();
    editor.view.focus();
  };
  const apply = (transaction: ReturnType<typeof moveBlock>) => {
    if (transaction) editor.view.dispatch(transaction);
  };
  return createPortal(
    <div
      className="block-popover"
      ref={ref}
      style={{ left, top, width }}
      role="menu"
      aria-label={mode === 'insert' ? 'Add a block' : 'Block actions'}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
          event.preventDefault();
          ref.current
            ?.querySelector<HTMLButtonElement>('button[role=menuitem]:not(:disabled)')
            ?.click();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
          editor.view.focus();
        }
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
          event.preventDefault();
          const items = [
            ...ref.current!.querySelectorAll<HTMLButtonElement>(
              'button[role=menuitem]:not(:disabled)',
            ),
          ];
          const current = items.indexOf(document.activeElement as HTMLButtonElement);
          items[
            (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
          ]?.focus();
        }
      }}
    >
      <div className="block-menu-search">
        <Search size={15} />
        <input
          autoFocus
          aria-label="Find block type"
          placeholder={mode === 'insert' ? 'Search blocks…' : 'Turn into…'}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <kbd>Esc</kbd>
      </div>
      {mode === 'actions' && !query && selected && (
        <div className="block-action-list">
          <button
            role="menuitem"
            aria-label="Move up"
            onClick={() =>
              run(() => apply(moveBlock(editor.state, editor.state.selection.from, -1)))
            }
            disabled={selected.index === 0}
          >
            <ArrowUp />
            Move up<kbd aria-hidden="true">↑</kbd>
          </button>
          <button
            role="menuitem"
            aria-label="Move down"
            onClick={() =>
              run(() => apply(moveBlock(editor.state, editor.state.selection.from, 1)))
            }
            disabled={selected.index === editor.state.doc.childCount - 1}
          >
            <ArrowDown />
            Move down<kbd aria-hidden="true">↓</kbd>
          </button>
          <button
            role="menuitem"
            onClick={() =>
              run(() => apply(duplicateBlock(editor.state, editor.state.selection.from)))
            }
          >
            <Copy />
            Duplicate
          </button>
          <button
            role="menuitem"
            className="danger"
            onClick={() => run(() => apply(removeBlock(editor.state, editor.state.selection.from)))}
          >
            <Trash2 />
            Delete
          </button>
        </div>
      )}
      <div className="block-menu-caption">{mode === 'actions' ? 'Turn into' : 'Basic blocks'}</div>
      <div className="block-type-list">
        {choices
          .filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
          .map(({ type, label, description, Icon, ...rest }) => (
            <button
              role="menuitem"
              aria-label={label}
              key={label}
              disabled={
                mode === 'actions' &&
                !changeBlock(
                  editor.state,
                  editor.state.selection.from,
                  type,
                  'level' in rest ? rest.level : 2,
                )
              }
              onClick={() =>
                run(() => {
                  if (mode === 'actions')
                    apply(
                      changeBlock(
                        editor.state,
                        editor.state.selection.from,
                        type,
                        'level' in rest ? rest.level : 2,
                      ),
                    );
                  else {
                    const block = blockAt(editor.state.doc, editor.state.selection.from);
                    const position =
                      block?.node.isTextblock && !block.node.content.size ? block.from : null;
                    if (position !== null) {
                      apply(
                        changeBlock(editor.state, position, type, 'level' in rest ? rest.level : 2),
                      );
                      focusBlockContent(editor, position);
                    } else
                      insertBlock(
                        editor,
                        block?.to ?? editor.state.doc.content.size,
                        type,
                        'level' in rest ? rest.level : 2,
                      );
                  }
                })
              }
            >
              <span className="block-type-icon">
                <Icon />
              </span>
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
            </button>
          ))}
        {mode === 'insert' &&
          [
            {
              label: 'Divider',
              Icon: Minus,
              action: () =>
                insertBlock(
                  editor,
                  selected?.to ?? editor.state.doc.content.size,
                  'horizontalRule',
                ),
            },
            {
              label: 'Table',
              Icon: Table2,
              action: () =>
                insertBlock(editor, selected?.to ?? editor.state.doc.content.size, 'table'),
            },
            { label: 'File or media', Icon: Paperclip, action: attachment },
            {
              label: 'Web component',
              Icon: Code2,
              action: () =>
                insertBlock(editor, selected?.to ?? editor.state.doc.content.size, 'webComponent'),
            },
            { label: 'Database view', Icon: Database, action: database },
            { label: 'Video embed', Icon: Video, action: embed },
            { label: 'Page connection', Icon: Link, action: link },
          ]
            .filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
            .map(({ label, Icon, action }) => (
              <button key={label} role="menuitem" aria-label={label} onClick={() => run(action)}>
                <span className="block-type-icon">
                  <Icon />
                </span>
                <strong>{label}</strong>
              </button>
            ))}
      </div>
    </div>,
    document.body,
  );
}
