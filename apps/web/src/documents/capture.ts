import type { Editor, JSONContent } from '@tiptap/core';
import { marked } from 'marked';
import { api, json } from '../state/api.js';
import { classifyPaste } from './paste-policy.js';
import { MAX_FILE_BYTES } from '@note/contracts';
export interface CapturedFile {
  id: string;
  filename: string;
  mediaType: string;
}
export class UploadError extends Error {
  constructor(
    message: string,
    readonly attachmentId: string,
  ) {
    super(message);
  }
}
export async function uploadFile(
  pageId: string,
  file: File,
  existingId?: string,
): Promise<CapturedFile> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Files must be 25 MiB or smaller.');
  const attachment = existingId
    ? { id: existingId }
    : await api<CapturedFile>(`/pages/${pageId}/attachments`, {
        method: 'POST',
        body: json({
          filename: file.name,
          mediaType: file.type || 'application/octet-stream',
          size: file.size,
        }),
      });
  try {
    const response = await fetch(`/api/attachments/${attachment.id}/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Note-Request': '1' },
      body: file,
      credentials: 'same-origin',
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.message ?? 'Upload failed. Keep this tab open and retry.');
    return result;
  } catch (error) {
    throw new UploadError(
      error instanceof Error ? error.message : 'Upload failed. Keep the original and retry.',
      attachment.id,
    );
  }
}
export const fileNode = (file: CapturedFile, caption = '') => ({
  type: 'attachment',
  attrs: { ...file, caption },
});
export interface ClipboardContent {
  text: string;
  html: string;
  files: File[];
  mode?: string;
}
export type ClipboardInserter = (content: string | JSONContent, fullWhitespace?: boolean) => void;
export async function captureClipboard(
  editor: Editor,
  input: ClipboardContent,
  upload: (file: File) => Promise<CapturedFile>,
  notify: (message: string) => void,
  insert?: ClipboardInserter,
) {
  const put: ClipboardInserter =
    insert ??
    ((content, fullWhitespace) => {
      editor
        .chain()
        .focus()
        .insertContent(
          content,
          fullWhitespace ? { parseOptions: { preserveWhitespace: 'full' } } : undefined,
        )
        .run();
    });
  if (input.files.length) {
    for (const file of input.files) {
      try {
        const result = await upload(file);
        put(fileNode(result));
      } catch (error) {
        notify(
          error instanceof Error
            ? error.message
            : 'A captured file could not be uploaded. Its original is available to retry.',
        );
      }
    }
    return;
  }
  const policy = classifyPaste(input);
  if (policy.mode === 'code') {
    put({
      type: 'codeBlock',
      attrs: { language: input.text.trim().startsWith('{') ? 'json' : null },
      content: input.text ? [{ type: 'text', text: input.text }] : [],
    });
    return;
  }
  if (policy.mode === 'text') {
    const wrapper = document.createElement('div');
    for (const line of input.text.split('\n')) {
      const p = document.createElement('p');
      p.textContent = line;
      wrapper.append(p);
    }
    put(wrapper.innerHTML, true);
    return;
  }
  let html =
    policy.mode === 'markdown'
      ? (marked.parse(input.text, { async: false, gfm: true }) as string)
      : input.html;
  if (policy.mode === 'table') {
    const table = document.createElement('table');
    for (const line of input.text.trimEnd().split('\n')) {
      const row = table.insertRow();
      for (const value of line.split('\t')) row.insertCell().textContent = value;
    }
    html = table.outerHTML;
  }
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const allowed = new Set([
    'P',
    'BR',
    'DIV',
    'SPAN',
    'SECTION',
    'MARK',
    'STRONG',
    'B',
    'EM',
    'I',
    'S',
    'U',
    'DEL',
    'A',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'BLOCKQUOTE',
    'PRE',
    'CODE',
    'UL',
    'OL',
    'LI',
    'TABLE',
    'THEAD',
    'TBODY',
    'TR',
    'TH',
    'TD',
    'HR',
    'FIGURE',
    'FIGCAPTION',
  ]);
  let preserve = policy.preserveOriginal;
  for (const element of [...parsed.body.querySelectorAll('*')]) {
    if (element.tagName === 'IMG' && element.getAttribute('src')?.startsWith('data:image/')) {
      try {
        const blob = await (await fetch(element.getAttribute('src')!)).blob();
        const file = await upload(new File([blob], 'Pasted image', { type: blob.type }));
        const figure = parsed.createElement('figure');
        figure.dataset.attachment = file.id;
        figure.dataset.mediaType = file.mediaType;
        figure.dataset.filename = file.filename;
        element.replaceWith(figure);
        continue;
      } catch {
        preserve = true;
      }
    }
    if (!allowed.has(element.tagName)) {
      preserve = true;
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED'].includes(element.tagName))
        element.remove();
      else element.replaceWith(...element.childNodes);
      continue;
    }
    for (const attribute of [...element.attributes]) {
      if (
        attribute.name === 'class' &&
        element.tagName === 'CODE' &&
        /^language-[\w-]{1,40}$/.test(attribute.value)
      )
        continue;
      if (
        ![
          'href',
          'colspan',
          'rowspan',
          'data-page-link',
          'data-wiki-link',
          'data-attachment',
          'data-media-type',
          'data-filename',
          'data-toggle-block',
          'data-toggle-title',
          'data-toggle-content',
          'data-collapsed',
        ].includes(attribute.name)
      ) {
        element.removeAttribute(attribute.name);
      }
    }
    if (element.tagName === 'A') {
      const href = element.getAttribute('href') ?? '';
      if (!/^(https?:\/\/|mailto:|#)/i.test(href)) {
        element.removeAttribute('href');
        preserve = true;
      }
    }
  }
  if (parsed.body.innerHTML.trim()) put(parsed.body.innerHTML, true);
  if (preserve) {
    const original = new File(
      [input.html || input.text],
      input.html ? 'Original pasted content.html' : 'Original pasted content.md',
      { type: input.html ? 'text/html' : 'text/markdown' },
    );
    const file = await upload(original);
    put(fileNode(file, 'Original pasted content — preserved as a file'));
    notify(
      'Some elements could not be converted. The available original was preserved as a downloadable file.',
    );
  }
}
