import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { blockAt } from '../../../../packages/editor/src/blocks.js';

// The editor document owns blocks. Decorations only expose their structure in the UI.
export const BlockSurface = Extension.create({
  name: 'blockSurface',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const active = blockAt(state.doc, state.selection.from);
            const decorations: Decoration[] = [];
            state.doc.forEach((node, position) =>
              decorations.push(
                Decoration.node(position, position + node.nodeSize, {
                  'data-content-block': node.type.name,
                  class: `content-block${active?.from === position ? ' is-active' : ''}`,
                }),
              ),
            );
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
