import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { editorExtensions, databaseView } from '../../../../packages/editor/src/schema.js';
import { toggleBlock } from '../../../../packages/editor/src/structure.js';
import { ToggleSection } from './ToggleSection.js';
import { DatabaseView } from '../databases/DatabaseView.js';
function EmbeddedDatabase({ node }: NodeViewProps) {
  return (
    <NodeViewWrapper className="embedded-database">
      <DatabaseView
        key={String(node.attrs.databaseId)}
        id={String(node.attrs.databaseId)}
        compact
      />
    </NodeViewWrapper>
  );
}
/** Shared rich block rendering for continuous documents and spatial card bodies. */
export const richEditorExtensions = () => [
  ...editorExtensions().filter(
    (extension) => !['databaseView', 'toggleBlock'].includes(extension.name),
  ),
  toggleBlock.extend({ addNodeView: () => ReactNodeViewRenderer(ToggleSection) }),
  databaseView.extend({ addNodeView: () => ReactNodeViewRenderer(EmbeddedDatabase) }),
];
