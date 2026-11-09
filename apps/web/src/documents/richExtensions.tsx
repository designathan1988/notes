import { useLocale } from '../i18n/index.js';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { editorExtensions, databaseView } from '@note/editor/schema';
import { toggleBlock } from '@note/editor/structure';
import { ToggleSection } from './ToggleSection.js';
import { interactiveNodeView } from './nodeViewEvents.js';
import { DatabaseView } from '../databases/DatabaseView.js';
import { webEditorExtensions } from '../web/extensions.js';
function EmbeddedDatabase({ node }: NodeViewProps) {
  useLocale();
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
export const richEditorExtensions = (pageId = '') => [
  ...editorExtensions().filter(
    (extension) =>
      !['databaseView', 'toggleBlock', 'webPage', 'webComponent', 'webFile'].includes(
        extension.name,
      ),
  ),
  toggleBlock.extend({
    addNodeView: () => ReactNodeViewRenderer(ToggleSection, interactiveNodeView),
  }),
  databaseView.extend({
    addNodeView: () => ReactNodeViewRenderer(EmbeddedDatabase, interactiveNodeView),
  }),
  ...webEditorExtensions(pageId),
];
