import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { getRelativeSelection, ySyncPluginKey } from '@tiptap/y-tiptap';
import type { Transaction as YTransaction } from 'yjs';

type ObservedView = EditorView & {
  domObserver?: {
    flush(): void;
    currentSelection: { eq(range: unknown): boolean };
  };
  domSelectionRange?(): unknown;
};
type Binding = Parameters<typeof getRelativeSelection>[0] & {
  doc: {
    on(event: string, f: (t: YTransaction) => void): void;
    off(event: string, f: (t: YTransaction) => void): void;
  };
  beforeTransactionSelection: unknown;
};

/**
 * A click or a navigation key moves the browser caret first; ProseMirror reads it a moment
 * later on `selectionchange`. When a collaborator's change arrives in that gap, the Yjs binding
 * restores the editor's previous selection and the caret jumps back. Before a remote change is
 * applied, read the pending browser caret so the binding keeps where the person actually is.
 */
export function syncPendingSelection(view: ObservedView, binding: Binding, origin: unknown) {
  if (origin === ySyncPluginKey || !view.hasFocus()) return false;
  const observer = view.domObserver;
  const range = view.domSelectionRange?.();
  if (!observer || !range || observer.currentSelection.eq(range)) return false;
  observer.flush();
  binding.beforeTransactionSelection = getRelativeSelection(binding, view.state);
  return true;
}

export const RemoteSelection = Extension.create({
  name: 'remoteSelection',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        view(view) {
          let attached: Binding | null = null;
          const listener = (transaction: YTransaction) =>
            attached && syncPendingSelection(view as ObservedView, attached, transaction.origin);
          const attach = () => {
            const binding = (
              ySyncPluginKey.getState(view.state) as { binding?: Binding } | undefined
            )?.binding;
            if (!binding || binding === attached) return;
            attached?.doc.off('beforeTransaction', listener);
            attached = binding;
            // Runs after the binding recorded its selection and before remote changes apply.
            binding.doc.on('beforeTransaction', listener);
          };
          attach();
          // A collaborator's caret moving redraws decorations, which also rewrites the browser
          // caret from the editor's (possibly stale) selection. Read the pending caret first.
          const observed = view as ObservedView;
          const dispatch = view.dispatch.bind(view);
          view.dispatch = (transaction) => {
            const range = observed.domSelectionRange?.();
            if (
              !transaction.docChanged &&
              !transaction.selectionSet &&
              view.hasFocus() &&
              observed.domObserver &&
              range &&
              !observed.domObserver.currentSelection.eq(range)
            ) {
              const before = view.state;
              observed.domObserver.flush();
              if (view.state !== before) {
                // The flush moved the selection: replay the same intent on the new state.
                const replay = view.state.tr;
                const meta = (transaction as unknown as { meta: Record<string, unknown> }).meta;
                for (const [key, value] of Object.entries(meta)) replay.setMeta(key, value);
                dispatch(replay);
                return;
              }
            }
            dispatch(transaction);
          };
          return {
            update: attach,
            destroy: () => attached?.doc.off('beforeTransaction', listener),
          };
        },
      }),
    ];
  },
});
