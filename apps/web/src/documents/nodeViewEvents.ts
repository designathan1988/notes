/**
 * Node views render real controls (buttons, links, inputs) inside the document. Tiptap's default
 * stopEvent only checks the event target's own tag, so a click on the icon *inside* a button
 * reaches ProseMirror, which then tries to select the node — and throws if the click also
 * navigates away. Decide by the nearest interactive ancestor instead.
 */
const INTERACTIVE =
  'button, a[href], input, select, textarea, label, summary, [role="button"], [role="menuitem"], [role="tab"], [role="checkbox"], [contenteditable="true"]';
const EDITABLE_CONTENT = '[data-node-view-content], [data-node-view-content-react]';
const EDITOR_OWNED = /^(drag|drop|copy|cut|paste)/;

export function stopsEditorEvent(event: Event): boolean {
  if (EDITOR_OWNED.test(event.type)) return false;
  const target = event.target as Element | null;
  if (!target || typeof target.closest !== 'function') return false;
  if (target.closest(EDITABLE_CONTENT)) return false;
  return !!target.closest(INTERACTIVE);
}

/** Options for ReactNodeViewRenderer on node views that contain interactive UI. */
export const interactiveNodeView = {
  stopEvent: ({ event }: { event: Event }) => stopsEditorEvent(event),
};
