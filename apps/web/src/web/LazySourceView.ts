import { t, subscribeLocale } from '../i18n/index.js';
import type { Editor } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import type { EditorView, NodeView } from '@tiptap/pm/view';
import type { SourceView } from './SourceView.js';

/** Plain source is readable immediately; CodeMirror loads only when a file is opened for editing. */
export class LazySourceView implements NodeView {
  readonly dom: HTMLElement;
  private readonly unsubscribeLocale: () => void;
  private delegate: SourceView | null = null;
  private loading = false;
  private destroyed = false;
  private selection: [number, number] | null = null;
  constructor(
    private node: Node,
    private view: EditorView,
    private getPos: () => number | undefined,
    private editor: Editor,
  ) {
    this.dom = document.createElement('div');
    this.dom.className = 'web-file-node';
    this.dom.hidden = true;
    this.dom.contentEditable = 'false';
    this.identify();
    const plain = document.createElement('pre');
    plain.textContent = node.textContent;
    this.dom.append(plain);
    this.dom.addEventListener('note-source-reveal', this.load);
    this.unsubscribeLocale = subscribeLocale(() => {
      const retry = this.dom.querySelector<HTMLButtonElement>('[data-source-retry]');
      if (retry) retry.textContent = t('Retry source editor');
    });
  }
  private identify() {
    this.dom.dataset.sourceFile = this.node.attrs.id ?? this.node.attrs.path;
    this.dom.dataset.sourcePath = this.node.attrs.path;
  }
  private load = () => {
    if (this.destroyed || this.loading) return;
    if (this.delegate) {
      this.delegate.reveal();
      return;
    }
    this.loading = true;
    this.dom.setAttribute('aria-busy', 'true');
    void import('./SourceView.js')
      .then(({ SourceView }) => {
        if (this.destroyed) return;
        this.delegate = new SourceView(this.node, this.view, this.getPos, this.editor);
        this.loading = false;
        this.dom.replaceChildren(this.delegate.dom);
        this.dom.removeAttribute('aria-busy');
        if (this.selection) this.delegate.setSelection(...this.selection);
      })
      .catch(() => {
        if (this.destroyed) return;
        this.loading = false;
        this.dom.removeAttribute('aria-busy');
        const retry = document.createElement('button');
        retry.dataset.sourceRetry = '';
        retry.textContent = t('Retry source editor');
        retry.onclick = () => {
          retry.remove();
          this.load();
        };
        this.dom.append(retry);
      });
  };
  update(node: Node) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.identify();
    if (this.delegate) return this.delegate.update(node);
    this.dom.querySelector('pre')!.textContent = node.textContent;
    return true;
  }
  setSelection(anchor: number, head: number) {
    this.selection = [anchor, head];
    this.delegate?.setSelection(anchor, head);
  }
  stopEvent() {
    return true;
  }
  ignoreMutation() {
    return true;
  }
  destroy() {
    this.destroyed = true;
    this.unsubscribeLocale();
    this.dom.removeEventListener('note-source-reveal', this.load);
    this.delegate?.destroy();
  }
}
