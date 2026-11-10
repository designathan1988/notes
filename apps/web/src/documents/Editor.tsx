import { t, useLocale, formatNumber } from '../i18n/index.js';
import { Select } from '../ui/Select.js';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useEffectEvent,
} from 'react';
import { initProseMirrorDoc } from '@tiptap/y-tiptap';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Link,
  Plus,
  Paperclip,
  Undo2,
  Redo2,
  GripVertical,
  Search,
  LayoutTemplate,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { DocumentSession } from './session.js';
import { useWorkspace } from '../state/store.js';
import { IconButton } from '../ui/IconButton.js';
import { Dialog } from '../ui/Dialog.js';
import type { Page } from '@note/contracts';
import { captureClipboard, fileNode } from './capture.js';
import { safeEmbedSource } from '@note/editor/embeds';
import { LinkPicker } from './LinkPicker.js';
import { BlockSurface } from './BlockSurface.js';
import { RemoteSelection } from './remoteSelection.js';
import { BlockControls } from './BlockControls.js';
import { BlockMarquee } from './BlockMarquee.js';
import { TableTools } from './TableTools.js';
import { DatabasePicker } from './DatabasePicker.js';
import { blockAt } from '@note/editor/blocks';
import { SelectionToolbar } from './SelectionToolbar.js';
import { Templates } from './Templates.js';
import { DocumentFind, FindInPage } from './FindInPage.js';
import { useDocumentProjection } from './useDocumentProjection.js';
import { headingPositions } from '@note/editor/outline';
import { richEditorExtensions } from './richExtensions.js';
import { useUploads, FailedFile } from './useUploads.js';
const CanvasEditor = lazy(() => import('../canvas/CanvasEditor.js'));

/** Top of the line holding the caret, relative to the editor wrapper; null before layout. */
function lineTop(editor: NonNullable<ReturnType<typeof useEditor>>): number | null {
  const wrap = editor.view.dom.closest('.editor-wrap');
  if (!wrap || !editor.view.hasFocus()) return null;
  try {
    return Math.round(
      editor.view.coordsAtPos(editor.state.selection.from).top - wrap.getBoundingClientRect().top,
    );
  } catch {
    return null;
  }
}

