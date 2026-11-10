/**
 * The visual Document: a page made of sections and blocks that people arrange and style
 * directly. This model is the source of truth; `renderVisual` turns it into the HTML and CSS
 * the Document publishes, so what is edited is what is exported.
 */
export type BlockType =
  'heading' | 'text' | 'button' | 'image' | 'quote' | 'list' | 'divider' | 'spacer' | 'columns';
export type Align = 'left' | 'center' | 'right';
export interface BlockStyle {
  align?: Align;
  size?: number;
  weight?: number;
  color?: string;
  background?: string;
  padding?: number;
  radius?: number;
  width?: number;
  space?: number;
}
export interface Block {
  id: string;
  type: BlockType;
  text?: string;
  level?: 1 | 2 | 3;
  href?: string;
  src?: string;
  alt?: string;
  items?: string[];
  height?: number;
  columns?: Block[][];
  style: BlockStyle;
}
export interface SectionStyle {
  background?: string;
  color?: string;
  padding?: number;
  width?: 'narrow' | 'normal' | 'wide' | 'full';
  align?: Align;
}
export interface Section {
  id: string;
  blocks: Block[];
  style: SectionStyle;
}
export interface Theme {
  font: 'sans' | 'serif' | 'mono';
  accent: string;
  background: string;
  text: string;
  radius: number;
}
export interface VisualDocument {
  version: 1;
  theme: Theme;
  sections: Section[];
}

export const VISUAL_FILE = 'document.json';
const fonts: Record<Theme['font'], string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "SF Mono", Consolas, monospace',
};
const widths: Record<NonNullable<SectionStyle['width']>, string> = {
  narrow: '680px',
  normal: '920px',
  wide: '1180px',
  full: '100%',
};
const color = (value: unknown): string | undefined =>
  typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value) ? value : undefined;
