import { ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { webPage, webComponent, webFile } from '@note/editor/web';
import { WebAuthoring } from './WebAuthoring.js';
import { LazySourceView } from './LazySourceView.js';
export function webEditorExtensions(pageId: string) {
  const Root = (props: NodeViewProps) => <WebAuthoring {...props} pageId={pageId} />;
  return [
    webPage.extend({ addNodeView: () => ReactNodeViewRenderer(Root) }),
    webComponent.extend({ addNodeView: () => ReactNodeViewRenderer(Root) }),
    webFile.extend({
      addNodeView: () => (props) =>
        new LazySourceView(props.node, props.view, props.getPos, props.editor),
    }),
  ];
}