export function DocumentEditor({ page, embedded = false }: { page: Page; embedded?: boolean }) {
  const [session, setSession] = useState<DocumentSession | null>(null);
  const [failure, setFailure] = useState('');
  const [attempt, setAttempt] = useState(0);
  // A session starts from the page as it is at that moment; later page edits do not restart it.
  const openSession = useEffectEvent(() => new DocumentSession(page));
  useEffect(() => {
    let active = true;
    setFailure('');
    setSession(null);
    const next = openSession();
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
        <p>{t(failure)}</p>
        <button className="button" onClick={() => setAttempt((value) => value + 1)}>
          {t('Retry document')}
        </button>
      </div>
    );
  return session && page.kind === 'canvas' ? (
    <Suspense fallback={<p className="editor-prompt">{t('Opening canvas…')}</p>}>
      <CanvasEditor session={session} />
    </Suspense>
  ) : session ? (
    <ReadyDocument session={session} embedded={embedded} />
  ) : (
    <p className="editor-prompt">{t('Opening document…')}</p>
  );
}
function ReadyDocument({ session, embedded }: { session: DocumentSession; embedded: boolean }) {
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
  return ready ? (
    <ConnectedEditor session={session} embedded={embedded} />
  ) : (
    <p className="editor-prompt">{t('Opening document…')}</p>
  );
}
function ConnectedEditor({ session, embedded }: { session: DocumentSession; embedded: boolean }) {
  const locale = useLocale();
  const mapping = session.mapping;
  const status = useSyncExternalStore(session.subscribeStatus, session.getStatus);
  const [commands, setCommands] = useState(false);
  const [blockActions, setBlockActions] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [databaseOpen, setDatabaseOpen] = useState<number | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const templateAnchor = useRef<HTMLButtonElement>(null);
  const request = useWorkspace((state) => state.editorRequest);
  const focusMode = useWorkspace((state) => state.focusMode);
  const [pasteMode, setPasteMode] = useState('auto');
  const { uploading, failed, setFailed, upload } = useUploads(session.page.id);
  const fileInput = useRef<HTMLInputElement>(null);
  const editor = useEditor(
    {
      extensions: [
        ...richEditorExtensions(session.page.id),
        BlockSurface,
        DocumentFind,
        Collaboration.configure({ document: session.doc, ySyncOptions: { mapping } }),
        RemoteSelection,
        CollaborationCaret.configure({
          provider: session.provider,
          user: { name: useWorkspace.getState().user?.name, color: '#5865e8' },
        }),
        Placeholder.configure({
          placeholder: ({ node }) =>
            node.type.name === 'toggleTitle'
              ? t('Toggle heading')
              : t('Write something, or type / for commands…'),
        }),
      ],
      editable: !session.readOnly,
      onBeforeCreate: ({ editor }) => {
        const initial = initProseMirrorDoc(session.doc.getXmlFragment('default'), editor.schema);
        mapping.clear();
        for (const [type, node] of initial.mapping) mapping.set(type, node);
        editor.setOptions({ content: initial.doc.toJSON() });
      },
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
          'aria-label': t('Page content'),
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
            const id = target.dataset.pageLink ?? target.dataset.wikiLink ?? null;
            if (event.ctrlKey || event.metaKey) useWorkspace.getState().openTab(id);
            else useWorkspace.getState().navigate(id);
            return true;
          }
          return false;
        },
        handleKeyDown: (view, event) => {
          if (
            (event.ctrlKey || event.metaKey) &&
            !event.altKey &&
            !event.shiftKey &&
            event.key.toLowerCase() === 'f'
          ) {
            event.preventDefault();
            setFindOpen(true);
            return true;
          }
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
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: {
          class: 'note-editor',
          'aria-label': t('Page content'),
          role: 'textbox',
          'aria-multiline': 'true',
          spellcheck: 'false',
        },
      },
    });
  }, [editor, locale]);
  const statistics = useDocumentProjection(editor, session.page.id);
  useEffect(() => {
    if (!editor || request?.pageId !== session.page.id) return;
    if (typeof request.command === 'object') {
      const position = headingPositions(editor.state.doc)[request.command.heading];
      const target = position === undefined ? null : editor.view.nodeDOM(position);
      if (target instanceof HTMLElement)
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (request.command === 'find') setFindOpen(true);
    else if (request.command === 'link' && editor.isEditable) setLinkOpen(true);
    else if (request.command === 'templates' && editor.isEditable) setTemplatesOpen(true);
    if (useWorkspace.getState().editorRequest === request)
      useWorkspace.getState().clearEditorRequest();
  }, [request, editor, session]);
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
            website: editor.state.doc.firstChild?.type.name === 'webPage',
            // The block toolbar sits beside the line being edited, not fixed below the page.
            // A text selection has its own toolbar, so this one steps aside.
            selecting: !editor.state.selection.empty,
            line: lineTop(editor),
          }
        : null,
  });
  useEffect(() => {
    if (editor) {
      session.setReadOnly(role === 'viewer');
      editor.setEditable(!session.readOnly);
    }
  }, [role, editor, session]);
  if (!editor) return null;
  return (
    <div className="editor-wrap">
      <div className="document-utilities">
        {embedded && (
          <span data-document-status role="status" aria-label={t('Record document status')}>
            {t(
              {
                connecting: 'Connecting…',
                saving: 'Saving…',
                saved: 'Saved',
                local: 'Saved on this device',
                error: 'Save failed',
                'read-only': 'Read only',
              }[status],
            )}
          </span>
        )}
        <span
          role="status"
          data-document-statistics
          aria-label={t('Document statistics')}
          title={t('{{value1}} characters · {{minutes}} min read', {
            value1: formatNumber(statistics.characters),
            minutes: statistics.minutes,
          })}
        >
          {t(statistics.words === 1 ? '{{count}} word' : '{{count}} words', {
            count: formatNumber(statistics.words),
          })}
          <span className="statistics-reading">
            {' '}
            · {t('{{count}} min read', { count: formatNumber(statistics.minutes) })}
          </span>
        </span>
        <IconButton label={t('Find in page')} onClick={() => setFindOpen(true)}>
          <Search />
        </IconButton>
        {!session.readOnly && (
          <button
            ref={templateAnchor}
            className="icon-button"
            aria-label={t('Insert template')}
            title={t('Insert template')}
            onClick={() => setTemplatesOpen((value) => !value)}
          >
            <LayoutTemplate />
          </button>
        )}
        <IconButton
          label={focusMode ? t('Leave focus mode') : t('Enter focus mode')}
          onClick={() => useWorkspace.getState().toggleFocusMode()}
        >
          {focusMode ? <Minimize2 /> : <Maximize2 />}
        </IconButton>
      </div>
      {findOpen && <FindInPage editor={editor} close={() => setFindOpen(false)} />}
      {templatesOpen && !session.readOnly && (
        <Templates
          editor={editor}
          anchor={templateAnchor.current}
          close={() => setTemplatesOpen(false)}
        />
      )}
      <EditorContent editor={editor} />
      {!session.readOnly && !formatting?.website && (
        <SelectionToolbar editor={editor} pageId={session.page.id} link={() => setLinkOpen(true)} />
      )}
      {!session.readOnly && !formatting?.website && <BlockMarquee editor={editor} />}
      {!session.readOnly && !formatting?.website && (
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
          database={() =>
            setDatabaseOpen(
              blockAt(editor.state.doc, editor.state.selection.from)?.to ??
                editor.state.doc.content.size,
            )
          }
        />
      )}
      {uploading > 0 && (
        <p className="upload-status" role="status">
          {t(
            uploading === 1
              ? 'Uploading {{count}} file… Keep this tab open.'
              : 'Uploading {{count}} files… Keep this tab open.',
            { count: formatNumber(uploading) },
          )}
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
        aria-label={t('Choose attachments')}
        onChange={(event) => {
          for (const file of [...(event.target.files ?? [])])
            void upload(file)
              .then((result) => editor.chain().focus().insertContent(fileNode(result)).run())
              .catch(useWorkspace.getState().setError);
          event.target.value = '';
        }}
      />
      {!session.readOnly && (
        <div
          className="document-tools"
          role="toolbar"
          aria-label={t('Document formatting')}
          data-anchored={formatting?.line === null ? undefined : ''}
          data-selecting={formatting?.selecting || undefined}
          style={
            formatting?.line === null || formatting?.line === undefined
              ? undefined
              : { top: formatting.line < 48 ? formatting.line + 32 : formatting.line - 46 }
          }
        >
          <IconButton
            data-block-actions
            label={t('Block actions')}
            onClick={() => setBlockActions(true)}
          >
            <GripVertical />
          </IconButton>
          <IconButton label={t('Insert block')} onClick={() => setCommands(true)}>
            <Plus />
          </IconButton>
          <span className="tool-divider" />
          <IconButton
            label={t('Bold')}
            aria-pressed={formatting?.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold />
          </IconButton>
          <IconButton
            label={t('Italic')}
            aria-pressed={formatting?.italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic />
          </IconButton>
          <IconButton label={t('Insert link')} onClick={() => setLinkOpen(true)}>
            <Link />
          </IconButton>
          <IconButton label={t('Add attachment')} onClick={() => fileInput.current?.click()}>
            <Paperclip />
          </IconButton>
          <TableTools editor={editor} />
          <IconButton
            label={t('Undo')}
            disabled={!formatting?.undo}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 />
          </IconButton>
          <IconButton
            label={t('Redo')}
            disabled={!formatting?.redo}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 />
          </IconButton>
          <span className="desktop-tool">
            <Select
              aria-label={t('Paste mode')}
              value={pasteMode}
              onChange={(event) => setPasteMode(event.target.value)}
            >
              <option value="auto">{t('Auto paste')}</option>
              <option value="text">{t('Plain text')}</option>
              <option value="markdown">{t('Markdown')}</option>
              <option value="code">{t('Code')}</option>
            </Select>
          </span>
        </div>
      )}
      {linkOpen && <LinkPicker editor={editor} close={() => setLinkOpen(false)} />}
      {databaseOpen !== null && (
        <DatabasePicker
          editor={editor}
          pageId={session.page.id}
          position={databaseOpen}
          close={() => setDatabaseOpen(null)}
        />
      )}
      {embedOpen && (
        <Dialog title={t('Embed a video')} onClose={() => setEmbedOpen(false)}>
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
                  attrs: { url, title: String(data.get('title') || t('Embedded video')) },
                })
                .run();
              setEmbedOpen(false);
            }}
          >
            <label>
              {t('Video URL')}
              <input type="url" name="url" required placeholder={'https://…'} />
            </label>
            <label>
              {t('Title')}
              <input name="title" placeholder={t('Embedded video')} />
            </label>
            <button className="button primary">{t('Insert video')}</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
