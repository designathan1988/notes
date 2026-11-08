import { useEffect, useMemo, useRef, useState } from 'react';
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Code2, Play, Square, Plus, MoreHorizontal, X, FileCode2, Upload } from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import { IconButton } from '../ui/IconButton.js';
import { Popover } from '../ui/Popover.js';
import { PageHeader } from '../workspace/PageHeader.js';
import { isolatedDocumentEdit } from '../documents/history.js';
import { useUploads, FailedFile } from '../documents/useUploads.js';
import { validWebPath } from '../../../../packages/editor/src/web.js';
import { Preview, type PreviewControls } from './Preview.js';

export function WebAuthoring({ node, editor, getPos, pageId }: NodeViewProps & { pageId: string }) {
  const page = useWorkspace((state) => state.pages.find((page) => page.id === pageId)),
    role = useWorkspace(
      (state) => state.workspaces.find((workspace) => workspace.id === state.workspaceId)?.role,
    );
  const canEdit = !!role && role !== 'viewer',
    fullPage = node.type.name === 'webPage';
  const files = useMemo(() => {
    const result: { id: string; path: string; node: ProseMirrorNode; offset: number }[] = [];
    node.forEach(
      (file, offset) =>
        file.type.name === 'webFile' &&
        result.push({
          id: file.attrs.id ?? file.attrs.path,
          path: file.attrs.path,
          node: file,
          offset,
        }),
    );
    return result;
  }, [node]);
  const [mode, setMode] = useState<'code' | 'split' | 'preview'>(
      canEdit ? (fullPage ? 'split' : 'preview') : 'preview',
    ),
    [active, setActive] = useState(
      () => files.find((file) => file.path === node.attrs.entry)?.id ?? files[0]?.id,
    ),
    [operation, setOperation] = useState<{ kind: 'add' | 'rename'; value: string } | null>(null),
    [error, setError] = useState(''),
    [menu, setMenu] = useState<HTMLElement | null>(null),
    [running, setRunning] = useState(false),
    [runNode, setRunNode] = useState<ProseMirrorNode | null>(null);
  const { uploading, failed, setFailed, upload: uploadAsset } = useUploads(pageId);
  const root = useRef<HTMLElement>(null),
    preview = useRef<PreviewControls>(null),
    operationInput = useRef<HTMLInputElement>(null),
    upload = useRef<HTMLInputElement>(null);
  const selected =
      files.find((file) => file.id === active) ??
      files.find((file) => file.path === node.attrs.entry) ??
      files[0],
    signature = files.map((file) => `${file.id}:${file.path}`).join('|');
  useEffect(() => {
    const parent = root.current;
    if (!parent) return;
    const apply = () => {
      const elements = parent.querySelectorAll<HTMLElement>('.web-file-node');
      for (const element of elements) {
        const visible = mode !== 'preview' && element.dataset.sourceFile === selected?.id;
        const opening = element.hidden;
        element.hidden = !visible;
        if (visible && opening) element.dispatchEvent(new Event('note-source-reveal'));
      }
    };
    const observer = new MutationObserver(() => {
      apply();
    });
    observer.observe(parent.querySelector('[data-node-view-content]') ?? parent, {
      childList: true,
      subtree: true,
    });
    apply();
    const frame = requestAnimationFrame(apply);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [mode, selected?.id, signature]);
  useEffect(() => {
    const narrow = matchMedia('(max-width:700px)');
    const resize = () => {
      if (narrow.matches) setMode((current) => (current === 'split' ? 'code' : current));
    };
    resize();
    narrow.addEventListener('change', resize);
    void preview.current?.run();
    return () => narrow.removeEventListener('change', resize);
  }, []);
  useEffect(() => {
    if (operation) operationInput.current?.focus();
  }, [operation?.kind]);
  function current() {
    const position = getPos();
    if (position === undefined || editor.isDestroyed) throw new Error('This website was removed.');
    const value = editor.state.doc.nodeAt(position);
    if (!value || !['webPage', 'webComponent'].includes(value.type.name))
      throw new Error('This website was removed.');
    return { position, value };
  }
  function edit(work: () => void) {
    if (editor.isDestroyed || !editor.isEditable) return;
    try {
      isolatedDocumentEdit(editor, work);
      setError('');
    } catch (error) {
      setError((error as Error).message);
    }
  }
  function saveFile() {
    if (!operation) return;
    const path = operation.value.trim();
    if (!validWebPath(path)) {
      setError('Use a relative file path such as lib/helpers.js.');
      return;
    }
    edit(() => {
      const { position, value } = current();
      const children: { file: ProseMirrorNode; offset: number }[] = [];
      value.forEach((file, offset) => {
        if (file.type.name === 'webFile') children.push({ file, offset });
      });
      const target = children.find(
        ({ file }) => (file.attrs.id ?? file.attrs.path) === selected?.id,
      );
      if (
        children.some(
          ({ file }) =>
            file.attrs.path === path && (operation.kind === 'add' || file !== target?.file),
        )
      )
        throw new Error('A file already uses this path.');
      const transaction = editor.state.tr;
      if (operation.kind === 'add') {
        const id = crypto.randomUUID();
        transaction.insert(
          position + value.nodeSize - 1,
          editor.schema.nodes.webFile.create({ path, id }),
        );
        setActive(id);
      } else if (target) {
        const id = target.file.attrs.id ?? crypto.randomUUID();
        transaction.setNodeMarkup(position + 1 + target.offset, undefined, {
          ...target.file.attrs,
          id,
          path,
        });
        if (value.attrs.entry === target.file.attrs.path)
          transaction.setNodeMarkup(position, undefined, { ...value.attrs, entry: path });
        setActive(id);
      }
      editor.view.dispatch(transaction);
      setOperation(null);
    });
  }
  function deleteFile() {
    edit(() => {
      const { position, value } = current();
      value.forEach((file, offset) => {
        if (file.type.name !== 'webFile' || (file.attrs.id ?? file.attrs.path) !== selected?.id)
          return;
        if (value.attrs.entry === file.attrs.path)
          throw new Error('Choose another entry file before deleting this file.');
        editor.view.dispatch(
          editor.state.tr.delete(position + 1 + offset, position + 1 + offset + file.nodeSize),
        );
      });
    });
    setMenu(null);
  }
  async function insertMedia(file: File, existingId?: string) {
    const actor = useWorkspace.getState().user?.id,
      workspace = useWorkspace.getState().workspaceId;
    try {
      const asset = await uploadAsset(file, existingId);
      if (
        actor !== useWorkspace.getState().user?.id ||
        workspace !== useWorkspace.getState().workspaceId ||
        editor.isDestroyed
      )
        return;
      edit(() => {
        const { position, value } = current();
        let offset = 0,
          entry: ProseMirrorNode | undefined;
        value.forEach((child, childOffset) => {
          if (child.type.name === 'webFile' && child.attrs.path === value.attrs.entry) {
            offset = childOffset;
            entry = child;
          }
        });
        if (!entry) throw new Error('Choose an HTML entry file before inserting media.');
        const logicalId = crypto.randomUUID(),
          prefix = '../'.repeat(String(value.attrs.entry).split('/').length - 1),
          url = `${prefix}.note/assets/${logicalId}`;
        const label = file.name.replace(
          /[&<>"']/g,
          (character) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
        );
        const snippet = file.type.startsWith('image/')
          ? `\n<img src="${url}" alt="${label}">\n`
          : file.type.startsWith('video/')
            ? `\n<video src="${url}" controls></video>\n`
            : file.type.startsWith('audio/')
              ? `\n<audio src="${url}" controls></audio>\n`
              : `\n<a href="${url}" download>${label}</a>\n`;
        const transaction = editor.state.tr.insert(
          position + value.nodeSize - 1,
          editor.schema.nodes.webAsset.create({ id: logicalId, attachmentId: asset.id }),
        );
        transaction.insertText(snippet, position + 1 + offset + entry.nodeSize - 1);
        editor.view.dispatch(transaction);
        setActive(entry.attrs.id ?? entry.attrs.path);
      });
    } catch (error) {
      if (!editor.isDestroyed) setError((error as Error).message);
    }
  }
  return (
    <NodeViewWrapper
      as="section"
      ref={root}
      className={`web-authoring${fullPage ? ' web-authoring-page' : ' web-authoring-component'}`}
      data-web-workspace=""
      data-web-mode={mode}
      contentEditable={false}
    >
      <div className="web-toolbar">
        {fullPage && page ? (
          <PageHeader page={page} compact />
        ) : (
          <span className="web-component-label">
            <Code2 size={15} />
            Web component
          </span>
        )}
        <div className="web-mode-control" role="group" aria-label="Website view">
          {(['code', 'split', 'preview'] as const).map((view) => (
            <button key={view} aria-pressed={mode === view} onClick={() => setMode(view)}>
              {view[0].toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
        <span className="web-run-state">{runNode && node !== runNode ? 'Source changed' : ''}</span>
        <button
          className="button web-run"
          onClick={() => {
            if (mode === 'code')
              setMode(matchMedia('(max-width:700px)').matches ? 'preview' : 'split');
            void preview.current?.run();
          }}
        >
          <Play size={14} />
          Run
        </button>
        <IconButton
          label="Stop website"
          disabled={!running}
          onClick={() => preview.current?.stop()}
        >
          <Square size={14} />
        </IconButton>
      </div>
      <div
        className="web-workspace"
        style={!fullPage ? { height: `${node.attrs.height}px` } : undefined}
      >
        <section
          className="web-code-pane"
          aria-label="Website source files"
          hidden={mode === 'preview'}
        >
          <div className="web-file-bar">
            <div
              className="web-file-tabs"
              role="tablist"
              aria-label="Website files"
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                const index = files.findIndex((file) => file.id === selected?.id),
                  next =
                    files[
                      (index + (event.key === 'ArrowRight' ? 1 : -1) + files.length) % files.length
                    ];
                if (next) {
                  setActive(next.id);
                  requestAnimationFrame(() =>
                    root.current
                      ?.querySelector<HTMLButtonElement>('.web-file-tabs [aria-selected="true"]')
                      ?.focus(),
                  );
                }
              }}
            >
              {files.map((file) => (
                <button
                  key={file.id}
                  role="tab"
                  aria-selected={selected?.id === file.id}
                  tabIndex={selected?.id === file.id ? 0 : -1}
                  title={file.path}
                  onClick={() => setActive(file.id)}
                >
                  <FileCode2 size={13} />
                  {file.path}
                </button>
              ))}
            </div>
            {canEdit && (
              <>
                <IconButton
                  label="Add source file"
                  onClick={() => {
                    setError('');
                    setOperation({ kind: 'add', value: '' });
                  }}
                >
                  <Plus size={15} />
                </IconButton>
                <IconButton
                  label="Source file actions"
                  onClick={(event) => setMenu(event.currentTarget)}
                >
                  <MoreHorizontal size={16} />
                </IconButton>
              </>
            )}
          </div>
          {operation && (
            <form
              className="web-file-operation"
              onSubmit={(event) => {
                event.preventDefault();
                saveFile();
              }}
            >
              <input
                ref={operationInput}
                aria-label="File path"
                value={operation.value}
                placeholder="lib/helpers.js"
                onChange={(event) => setOperation({ ...operation, value: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.stopPropagation();
                    setOperation(null);
                  }
                }}
              />
              <button className="button" type="submit">
                {operation.kind === 'add' ? 'Add file' : 'Rename'}
              </button>
              <IconButton label="Cancel file operation" onClick={() => setOperation(null)}>
                <X size={14} />
              </IconButton>
            </form>
          )}
          <NodeViewContent className="web-source-files" />
          <footer>
            <span>{selected?.path} · UTF-8 · shared source</span>
            {canEdit && (
              <IconButton
                label="Insert website media"
                disabled={uploading > 0}
                onClick={() => upload.current?.click()}
              >
                <Upload size={14} />
              </IconButton>
            )}
          </footer>
        </section>
        <Preview
          ref={preview}
          editor={editor}
          pageId={pageId}
          getPos={getPos}
          visible={mode !== 'code'}
          onRunning={(value, source) => {
            setRunning(value);
            setRunNode(source ?? null);
          }}
        />
      </div>
      {error && (
        <p className="web-runtime-error" role="alert">
          {error}
        </p>
      )}
      {failed.map((failure, index) => (
        <FailedFile
          key={index}
          file={failure.file}
          retry={() => {
            if (!canEdit) return;
            setFailed((previous) => previous.filter((_, item) => item !== index));
            void insertMedia(failure.file, failure.id);
          }}
        />
      ))}
      <input
        ref={upload}
        type="file"
        hidden
        multiple
        onChange={(event) => {
          const captured = [...(event.target.files ?? [])];
          event.target.value = '';
          if (!captured.length || !editor.isEditable) return;
          void (async () => {
            for (const file of captured) await insertMedia(file);
          })();
        }}
      />
      {menu && (
        <Popover anchor={menu} label="Source file actions" close={() => setMenu(null)}>
          <div className="menu-list">
            <button
              onClick={() => {
                setMenu(null);
                setOperation({ kind: 'rename', value: selected?.path ?? '' });
              }}
            >
              Rename file
            </button>
            <button
              disabled={selected?.path === node.attrs.entry}
              onClick={() => {
                edit(() => {
                  const { position, value } = current();
                  editor.view.dispatch(
                    editor.state.tr.setNodeMarkup(position, undefined, {
                      ...value.attrs,
                      entry: selected?.path,
                    }),
                  );
                });
                setMenu(null);
              }}
            >
              Use as entry file
            </button>
            <button
              className="danger"
              disabled={selected?.path === node.attrs.entry}
              onClick={deleteFile}
            >
              Delete file
            </button>
          </div>
        </Popover>
      )}
    </NodeViewWrapper>
  );
}
