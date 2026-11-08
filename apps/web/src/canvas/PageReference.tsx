import { useEffect } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { FileText, ArrowUpRight, RefreshCw } from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import { pageView } from '../workbench/route.js';
export function CanvasPageReference({ node }: NodeViewProps) {
  const id = String(node.attrs.targetId),
    identity = useWorkspace((state) => state.user?.id),
    workspace = useWorkspace((state) => state.workspaceId);
  const version = useWorkspace((state) => state.knowledgeVersion),
    load = useWorkspace((state) => state.loadPageReference);
  const reference = useWorkspace((state) => state.references[`${identity}:${workspace}:${id}`]);
  useEffect(() => {
    void load(id);
  }, [id, identity, workspace, version, load]);
  const ready = reference?.status === 'ready',
    title = ready
      ? reference.page.title
      : reference?.status === 'unavailable'
        ? 'Unavailable page'
        : reference?.status === 'error'
          ? 'Could not load page'
          : 'Loading linked page…';
  return (
    <NodeViewWrapper className="canvas-page-reference" contentEditable={false} data-spatial-control>
      <FileText />
      <strong>
        {node.attrs.label && node.attrs.label !== 'Linked page' ? node.attrs.label : title}
      </strong>
      <small>Linked page</small>
      {ready && (
        <button
          onClick={(event) => {
            if (event.ctrlKey || event.metaKey)
              useWorkspace.getState().openTab(id, pageView(reference.page.kind));
            else useWorkspace.getState().navigate(id, pageView(reference.page.kind));
          }}
        >
          <ArrowUpRight />
          Open page
        </button>
      )}
      {reference?.status === 'error' && (
        <button onClick={() => void load(id)}>
          <RefreshCw />
          Retry
        </button>
      )}
    </NodeViewWrapper>
  );
}
