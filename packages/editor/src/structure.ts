import { Mark, Node, mergeAttributes } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

export const toggleBlock = Node.create({
  name: 'toggleBlock',
  group: 'block',
  content: 'toggleTitle toggleContent',
  defining: true,
  addAttributes() {
    return {
      collapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-collapsed') === 'true',
      },
    };
  },
  parseHTML() {
    return [{ tag: 'section[data-toggle-block]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'section',
      mergeAttributes(HTMLAttributes, {
        'data-toggle-block': '',
        'data-collapsed': String(node.attrs.collapsed),
        class: 'toggle-block',
      }),
      0,
    ];
  },
});
export const toggleTitle = Node.create({
  name: 'toggleTitle',
  content: 'inline*',
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-toggle-title]' }];
  },
  renderHTML() {
    return ['div', { 'data-toggle-title': '', class: 'toggle-title' }, 0];
  },
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state, view } = this.editor,
          { $from, empty } = state.selection;
        if (!empty || $from.parent.type.name !== 'toggleTitle') return false;
        const parent = $from.before($from.depth - 1),
          title = $from.before();
        const body = title + $from.parent.nodeSize;
        const tr = state.tr.setNodeMarkup(parent, undefined, {
          ...state.doc.nodeAt(parent)?.attrs,
          collapsed: false,
        });
        tr.setSelection(TextSelection.near(tr.doc.resolve(body + 1))).scrollIntoView();
        view.dispatch(tr);
        return true;
      },
    };
  },
});
export const toggleContent = Node.create({
  name: 'toggleContent',
  content: 'block+',
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-toggle-content]' }];
  },
  renderHTML() {
    return ['div', { 'data-toggle-content': '', class: 'toggle-content' }, 0];
  },
});
export const highlight = Mark.create({
  name: 'highlight',
  parseHTML() {
    return [{ tag: 'mark' }];
  },
  renderHTML() {
    return ['mark', { class: 'text-highlight' }, 0];
  },
  addKeyboardShortcuts() {
    return { 'Mod-Shift-h': () => this.editor.commands.toggleMark('highlight') };
  },
});
