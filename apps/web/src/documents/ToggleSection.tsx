import { t, useLocale } from '../i18n/index.js';
import { useState } from 'react';
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { ChevronRight } from 'lucide-react';

export function ToggleSection({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  useLocale();
  // Viewers can explore a collapsed section without writing to the shared document.
  const [localCollapsed, setLocalCollapsed] = useState<boolean | null>(null);
  const collapsed =
    !editor.isEditable && localCollapsed !== null ? localCollapsed : !!node.attrs.collapsed;
  return (
    <NodeViewWrapper
      as="section"
      className="toggle-block"
      data-toggle-block=""
      data-collapsed={String(collapsed)}
    >
      <button
        type="button"
        className="toggle-disclosure"
        contentEditable={false}
        aria-label={collapsed ? t('Expand section') : t('Collapse section')}
        aria-expanded={!collapsed}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (editor.isEditable) {
            updateAttributes({ collapsed: !collapsed });
            const position = getPos();
            if (
              !collapsed &&
              typeof position === 'number' &&
              editor.state.selection.from > position &&
              editor.state.selection.to < position + node.nodeSize
            )
              editor.commands.setTextSelection(position + node.firstChild!.nodeSize);
          } else setLocalCollapsed(!collapsed);
        }}
      >
        <ChevronRight size={16} />
      </button>
      <NodeViewContent className="toggle-children" />
    </NodeViewWrapper>
  );
}