const within = (value: unknown, min: number, max: number): number | undefined =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : undefined;
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const lines = (text = '') => escape(text).replace(/\n/g, '<br>');
/** Links and images accept web addresses and site-relative paths, never scripts. */
export const safeUrl = (value = ''): string =>
  /^(https?:\/\/|mailto:|tel:|#|\.{0,2}\/|[\w.-]+\/)/i.test(value.trim()) ? value.trim() : '';

let counter = 0;
export const newId = (): string =>
  `v${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function newBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case 'heading':
      return { id, type, text: 'A clear heading', level: 2, style: {} };
    case 'text':
      return { id, type, text: 'Write something worth reading.', style: {} };
    case 'button':
      return { id, type, text: 'Call to action', href: '#', style: {} };
    case 'image':
      return { id, type, src: '', alt: '', style: { radius: 12 } };
    case 'quote':
      return { id, type, text: 'A sentence people will remember.', style: {} };
    case 'list':
      return { id, type, items: ['First point', 'Second point', 'Third point'], style: {} };
    case 'divider':
      return { id, type, style: {} };
    case 'spacer':
      return { id, type, height: 48, style: {} };
    case 'columns':
      return {
        id,
        type,
        columns: [
          [newBlock('heading'), newBlock('text')],
          [newBlock('heading'), newBlock('text')],
        ],
        style: {},
      };
  }
}
export const newSection = (blocks: Block[] = [newBlock('heading'), newBlock('text')]): Section => ({
  id: newId(),
  blocks,
  style: {},
});
const with_ = (block: Block, patch: Partial<Block>): Block => ({ ...block, ...patch });

/** Ready-made sections: starting points people restyle instead of blank pages. */
export const sectionPresets: Record<string, () => Section> = {
  Hero: () => ({
    id: newId(),
    style: { padding: 112, align: 'center', width: 'normal' },
    blocks: [
      with_(newBlock('heading'), { text: 'Say the one thing that matters', level: 1 }),
      with_(newBlock('text'), {
        text: 'A short line that tells people why they should keep reading.',
        style: { size: 20 },
      }),
      with_(newBlock('button'), { text: 'Get started' }),
    ],
  }),
  Features: () => ({
    id: newId(),
    style: { padding: 80, width: 'wide' },
    blocks: [
      with_(newBlock('heading'), { text: 'What you get', style: { align: 'center' } }),
      {
        id: newId(),
        type: 'columns',
        style: { space: 24 },
        columns: ['Clear', 'Connected', 'Yours'].map((title) => [
          with_(newBlock('heading'), { text: title, level: 3 }),
          with_(newBlock('text'), { text: 'Explain this benefit in one or two sentences.' }),
        ]),
      },
    ],
  }),
  'Text and image': () => ({
    id: newId(),
    style: { padding: 80, width: 'wide' },
    blocks: [
      {
        id: newId(),
        type: 'columns',
        style: {},
        columns: [
          [
            with_(newBlock('heading'), { text: 'Show and tell' }),
            with_(newBlock('text'), {
              text: 'Put the explanation beside the picture it describes.',
            }),
          ],
          [newBlock('image')],
        ],
      },
    ],
  }),
  Quote: () => ({
    id: newId(),
    style: { padding: 96, align: 'center', width: 'narrow' },
    blocks: [newBlock('quote')],
  }),
  'Call to action': () => ({
    id: newId(),
    style: { padding: 88, align: 'center', background: '#16151d', color: '#f4f3f8' },
    blocks: [
      with_(newBlock('heading'), { text: 'Ready when you are' }),
      with_(newBlock('button'), { text: 'Start now' }),
    ],
  }),
  Blank: () => newSection([newBlock('text')]),
};

export function newVisualDocument(): VisualDocument {
  return {
    version: 1,
    theme: { font: 'sans', accent: '#4f46d8', background: '#ffffff', text: '#1c1b18', radius: 10 },
    sections: [sectionPresets.Hero()],
  };
}

/** Starter text is written in English; the editor passes its translator to localize it. */
export function localizeVisual<T extends VisualDocument | Section | Block>(
  value: T,
  translate: (text: string) => string,
): T {
  const block = (item: Block): Block => ({
    ...item,
    text: item.text === undefined ? undefined : translate(item.text),
    items: item.items?.map(translate),
    columns: item.columns?.map((column) => column.map(block)),
  });
  const section = (item: Section): Section => ({ ...item, blocks: item.blocks.map(block) });
  if ('sections' in value) return { ...value, sections: value.sections.map(section) } as T;
  if ('blocks' in value) return section(value) as T;
  return block(value) as T;
}

/** Reads stored JSON defensively: unknown or damaged input never becomes markup. */
export function parseVisual(text: string): VisualDocument | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || (raw as VisualDocument).version !== 1) return null;
  const input = raw as VisualDocument;
  const types: BlockType[] = [
    'heading',
    'text',
    'button',
    'image',
    'quote',
    'list',
    'divider',
    'spacer',
    'columns',
  ];
  const block = (value: Block, depth: number): Block | null => {
    if (!value || typeof value !== 'object' || !types.includes(value.type)) return null;
    const style = value.style && typeof value.style === 'object' ? value.style : {};
    return {
      id: typeof value.id === 'string' && /^[\w-]{1,40}$/.test(value.id) ? value.id : newId(),
      type: value.type,
      text: typeof value.text === 'string' ? value.text.slice(0, 20000) : undefined,
      level: [1, 2, 3].includes(value.level as number) ? value.level : undefined,
      href: typeof value.href === 'string' ? safeUrl(value.href) : undefined,
      src: typeof value.src === 'string' ? safeUrl(value.src) : undefined,
      alt: typeof value.alt === 'string' ? value.alt.slice(0, 500) : undefined,
      items: Array.isArray(value.items)
        ? value.items.filter((item) => typeof item === 'string').slice(0, 100)
        : undefined,
      height: within(value.height, 4, 400),
      columns:
        value.type === 'columns' && depth === 0 && Array.isArray(value.columns)
          ? value.columns
              .slice(0, 4)
              .map((column) =>
                (Array.isArray(column) ? column : [])
                  .map((child) => block(child, 1))
                  .filter((child): child is Block => !!child),
              )
          : undefined,
      style: {
        align: (['left', 'center', 'right'] as const).find((a) => a === style.align),
        size: within(style.size, 10, 120),
        weight: within(style.weight, 300, 800),
        color: color(style.color),
        background: color(style.background),
        padding: within(style.padding, 0, 96),
        radius: within(style.radius, 0, 64),
        width: within(style.width, 10, 100),
        space: within(style.space, 0, 96),
      },
    };
  };
  const theme = input.theme && typeof input.theme === 'object' ? input.theme : ({} as Theme);
  return {
    version: 1,
    theme: {
      font: (['sans', 'serif', 'mono'] as const).find((f) => f === theme.font) ?? 'sans',
      accent: color(theme.accent) ?? '#4f46d8',
      background: color(theme.background) ?? '#ffffff',
      text: color(theme.text) ?? '#1c1b18',
      radius: within(theme.radius, 0, 32) ?? 10,
    },
    sections: (Array.isArray(input.sections) ? input.sections : []).slice(0, 200).map((section) => {
      const style = section?.style && typeof section.style === 'object' ? section.style : {};
      return {
        id:
          typeof section?.id === 'string' && /^[\w-]{1,40}$/.test(section.id)
            ? section.id
            : newId(),
        blocks: (Array.isArray(section?.blocks) ? section.blocks : [])
          .map((child) => block(child, 0))
          .filter((child): child is Block => !!child),
        style: {
          background: color(style.background),
          color: color(style.color),
          padding: within(style.padding, 0, 240),
          width: (['narrow', 'normal', 'wide', 'full'] as const).find((w) => w === style.width),
          align: (['left', 'center', 'right'] as const).find((a) => a === style.align),
        },
      };
    }),
  };
}

const declarations = (pairs: [string, string | number | undefined][]) =>
  pairs
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([name, value]) => `${name}:${value}`)
    .join(';');

/** CSS for one block; the same rules style the editor canvas and the published page. */
export function blockCss(block: Block, scope = ''): string {
  const s = block.style;
  const rule = declarations([
    ['text-align', s.align],
    ['font-size', s.size ? `${s.size}px` : undefined],
    ['font-weight', s.weight],
    ['color', s.color],
    ['background', s.background],
    ['padding', s.padding !== undefined ? `${s.padding}px` : undefined],
    ['border-radius', s.radius !== undefined ? `${s.radius}px` : undefined],
    ['margin-top', s.space !== undefined ? `${s.space}px` : undefined],
  ]);
  const own = rule ? `${scope}.b-${block.id}{${rule}}` : '';
  const media =
    block.type === 'image' && s.width ? `${scope}.b-${block.id} img{width:${s.width}%}` : '';
  const children = (block.columns ?? []).flat().map((child) => blockCss(child, scope));
  return [own, media, ...children].filter(Boolean).join('\n');
}
export function sectionCss(section: Section, scope = ''): string {
  const s = section.style;
  const rule = declarations([
    ['background', s.background],
    ['color', s.color],
    ['padding-block', s.padding !== undefined ? `${s.padding}px` : undefined],
    ['text-align', s.align],
  ]);
  const inner = s.width ? `${scope}.s-${section.id}>.wrap{max-width:${widths[s.width]}}` : '';
  return [rule ? `${scope}.s-${section.id}{${rule}}` : '', inner]
    .concat(section.blocks.map((block) => blockCss(block, scope)))
    .filter(Boolean)
    .join('\n');
}
/** The base stylesheet: type scale, rhythm and components, driven by the theme. */
export function baseCss(theme: Theme, scope = ''): string {
  const root = scope || 'body';
  return `${root}{margin:0;background:${theme.background};color:${theme.text};font-family:${fonts[theme.font]};font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased}
${scope}section{padding-block:72px}
${scope}.wrap{box-sizing:border-box;max-width:920px;margin:0 auto;padding-inline:24px}
${scope}.wrap>*+*{margin-top:18px}
${scope}h1,${scope}h2,${scope}h3{margin:0;line-height:1.12;letter-spacing:-0.02em;font-weight:650}
${scope}h1{font-size:clamp(2.4rem,5vw,3.6rem)}
${scope}h2{font-size:clamp(1.7rem,3.2vw,2.3rem)}
${scope}h3{font-size:1.25rem}
${scope}p{margin:0}
${scope}.button{display:inline-block;padding:12px 22px;border-radius:${theme.radius}px;background:${theme.accent};color:#fff;font-weight:600;text-decoration:none;transition:transform .18s ease,filter .18s ease}
${scope}.button:hover{filter:brightness(1.08);transform:translateY(-1px)}
${scope}blockquote{margin:0;font-size:1.5rem;line-height:1.4;font-weight:500;letter-spacing:-0.01em}
${scope}ul{display:inline-block;margin:0;padding-left:1.2em;text-align:left}
${scope}li+li{margin-top:6px}
${scope}hr{border:0;border-top:1px solid color-mix(in srgb,currentColor 16%,transparent)}
${scope}.media img{display:block;max-width:100%;height:auto;border-radius:inherit;margin-inline:auto}
${scope}.media.empty{aspect-ratio:16/9;border-radius:${theme.radius}px;background:color-mix(in srgb,currentColor 7%,transparent)}
${scope}.columns{display:grid;gap:32px;grid-template-columns:repeat(var(--cols),minmax(0,1fr));align-items:start}
${scope}.columns>div>*+*{margin-top:14px}
@media (max-width:720px){${scope}.columns{grid-template-columns:1fr}${scope}section{padding-block:48px}}`;
}

function blockHtml(block: Block): string {
  const cls = `b-${block.id}`;
  switch (block.type) {
    case 'heading': {
      const tag = `h${block.level ?? 2}`;
      return `<${tag} class="${cls}">${lines(block.text)}</${tag}>`;
    }
    case 'text':
      return `<p class="${cls}">${lines(block.text)}</p>`;
    case 'button':
      return `<p class="${cls}"><a class="button" href="${escape(safeUrl(block.href) || '#')}">${lines(block.text)}</a></p>`;
    case 'image':
      return block.src && safeUrl(block.src)
        ? `<div class="media ${cls}"><img src="${escape(safeUrl(block.src))}" alt="${escape(block.alt ?? '')}"></div>`
        : `<div class="media empty ${cls}"></div>`;
    case 'quote':
      return `<blockquote class="${cls}">${lines(block.text)}</blockquote>`;
    case 'list':
      return `<ul class="${cls}">${(block.items ?? []).map((item) => `<li>${lines(item)}</li>`).join('')}</ul>`;
    case 'divider':
      return `<hr class="${cls}">`;
    case 'spacer':
      return `<div class="${cls}" style="height:${block.height ?? 48}px" aria-hidden="true"></div>`;
    case 'columns':
      return `<div class="columns ${cls}" style="--cols:${(block.columns ?? []).length || 1}">${(
        block.columns ?? []
      )
        .map((column) => `<div>${column.map(blockHtml).join('')}</div>`)
        .join('')}</div>`;
  }
}

/**
 * The published page: one HTML file and one stylesheet, with no editor code in them. The page
 * also loads main.js, the Document's own script (empty until its author writes one), so code
 * written in the Code view runs in the preview and the export.
 */
export function renderVisual(document: VisualDocument, title = ''): { html: string; css: string } {
  const body = document.sections
    .map(
      (section) =>
        `<section class="s-${section.id}"><div class="wrap">${section.blocks.map(blockHtml).join('')}</div></section>`,
    )
    .join('\n');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title>
<link rel="stylesheet" href="./styles.css">
<script type="module" src="./main.js"></script>
</head>
<body>
${body}
</body>
</html>
`;
  const css = [baseCss(document.theme), ...document.sections.map((section) => sectionCss(section))]
    .filter(Boolean)
    .join('\n');
  return { html, css: css + '\n' };
}

// ---- pure edits: every change returns a new document, so undo and collaboration stay simple ----
type Path = { section: number; block: number; column?: number; child?: number };
export function findBlock(document: VisualDocument, id: string): (Path & { value: Block }) | null {
  for (const [section, value] of document.sections.entries())
    for (const [block, item] of value.blocks.entries()) {
      if (item.id === id) return { section, block, value: item };
      for (const [column, children] of (item.columns ?? []).entries())
        for (const [child, nested] of children.entries())
          if (nested.id === id) return { section, block, column, child, value: nested };
    }
  return null;
}
const mapBlocks = (document: VisualDocument, fn: (blocks: Block[]) => Block[]): VisualDocument => ({
  ...document,
  sections: document.sections.map((section) => ({
    ...section,
    blocks: fn(section.blocks).map((block) =>
      block.columns ? { ...block, columns: block.columns.map((column) => fn(column)) } : block,
    ),
  })),
});
export const updateBlock = (document: VisualDocument, id: string, patch: Partial<Block>) =>
  mapBlocks(document, (blocks) =>
    blocks.map((block) =>
      block.id === id
        ? { ...block, ...patch, style: { ...block.style, ...(patch.style ?? {}) } }
        : block,
    ),
  );
export const removeBlock = (document: VisualDocument, id: string) =>
  mapBlocks(document, (blocks) => blocks.filter((block) => block.id !== id));
const clone = (block: Block): Block => ({
  ...block,
  id: newId(),
  style: { ...block.style },
  columns: block.columns?.map((column) => column.map(clone)),
});
export const duplicateBlock = (document: VisualDocument, id: string) =>
  mapBlocks(document, (blocks) =>
    blocks.flatMap((block) => (block.id === id ? [block, clone(block)] : [block])),
  );
export const moveBlock = (document: VisualDocument, id: string, delta: -1 | 1) =>
  mapBlocks(document, (blocks) => {
    const index = blocks.findIndex((block) => block.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= blocks.length) return blocks;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
/** Inserts after the block with `afterId`, or at the start of a section when it is null. */
export function insertBlock(
  document: VisualDocument,
  sectionId: string,
  afterId: string | null,
  block: Block,
): VisualDocument {
  if (afterId)
    return mapBlocks(document, (blocks) =>
      blocks.flatMap((item) => (item.id === afterId ? [item, block] : [item])),
    );
  return {
    ...document,
    sections: document.sections.map((section) =>
      section.id === sectionId ? { ...section, blocks: [block, ...section.blocks] } : section,
    ),
  };
}
export const updateSection = (document: VisualDocument, id: string, style: SectionStyle) => ({
  ...document,
  sections: document.sections.map((section) =>
    section.id === id ? { ...section, style: { ...section.style, ...style } } : section,
  ),
});
export const removeSection = (document: VisualDocument, id: string) => ({
  ...document,
  sections: document.sections.filter((section) => section.id !== id),
});
export function moveSection(document: VisualDocument, id: string, delta: -1 | 1): VisualDocument {
  const index = document.sections.findIndex((section) => section.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= document.sections.length) return document;
  const sections = [...document.sections];
  [sections[index], sections[target]] = [sections[target], sections[index]];
  return { ...document, sections };
}
export function insertSection(
  document: VisualDocument,
  afterId: string | null,
  section: Section,
): VisualDocument {
  const index = afterId ? document.sections.findIndex((item) => item.id === afterId) + 1 : 0;
  const sections = [...document.sections];
  sections.splice(index, 0, section);
  return { ...document, sections };
}
/** Moves a top-level block to a position in any section (drag and drop). */
export function moveBlockTo(
  document: VisualDocument,
  id: string,
  sectionId: string,
  index: number,
): VisualDocument {
  const found = findBlock(document, id);
  if (!found || found.column !== undefined) return document;
  const without = document.sections.map((section) => ({
    ...section,
    blocks: section.blocks.filter((block) => block.id !== id),
  }));
  const sameSection = document.sections[found.section].id === sectionId;
  const at = sameSection && found.block < index ? index - 1 : index;
  return {
    ...document,
    sections: without.map((section) => {
      if (section.id !== sectionId) return section;
      const blocks = [...section.blocks];
      blocks.splice(Math.max(0, Math.min(at, blocks.length)), 0, found.value);
      return { ...section, blocks };
    }),
  };
}
