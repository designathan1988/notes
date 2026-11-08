import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { EditorView as ProseMirrorView, NodeView } from '@tiptap/pm/view';
import { undo, redo } from '@tiptap/y-tiptap';
import {
  EditorView,
  keymap,
  lineNumbers,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
} from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import {
  syntaxHighlighting,
  HighlightStyle,
  bracketMatching,
  indentOnInput,
} from '@codemirror/language';
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { tags } from '@lezer/highlight';

const highlighting = HighlightStyle.define([
  { tag: [tags.keyword, tags.tagName, tags.bool, tags.null], class: 'source-keyword' },
  { tag: [tags.string, tags.attributeValue], class: 'source-string' },
  { tag: [tags.comment], class: 'source-comment' },
  { tag: [tags.number, tags.attributeName, tags.propertyName], class: 'source-property' },
]);
function language(path: string) {
  if (/\.html?$/i.test(path)) return html();
  if (/\.css$/i.test(path)) return css();
  if (/\.[cm]?js$/i.test(path)) return javascript();
  return [];
}

/** Editing view only. Every accepted keystroke is a granular transaction on the existing Yjs-bound document. */
export class SourceView implements NodeView {
  readonly dom: HTMLElement;
  private readonly cm: EditorView;
  private readonly access = new Compartment();
  private readonly syntax = new Compartment();
  private readonly attributes = new Compartment();
  private reflecting = false;
  private forwarding = false;
  private destroyed = false;
  private editable: boolean;

  constructor(
    private node: ProseMirrorNode,
    private readonly outer: ProseMirrorView,
    private readonly getPos: () => number | undefined,
    private readonly editor: Editor,
  ) {
    this.dom = document.createElement('section');
    this.dom.className = 'web-source-editor';
    this.dom.dataset.webFile = node.attrs.path;
    this.editable = outer.editable;
    this.cm = new EditorView({
      parent: this.dom,
      doc: node.textContent,
      extensions: [
        lineNumbers(),
        drawSelection(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        syntaxHighlighting(highlighting),
        bracketMatching(),
        indentOnInput(),
        closeBrackets(),
        autocompletion(),
        highlightSelectionMatches(),
        this.syntax.of(language(node.attrs.path)),
        this.attributes.of(this.contentAttributes()),
        this.access.of([
          EditorState.readOnly.of(!this.editable),
          EditorView.editable.of(this.editable),
        ]),
        keymap.of([
          {
            key: 'Mod-z',
            run: () => {
              if (this.outer.editable) undo(this.outer.state);
              return true;
            },
          },
          {
            key: 'Mod-Shift-z',
            run: () => {
              if (this.outer.editable) redo(this.outer.state);
              return true;
            },
          },
          {
            key: 'Mod-y',
            run: () => {
              if (this.outer.editable) redo(this.outer.state);
              return true;
            },
          },
          {
            key: 'Escape',
            run: () => {
              this.dom
                .closest('[data-web-workspace]')
                ?.querySelector<HTMLButtonElement>('.web-file-tabs [aria-selected="true"]')
                ?.focus();
              return true;
            },
          },
          indentWithTab,
          ...closeBracketsKeymap,
          ...completionKeymap,
          ...searchKeymap,
          ...defaultKeymap,
        ]),
        EditorView.updateListener.of((change) => {
          if (
            this.reflecting ||
            this.destroyed ||
            !this.cm.hasFocus ||
            !this.outer.editable ||
            (!change.docChanged && !change.selectionSet)
          )
            return;
          const position = this.getPos();
          if (position === undefined || !this.outer.dom.isConnected) return;
          const origin = position + 1;
          let transaction = this.outer.state.tr,
            shift = 0;
          change.changes.iterChanges((from, to, nextFrom, nextTo, inserted) => {
            transaction = transaction.insertText(
              inserted.toString(),
              origin + from + shift,
              origin + to + shift,
            );
            shift += nextTo - nextFrom - (to - from);
          });
          const selection = change.state.selection.main;
          transaction.setSelection(
            TextSelection.create(
              transaction.doc,
              origin + selection.anchor,
              origin + selection.head,
            ),
          );
          this.forwarding = true;
          try {
            this.outer.dispatch(transaction);
          } finally {
            this.forwarding = false;
          }
        }),
      ],
    });
    this.editor.on('update', this.syncAccess);
  }
  private contentAttributes() {
    return EditorView.contentAttributes.of({
      'aria-label': `${this.node.attrs.path} source`,
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-readonly': String(!this.editable),
      tabindex: '0',
      spellcheck: 'false',
    });
  }
  private syncAccess = () => {
    if (this.destroyed || this.editable === this.outer.editable) return;
    this.editable = this.outer.editable;
    this.cm.dispatch({
      effects: [
        this.access.reconfigure([
          EditorState.readOnly.of(!this.editable),
          EditorView.editable.of(this.editable),
        ]),
        this.attributes.reconfigure(this.contentAttributes()),
      ],
    });
  };
  update(next: ProseMirrorNode) {
    if (next.type !== this.node.type) return false;
    const renamed = next.attrs.path !== this.node.attrs.path;
    this.node = next;
    this.syncAccess();
    if (renamed) {
      this.dom.dataset.webFile = next.attrs.path;
      this.cm.dispatch({
        effects: [
          this.syntax.reconfigure(language(next.attrs.path)),
          this.attributes.reconfigure(this.contentAttributes()),
        ],
      });
    }
    if (this.forwarding) return true;
    const before = this.cm.state.doc.toString(),
      after = next.textContent;
    if (before === after) return true;
    let from = 0,
      oldEnd = before.length,
      newEnd = after.length;
    while (from < oldEnd && from < newEnd && before[from] === after[from]) from++;
    while (oldEnd > from && newEnd > from && before[oldEnd - 1] === after[newEnd - 1]) {
      oldEnd--;
      newEnd--;
    }
    this.reflecting = true;
    try {
      this.cm.dispatch({ changes: { from, to: oldEnd, insert: after.slice(from, newEnd) } });
    } finally {
      this.reflecting = false;
    }
    return true;
  }
  setSelection(anchor: number, head: number) {
    this.reflecting = true;
    try {
      const size = this.cm.state.doc.length;
      this.cm.dispatch({
        selection: {
          anchor: Math.min(size, Math.max(0, anchor)),
          head: Math.min(size, Math.max(0, head)),
        },
      });
      if (this.cm.hasFocus || this.outer.hasFocus()) this.cm.focus();
    } finally {
      this.reflecting = false;
    }
  }
  stopEvent() {
    return true;
  }
  reveal() {
    this.cm.requestMeasure();
  }
  ignoreMutation() {
    return true;
  }
  destroy() {
    this.destroyed = true;
    this.editor.off('update', this.syncAccess);
    this.cm.destroy();
  }
}
