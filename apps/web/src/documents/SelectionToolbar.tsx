import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditorState, type Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code2,
  Highlighter,
  Link,
  MessageSquarePlus,
} from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import { AllSelection, TextSelection } from '@tiptap/pm/state';

export function SelectionToolbar({
  editor,
  link,
  pageId,
}: {
  editor: Editor;
  link(): void;
  pageId: string;
}) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const obscured = useWorkspace(
    (state) => !!state.dialog || state.commandOpen || state.sidebarOpen,
  );
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      code: editor.isActive('code'),
      highlight: editor.isActive('highlight'),
      link: editor.isActive('link'),
    }),
  });
  useEffect(() => {
    const update = () => {
      const { from, to, empty } = editor.state.selection;
      if (
        empty ||
        // Only selected text gets text formatting; whole blocks (node or block-range
        // selections) get block actions instead.
        !(
          editor.state.selection instanceof TextSelection ||
          editor.state.selection instanceof AllSelection
        ) ||
        !editor.isEditable ||
        !editor.isFocused ||
        !editor.state.doc.textBetween(from, to).trim()
      ) {
        setPosition(null);
        return;
      }
      const start = editor.view.coordsAtPos(from),
        end = editor.view.coordsAtPos(to),
        bounds = editor.view.dom.getBoundingClientRect(),
        width = surface.current?.getBoundingClientRect().width ?? 290;
      // Keep the block gutter reachable while a text selection is active.
      setPosition({
        left: Math.max(
          8,
          Math.min(
            Math.max(bounds.left + 24, (start.left + end.left) / 2 - width / 2),
            innerWidth - width - 8,
          ),
        ),
        top: Math.max(
          88,
          Math.min(start.top < 132 ? end.bottom + 8 : start.top - 44, innerHeight - 48),
        ),
      });
    };
    editor
      .on('selectionUpdate', update)
      .on('transaction', update)
      .on('focus', update)
      .on('blur', update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      editor
        .off('selectionUpdate', update)
        .off('transaction', update)
        .off('focus', update)
        .off('blur', update);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [editor]);
  if (!position || obscured) return null;
  const items = [
    { label: 'Bold', mark: 'bold', Icon: Bold },
    { label: 'Italic', mark: 'italic', Icon: Italic },
    { label: 'Underline', mark: 'underline', Icon: Underline },
    { label: 'Strikethrough', mark: 'strike', Icon: Strikethrough },
    { label: 'Inline code', mark: 'code', Icon: Code2 },
    { label: 'Highlight', mark: 'highlight', Icon: Highlighter },
  ] as const;
  return createPortal(
    <div
      ref={surface}
      className="selection-toolbar"
      role="toolbar"
      aria-label="Selection formatting"
      style={position}
      onMouseDown={(event) => event.preventDefault()}
    >
      {items.map(({ label, mark, Icon }) => (
        <button
          key={mark}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={active[mark]}
          onClick={() => editor.chain().focus().toggleMark(mark).run()}
        >
          <Icon size={16} />
        </button>
      ))}
      <button
        type="button"
        aria-label="Link selected text"
        title="Link selected text"
        aria-pressed={active.link}
        onClick={link}
      >
        <Link size={16} />
      </button>
      <button
        type="button"
        aria-label="Comment on selection"
        title="Comment on selection"
        onClick={() => {
          const { from, to } = editor.state.selection;
          const quote = editor.state.doc.textBetween(from, to, ' ').slice(0, 1000);
          editor.commands.blur();
          const state = useWorkspace.getState();
          if (state.selectedId !== pageId) state.openTab(pageId);
          useWorkspace.getState().openPagePanel('discussion', quote);
        }}
      >
        <MessageSquarePlus size={16} />
      </button>
    </div>,
    document.body,
  );
}
