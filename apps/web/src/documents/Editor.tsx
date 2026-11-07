import { useEffect, useRef, useState } from 'react';
import {
  EditorContent,
  useEditor,
  useEditorState,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Link, Plus, Paperclip, Undo2, Redo2, GripVertical } from 'lucide-react';
import {
  editorExtensions,
  projectDocument,
  databaseView,
} from '../../../../packages/editor/src/schema.js';
import { DocumentSession } from './session.js';
import { useWorkspace } from '../state/store.js';
import { IconButton } from '../ui/IconButton.js';
import { Dialog } from '../ui/Dialog.js';
import type { Page } from '../../../../packages/contracts/src/index.js';
import {
  captureClipboard,
  uploadFile,
  fileNode,
  UploadError,
  type CapturedFile,
} from './capture.js';
import { safeEmbedSource } from '../../../../packages/editor/src/embeds.js';
import { DatabaseView } from '../databases/DatabaseView.js';
import { LinkPicker } from './LinkPicker.js';
import { BlockSurface } from './BlockSurface.js';
import { BlockControls } from './BlockControls.js';
import { TableTools } from './TableTools.js';
import { DatabasePicker } from './DatabasePicker.js';

export function DocumentEditor({ page }: { page: Page }) {
  const [session, setSession] = useState<DocumentSession | null>(null);
  const [failure, setFailure] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailure('');
    setSession(null);
    const next = new DocumentSession(page);
    void next
      .start()
      .then(() => {
        if (active && !next.destroyed) setSession(next);
      })
      .catch((error) => {
        if (active) setFailure(error.message);
        void next.destroy();
      });
    return () => {
      active = false;
      void next.destroy();
    };
  }, [page.id, page.generation, attempt]);
  useEffect(() => {
    if (session && !session.destroyed) session.provider.sendStateless('checkpoint');
  }, [page.updatedAt, session]);
  if (failure)
    return (
      <div className="editor-error" role="alert">
        <p>{failure}</p>
        <button className="button" onClick={() => setAttempt((value) => value + 1)}>
          Retry document
        </button>
      </div>
    );
  return session ? (
    <ConnectedEditor session={session} />
  ) : (
    <p className="editor-prompt">Opening document…</p>
  );
}
function ConnectedEditor({ session }: { session: DocumentSession }) {
  const [commands, setCommands] = useState(false);
  const [blockActions, setBlockActions] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [databaseOpen, setDatabaseOpen] = useState(false);
  const [pasteMode, setPasteMode] = useState('auto');
  const [uploading, setUploading] = useState(0);
  const [failed, setFailed] = useState<{ file: File; id?: string }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  async function upload(file: File, existingId?: string): Promise<CapturedFile> {
    setUploading((count) => count + 1);
    try {
      return await uploadFile(session.page.id, file, existingId);
    } catch (error) {
      setFailed((files) => [
        ...files,
        { file, id: error instanceof UploadError ? error.attachmentId : existingId },
      ]);
      throw error;
    } finally {
      setUploading((count) => count - 1);
    }
  }
  const editor = useEditor(
    {
      extensions: [
        ...editorExtensions().filter((extension) => extension.name !== 'databaseView'),
        BlockSurface,
        databaseView.extend({
          addNodeView() {
            return ReactNodeViewRenderer(EmbeddedDatabase);
          },
        }),
        Collaboration.configure({ document: session.doc }),
        CollaborationCaret.configure({
          provider: session.provider,
          user: { name: useWorkspace.getState().user?.name, color: '#5865e8' },
        }),
        Placeholder.configure({ placeholder: 'Write something, or type / for commands…' }),
      ],
      editable: !session.readOnly,
      enableContentCheck: true,
      onContentError: () =>
        useWorkspace
          .getState()
          .setError(
            'This document contains unsupported content. Export a recovery copy before continuing.',
          ),
      editorProps: {
        attributes: {
          class: 'note-editor',
          'aria-label': 'Page content',
          role: 'textbox',
          'aria-multiline': 'true',
          spellcheck: 'false',
        },
        handleClick: (_view, _position, event) => {
          const target = (event.target as HTMLElement).closest<HTMLElement>(
            '[data-page-link],[data-wiki-link]',
          );
          if (target) {
            event.preventDefault();
            useWorkspace
              .getState()
              .navigate(target.dataset.pageLink ?? target.dataset.wikiLink ?? null);
            return true;
          }
          return false;
        },
        handleKeyDown: (view, event) => {
          if (
            event.key === '/' &&
            view.state.selection.$from.parent.type.name === 'paragraph' &&
            view.state.selection.$from.parent.textContent === ''
          ) {
            event.preventDefault();
            setCommands(true);
            return true;
          }
          return false;
        },
        handlePaste: (_view, event) => {
          if (!event.clipboardData) return false;
          const input = {
            text: event.clipboardData.getData('text/plain'),
            html: event.clipboardData.getData('text/html'),
            files: [...event.clipboardData.files],
            mode: editor?.isActive('codeBlock') ? 'code' : pasteMode,
          };
          event.preventDefault();
          if (editor)
            void captureClipboard(editor, input, upload, useWorkspace.getState().setError).catch(
              useWorkspace.getState().setError,
            );
          return true;
        },
        handleDrop: (_view, event) => {
          const files = [...(event.dataTransfer?.files ?? [])];
          if (!files.length) return false;
          event.preventDefault();
          for (const file of files)
            void upload(file)
              .then((result) => editor?.chain().focus().insertContent(fileNode(result)).run())
              .catch(useWorkspace.getState().setError);
          return true;
        },
      },
    },
    [session],
  );
  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const projection = projectDocument(editor.getJSON());
      useWorkspace.setState({ outline: projection.headings, linkedPageIds: projection.links });
    };
    update();
    editor.on('update', update);
    return () => {
      editor.off('update', update);
    };
  }, [editor]);
  const role = useWorkspace(
    (state) => state.workspaces.find((item) => item.id === state.workspaceId)?.role,
  );
  const formatting = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive('bold'),
            italic: editor.isActive('italic'),
            undo: editor.can().undo(),
            redo: editor.can().redo(),
          }
        : null,
  });
  useEffect(() => {
    if (editor) {
      session.readOnly = role === 'viewer';
      editor.setEditable(!session.readOnly);
      if (session.readOnly) useWorkspace.setState({ saveStatus: 'read-only' });
    }
  }, [role, editor, session]);
  if (!editor) return null;
  return (
    <div className="editor-wrap">
      <EditorContent editor={editor} />
      {!session.readOnly && (
        <BlockControls
          editor={editor}
          requested={commands}
          actionsRequested={blockActions}
          reset={() => {
            setCommands(false);
            setBlockActions(false);
          }}
          attachment={() => fileInput.current?.click()}
          embed={() => setEmbedOpen(true)}
          link={() => setLinkOpen(true)}
          database={() => setDatabaseOpen(true)}
        />
      )}
      {uploading > 0 && (
        <p className="upload-status" role="status">
          Uploading {uploading} {uploading === 1 ? 'file' : 'files'}… Keep this tab open.
        </p>
      )}
      {failed.map((failure, index) => (
        <FailedFile
          key={index}
          file={failure.file}
          retry={() => {
            setFailed((files) => files.filter((_, i) => i !== index));
            void upload(failure.file, failure.id)
              .then((result) => editor.chain().focus().insertContent(fileNode(result)).run())
              .catch(useWorkspace.getState().setError);
          }}
        />
      ))}
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        aria-label="Choose attachments"
        onChange={(event) => {
          for (const file of [...(event.target.files ?? [])])
            void upload(file)
              .then((result) => editor.chain().focus().insertContent(fileNode(result)).run())
              .catch(useWorkspace.getState().setError);
          event.target.value = '';
        }}
      />
      {!session.readOnly && (
        <div className="document-tools" role="toolbar" aria-label="Document formatting">
          <IconButton label="Block actions" onClick={() => setBlockActions(true)}>
            <GripVertical />
          </IconButton>
          <IconButton label="Insert block" onClick={() => setCommands(true)}>
            <Plus />
          </IconButton>
          <span className="tool-divider" />
          <IconButton
            label="Bold"
            aria-pressed={formatting?.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold />
          </IconButton>
          <IconButton
            label="Italic"
            aria-pressed={formatting?.italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic />
          </IconButton>
          <IconButton label="Insert link" onClick={() => setLinkOpen(true)}>
            <Link />
          </IconButton>
          <IconButton label="Add attachment" onClick={() => fileInput.current?.click()}>
            <Paperclip />
          </IconButton>
          <TableTools editor={editor} />
          <IconButton
            label="Undo"
            disabled={!formatting?.undo}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 />
          </IconButton>
          <IconButton
            label="Redo"
            disabled={!formatting?.redo}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 />
          </IconButton>
          <span className="desktop-tool">
            <select
              aria-label="Paste mode"
              value={pasteMode}
              onChange={(event) => setPasteMode(event.target.value)}
            >
              <option value="auto">Auto paste</option>
              <option value="text">Plain text</option>
              <option value="markdown">Markdown</option>
              <option value="code">Code</option>
            </select>
          </span>
        </div>
      )}
      {linkOpen && <LinkPicker editor={editor} close={() => setLinkOpen(false)} />}
      {databaseOpen && (
        <DatabasePicker
          editor={editor}
          pageId={session.page.id}
          close={() => setDatabaseOpen(false)}
        />
      )}
      {embedOpen && (
        <Dialog title="Embed a video" onClose={() => setEmbedOpen(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const url = String(data.get('url'));
              if (!safeEmbedSource(url)) {
                useWorkspace.getState().setError('Use a YouTube or Vimeo video URL.');
                return;
              }
              editor
                .chain()
                .focus()
                .insertContent({
                  type: 'embed',
                  attrs: { url, title: String(data.get('title') || 'Embedded video') },
                })
                .run();
              setEmbedOpen(false);
            }}
          >
            <label>
              Video URL
              <input type="url" name="url" required placeholder="https://…" />
            </label>
            <label>
              Title
              <input name="title" placeholder="Embedded video" />
            </label>
            <button className="button primary">Insert video</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
function EmbeddedDatabase({ node }: NodeViewProps) {
  return (
    <NodeViewWrapper className="embedded-database">
      <DatabaseView id={String(node.attrs.databaseId)} compact />
    </NodeViewWrapper>
  );
}
function FailedFile({ file, retry }: { file: File; retry(): void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return (
    <div className="upload-failure">
      <span>Upload failed: {file.name}</span>
      <button onClick={retry}>Retry</button>
      <a download={file.name} href={url}>
        Save original
      </a>
    </div>
  );
}
