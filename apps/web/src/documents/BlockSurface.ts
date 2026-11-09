import { Extension } from '@tiptap/core';
import { Plugin, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { blockAt } from '@note/editor/blocks';
import {
  BlockRangeSelection,
  blocksInRange,
  duplicateBlocks,
  extendBlockSelection,
  moveBlocks,
  selectBlocks,
} from '@note/editor/block-selection';

// The editor document owns blocks. Decorations only expose their structure in the UI.
export const BlockSurface = Extension.create({
  name: 'blockSurface',
  addKeyboardShortcuts() {
    const run = (transaction: ReturnType<typeof selectBlocks>) => {
      if (!transaction) return false;
      this.editor.view.dispatch(transaction);
      return true;
    };
    const blockSelected = () => this.editor.state.selection instanceof BlockRangeSelection;
    // Move the selected blocks, or the block holding the caret while keeping the caret in place.
    const move = (direction: -1 | 1) => {
      const { state } = this.editor;
      if (blockSelected()) return run(moveBlocks(state, direction)) || true;
      const block = blockAt(state.doc, state.selection.from);
      const transaction = block && moveBlocks(state, direction);
      if (!block || !transaction) return true;
      const target = transaction.selection.from;
      const offset = state.selection.from - block.from;
      return run(
        transaction.setSelection(TextSelection.near(transaction.doc.resolve(target + offset))),
      );
    };
    const covered = () => blocksInRange(this.editor.state.selection);
    return {
      // Escape lifts the caret into a block selection; a second Escape leaves the document.
      Escape: () => {
        const { state, view } = this.editor;
        if (blockSelected()) {
          const last = covered().at(-1)!;
          let end = 0;
          for (let i = 0; i <= last; i++) end += state.doc.child(i).nodeSize;
          view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(end - 1), -1)));
          const host = view.dom.parentElement?.closest<HTMLElement>('[tabindex]');
          if (host) host.focus();
          else view.dom.blur();
          return true;
        }
        const from = blockAt(state.doc, state.selection.from),
          to = blockAt(state.doc, Math.max(state.selection.from, state.selection.to - 1));
        return from && to ? run(selectBlocks(state, from.index, to.index)) : false;
      },
      // At the first or last block the selection stays as it is instead of falling back to text.
      'Shift-ArrowUp': () =>
        blockSelected() && (run(extendBlockSelection(this.editor.state, -1)) || true),
      'Shift-ArrowDown': () =>
        blockSelected() && (run(extendBlockSelection(this.editor.state, 1)) || true),
      ArrowUp: () => {
        if (!blockSelected()) return false;
        const target = Math.max(0, covered()[0]! - 1);
        return run(selectBlocks(this.editor.state, target, target));
      },
      ArrowDown: () => {
        if (!blockSelected()) return false;
        const target = Math.min(this.editor.state.doc.childCount - 1, covered().at(-1)! + 1);
        return run(selectBlocks(this.editor.state, target, target));
      },
      'Mod-Shift-ArrowUp': () => move(-1),
      'Mod-Shift-ArrowDown': () => move(1),
      'Mod-d': () => blockSelected() && run(duplicateBlocks(this.editor.state)),
      Enter: () => {
        if (!blockSelected()) return false;
        const { state } = this.editor;
        const last = covered().at(-1)!;
        let end = 0;
        for (let i = 0; i <= last; i++) end += state.doc.child(i).nodeSize;
        return run(state.tr.setSelection(TextSelection.near(state.doc.resolve(end - 1), -1)));
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const selected = new Set(blocksInRange(state.selection));
            const active = selected.size ? null : blockAt(state.doc, state.selection.from);
            const decorations: Decoration[] = [];
            let index = 0;
            state.doc.forEach((node, position) => {
              decorations.push(
                Decoration.node(position, position + node.nodeSize, {
                  'data-content-block': node.type.name,
                  ...(selected.has(index) ? { 'data-block-selected': '' } : {}),
                  class: `content-block${active?.from === position ? ' is-active' : ''}`,
                }),
              );
              index++;
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
