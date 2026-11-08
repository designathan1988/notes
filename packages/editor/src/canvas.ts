import { Node, type JSONContent } from '@tiptap/core';

const geometry = () =>
  Object.fromEntries(
    Object.entries({
      id: '',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      z: 0,
      groupId: null,
      color: 'neutral',
    }).map(([name, value]) => [name, { default: value }]),
  );
export const canvasRoot = Node.create({
  name: 'canvasRoot',
  content: '(canvasCard | canvasGroup | canvasEdge)*',
  isolating: true,
  defining: true,
  selectable: false,
  parseHTML: () => [{ tag: 'section[data-canvas-root]' }],
  renderHTML: () => ['section', { 'data-canvas-root': '', class: 'canvas-root' }, 0],
});
export const canvasCard = Node.create({
  name: 'canvasCard',
  content: 'block+',
  isolating: true,
  defining: true,
  addAttributes: geometry,
  parseHTML: () => [{ tag: 'article[data-canvas-card]' }],
  renderHTML: ({ node }) => [
    'article',
    { 'data-canvas-card': node.attrs.id, class: 'canvas-card' },
    0,
  ],
});
export const canvasGroup = Node.create({
  name: 'canvasGroup',
  content: 'text*',
  marks: '',
  isolating: true,
  addAttributes: geometry,
  parseHTML: () => [{ tag: 'div[data-canvas-group]' }],
  renderHTML: ({ node }) => [
    'div',
    { 'data-canvas-group': node.attrs.id, class: 'canvas-group' },
    0,
  ],
});
export const canvasEdge = Node.create({
  name: 'canvasEdge',
  content: 'text*',
  marks: '',
  isolating: true,
  addAttributes: () =>
    Object.fromEntries(
      Object.entries({
        id: '',
        fromNode: '',
        toNode: '',
        fromSide: 'auto',
        toSide: 'auto',
        fromEnd: 'none',
        toEnd: 'arrow',
        color: 'neutral',
      }).map(([name, value]) => [name, { default: value }]),
    ),
  parseHTML: () => [{ tag: 'div[data-canvas-edge]' }],
  renderHTML: ({ node }) => ['div', { 'data-canvas-edge': node.attrs.id, class: 'canvas-edge' }, 0],
});
export const canvasExtensions = () => [canvasRoot, canvasCard, canvasGroup, canvasEdge];
export const emptyCanvas: JSONContent = { type: 'doc', content: [{ type: 'canvasRoot' }] };
export const isCanvas = (content: JSONContent) =>
  content.type === 'doc' &&
  content.content?.length === 1 &&
  content.content[0].type === 'canvasRoot';
/** Canvas shape semantics supplement the ProseMirror grammar; they never own another body. */
export const MAX_CANVAS_ELEMENTS = 2000;
export const canvasColors = ['neutral', 'blue', 'green', 'amber', 'rose', 'violet'] as const;
const idPattern = /^[\w-]{1,128}$/u;
export function validateCanvas(content: JSONContent) {
  if (!isCanvas(content)) return;
  const items = content.content![0].content ?? [];
  if (items.length > MAX_CANVAS_ELEMENTS) throw new Error('This canvas has too many elements.');
  const all = new Map<string, JSONContent>(),
    groups = new Map<string, string | null>();
  const validId = (value: unknown) => typeof value === 'string' && idPattern.test(value);
  const finite = (value: unknown, max: number) =>
    typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= max;
  for (const item of items) {
    const attrs = item.attrs!;
    if (!validId(attrs.id) || all.has(attrs.id))
      throw new Error('Canvas element IDs must be unique.');
    all.set(attrs.id, item);
    if (
      !canvasColors.includes(attrs.color) &&
      !(typeof attrs.color === 'string' && /^#[0-9a-f]{6}$/iu.test(attrs.color))
    )
      throw new Error('Unsupported canvas color.');
    if (item.type === 'canvasEdge') {
      if (
        !validId(attrs.fromNode) ||
        !validId(attrs.toNode) ||
        !['auto', 'top', 'right', 'bottom', 'left'].includes(attrs.fromSide) ||
        !['auto', 'top', 'right', 'bottom', 'left'].includes(attrs.toSide) ||
        !['none', 'arrow'].includes(attrs.fromEnd) ||
        !['none', 'arrow'].includes(attrs.toEnd)
      )
        throw new Error('Invalid canvas connection.');
    } else {
      if (
        !finite(attrs.x, 1e6) ||
        !finite(attrs.y, 1e6) ||
        !finite(attrs.z, 1e6) ||
        !finite(attrs.width, 20000) ||
        attrs.width <= 0 ||
        !finite(attrs.height, 20000) ||
        attrs.height <= 0 ||
        (attrs.groupId != null && !validId(attrs.groupId))
      )
        throw new Error('Invalid canvas geometry or group.');
      if (item.type === 'canvasGroup') groups.set(attrs.id, attrs.groupId ?? null);
    }
    if (
      item.type !== 'canvasCard' &&
      (item.content ?? []).reduce((sum, child) => sum + (child.text?.length ?? 0), 0) > 1000
    )
      throw new Error('Canvas labels support up to 1,000 characters.');
  }
  for (const item of items) {
    const attrs = item.attrs!;
    if (item.type === 'canvasEdge') {
      for (const endpoint of [attrs.fromNode, attrs.toNode])
        if (!all.has(endpoint) || all.get(endpoint)!.type === 'canvasEdge')
          throw new Error('A canvas connection endpoint is missing.');
    } else if (attrs.groupId != null && !groups.has(attrs.groupId))
      throw new Error('Canvas elements must reference an existing group.');
  }
  for (const id of groups.keys()) {
    const seen = new Set<string>();
    let current: string | null = id;
    while (current !== null) {
      if (seen.has(current)) throw new Error('Canvas groups cannot contain a cycle.');
      seen.add(current);
      current = groups.get(current) ?? null;
    }
  }
}
