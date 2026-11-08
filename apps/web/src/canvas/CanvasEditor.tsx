import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { EditorContent, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Placeholder from '@tiptap/extension-placeholder';
import { initProseMirrorDoc, type ProsemirrorMapping } from '@tiptap/y-tiptap';
import { documentRoot, pageLink } from '../../../../packages/editor/src/schema.js';
import {
  canvasRoot,
  canvasCard,
  canvasGroup,
  canvasEdge,
} from '../../../../packages/editor/src/canvas.js';
import type { DocumentSession } from '../documents/session.js';
import { richEditorExtensions } from '../documents/richExtensions.js';
import { captureClipboard, fileNode, type ClipboardContent } from '../documents/capture.js';
import { canvasCaptureTarget } from './capture.js';
import type { Point } from '../spatial/geometry.js';
import { useUploads, FailedFile } from '../documents/useUploads.js';
import { useDocumentProjection } from '../documents/useDocumentProjection.js';
import { LinkPicker } from '../documents/LinkPicker.js';
import { SelectionToolbar } from '../documents/SelectionToolbar.js';
import { useWorkspace } from '../state/store.js';
import { CanvasProvider, type CanvasApi } from './context.js';
import { CanvasPageReference } from './PageReference.js';
import { CanvasRootView, CanvasCardView, CanvasGroupView, CanvasEdgeView } from './CanvasViews.js';

export default function CanvasEditor({ session }: { session: DocumentSession }) {
  const subscribe = useCallback(
    (notify: () => void) => {
      session.doc.on('update', notify);
      return () => {
        session.doc.off('update', notify);
      };
    },
    [session],
  );
  const ready = useSyncExternalStore(
    subscribe,
    () => session.doc.getXmlFragment('default').length > 0,
  );
  // Mounting a collaborative editor over an empty fragment would seed a competing root.
  return ready ? (
    <ConnectedCanvasEditor session={session} />
  ) : (
    <p className="editor-prompt" role="status">
      Opening canvas…
    </p>
  );
}

function ConnectedCanvasEditor({ session }: { session: DocumentSession }) {
  const mapping = useMemo<ProsemirrorMapping>(() => new Map(), [session]);
  const page =
    useWorkspace((state) => state.pages.find((page) => page.id === session.page.id)) ??
    session.page;
  const role = useWorkspace(
    (state) => state.workspaces.find((workspace) => workspace.id === state.workspaceId)?.role,
  );
  const readOnly = !role || role === 'viewer',
    api = useRef<CanvasApi | null>(null),
    input = useRef<HTMLInputElement>(null);
  const { upload, failed, setFailed, uploading } = useUploads(page.id);
  const [link, setLink] = useState<'inline' | 'card' | null>(null);
  const request = useWorkspace((state) => state.editorRequest);
  const editor = useEditor(
    {
      extensions: [
        ...richEditorExtensions(session.page.id).filter(
          (extension) =>
            !['doc', 'pageLink', 'canvasRoot', 'canvasCard', 'canvasGroup', 'canvasEdge'].includes(
              extension.name,
            ),
        ),
        pageLink.extend({ addNodeView: () => ReactNodeViewRenderer(CanvasPageReference) }),
        documentRoot.extend({ content: 'canvasRoot' }),
        canvasRoot.extend({ addNodeView: () => ReactNodeViewRenderer(CanvasRootView) }),
        canvasCard.extend({ addNodeView: () => ReactNodeViewRenderer(CanvasCardView) }),
        canvasGroup.extend({ addNodeView: () => ReactNodeViewRenderer(CanvasGroupView) }),
        canvasEdge.extend({ addNodeView: () => ReactNodeViewRenderer(CanvasEdgeView) }),
        Collaboration.configure({ document: session.doc, ySyncOptions: { mapping } }),
        CollaborationCaret.configure({
          provider: session.provider,
          user: { name: useWorkspace.getState().user?.name, color: '#2468c4' },
        }),
        Placeholder.configure({
          placeholder: ({ node }) => (node.type.name === 'paragraph' ? 'Write a note…' : ''),
        }),
      ],
      editable: !readOnly,
      onBeforeCreate: ({ editor }) => {
        const initial = initProseMirrorDoc(session.doc.getXmlFragment('default'), editor.schema);
        mapping.clear();
        for (const [type, node] of initial.mapping) mapping.set(type, node);
        // Seed the local view from the existing shared fragment, without writing another body.
        editor.setOptions({ content: initial.doc.toJSON() });
      },
      enableContentCheck: true,
      onContentError: () =>
        useWorkspace
          .getState()
          .setError(
            'This canvas contains unsupported content. Keep a recovery export before continuing.',
          ),
      editorProps: {
        attributes: {
          class: 'canvas-editor',
          'aria-label': 'Page content',
          role: 'group',
          spellcheck: 'false',
        },
        handleKeyDown: (_view, event) => {
          const handled = api.current?.key(event);
          if (handled) event.preventDefault();
          return !!handled;
        },
        handlePaste: (_view, event) => {
          if (!event.clipboardData || !editor || readOnly) return false;
          event.preventDefault();
          api.current?.preparePaste();
          void captureClipboard(
            editor,
            {
              text: event.clipboardData.getData('text/plain'),
              html: event.clipboardData.getData('text/html'),
              files: [...event.clipboardData.files],
              mode: editor.isActive('codeBlock') ? 'code' : 'auto',
            },
            upload,
            useWorkspace.getState().setError,
          ).catch(useWorkspace.getState().setError);
          return true;
        },
        handleDrop: (_view, event) => {
          const files = [...(event.dataTransfer?.files ?? [])];
          if (!files.length || readOnly) return false;
          event.preventDefault();
          for (const file of files) void insertFile(file);
          return true;
        },
        handleClick: (_view, _pos, event) => {
          const target = (event.target as HTMLElement).closest<HTMLElement>(
            '[data-page-link],[data-wiki-link]',
          );
          if (!target) return false;
          event.preventDefault();
          const id = target.dataset.pageLink ?? target.dataset.wikiLink ?? null;
          if (event.ctrlKey || event.metaKey) useWorkspace.getState().openTab(id);
          else useWorkspace.getState().navigate(id);
          return true;
        },
      },
    },
    [session],
  );
  useDocumentProjection(editor, page.id);
  useEffect(() => {
    if (editor) {
      session.setReadOnly(readOnly);
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly, session]);
  useEffect(() => {
    if (!editor || !api.current || request?.pageId !== page.id) return;
    if (typeof request.command === 'object') api.current.revealHeading(request.command.heading);
    else if (request.command === 'link' && editor.isEditable) setLink('card');
    if (useWorkspace.getState().editorRequest === request)
      useWorkspace.getState().clearEditorRequest();
  }, [request, editor, page.id]);
  if (!editor) return null;
  async function insertFile(file: File, point?: Point, existingId?: string) {
    if (!editor || editor.isDestroyed) return;
    if (!editor.isEditable) {
      setFailed((items) => [...items, { file, id: existingId, label: 'Could not insert' }]);
      return;
    }
    try {
      const asset = await upload(file, existingId);
      if (editor.isDestroyed) return;
      if (!editor.isEditable || !api.current?.addNote(point, [fileNode(asset)], false))
        setFailed((items) => [...items, { file, id: asset.id, label: 'Could not insert' }]);
    } catch (error) {
      useWorkspace.getState().setError(error);
    }
  }
  async function captureStage(input: ClipboardContent, point?: Point) {
    if (!editor || editor.isDestroyed || !editor.isEditable) return;
    if (input.files.length) {
      for (const file of input.files) {
        await insertFile(file, point);
      }
      return;
    }
    if (!input.text && !input.html) return;
    const id = api.current?.addNote(point);
    if (!id) return;
    try {
      await captureClipboard(
        editor,
        input,
        upload,
        useWorkspace.getState().setError,
        canvasCaptureTarget(editor, id),
      );
    } catch (error) {
      if (!editor.isDestroyed)
        setFailed((items) => [
          ...items,
          {
            file: new File(
              [input.html || input.text],
              input.html ? 'Captured source.html' : 'Captured source.txt',
              { type: input.html ? 'text/html' : 'text/plain' },
            ),
            label: 'Could not insert',
          },
        ]);
      useWorkspace.getState().setError(error);
    }
  }
  return (
    <CanvasProvider
      editor={editor}
      page={page}
      readOnly={readOnly}
      api={api}
      media={() => input.current?.click()}
      link={() => setLink('card')}
      capture={(input, point) => {
        void captureStage(input, point);
      }}
    >
      <EditorContent className="canvas-editor-host" editor={editor} />
      {!readOnly && (
        <SelectionToolbar editor={editor} pageId={page.id} link={() => setLink('inline')} />
      )}
      <input
        type="file"
        hidden
        multiple
        ref={input}
        aria-label="Upload canvas media"
        onChange={(event) => {
          for (const file of event.currentTarget.files ?? []) void insertFile(file);
          event.currentTarget.value = '';
        }}
      />
      {uploading > 0 && (
        <p className="canvas-upload-status" role="status">
          Uploading {uploading} {uploading === 1 ? 'file' : 'files'}…
        </p>
      )}
      {failed.map(({ file, id, label }, index) => (
        <FailedFile
          key={index}
          file={file}
          label={label}
          disabled={readOnly}
          retry={() => {
            setFailed((items) => items.filter((_, i) => i !== index));
            void insertFile(file, undefined, id);
          }}
        />
      ))}
      {link && (
        <LinkPicker
          editor={editor}
          close={() => setLink(null)}
          onPage={
            link === 'card'
              ? (id) =>
                  api.current?.addNote(
                    undefined,
                    [{ type: 'pageLink', attrs: { targetId: id, label: 'Linked page' } }],
                    false,
                  )
              : undefined
          }
          onUrl={
            link === 'card'
              ? (url) =>
                  api.current?.addNote(
                    undefined,
                    [
                      {
                        type: 'paragraph',
                        content: [
                          {
                            type: 'text',
                            text: url,
                            marks: [{ type: 'link', attrs: { href: url } }],
                          },
                        ],
                      },
                    ],
                    false,
                  )
              : undefined
          }
        />
      )}
    </CanvasProvider>
  );
}
