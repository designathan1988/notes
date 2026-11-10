import { t } from '../i18n/index.js';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Columns3,
  Copy,
  GripVertical,
  Heading,
  Image as ImageIcon,
  List,
  Minus,
  MousePointerClick,
  MoveVertical,
  Plus,
  Quote,
  Redo2,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react';
import {
  baseCss,
  duplicateBlock,
  findBlock,
  insertBlock,
  insertSection,
  localizeVisual,
  moveBlock,
  moveBlockTo,
  moveSection,
  newBlock,
  removeBlock,
  removeSection,
  sectionCss,
  sectionPresets,
  updateBlock,
  updateSection,
  type Align,
  type Block,
  type BlockStyle,
  type BlockType,
  type Section,
  type VisualDocument,
} from '@note/editor/visual';
import { IconButton } from '../ui/IconButton.js';
import { Select } from '../ui/Select.js';
import './builder.css';

type Selected = { kind: 'block' | 'section'; id: string } | null;
const palette: { type: BlockType; label: string; Icon: typeof Type }[] = [
  { type: 'heading', label: 'Heading', Icon: Heading },
  { type: 'text', label: 'Text', Icon: Type },
  { type: 'button', label: 'Button', Icon: MousePointerClick },
  { type: 'image', label: 'Image', Icon: ImageIcon },
  { type: 'columns', label: 'Columns', Icon: Columns3 },
  { type: 'list', label: 'List', Icon: List },
  { type: 'quote', label: 'Quote', Icon: Quote },
  { type: 'divider', label: 'Divider', Icon: Minus },
  { type: 'spacer', label: 'Spacer', Icon: MoveVertical },
];
const presetLabels = ['Hero', 'Features', 'Text and image', 'Quote', 'Call to action', 'Blank'];

/** The visual editor of a Document: what is on the canvas is what gets published. */
export function VisualBuilder({
  document: model,
  onChange,
  readOnly = false,
}: {
  document: VisualDocument;
  onChange(next: VisualDocument): void;
  readOnly?: boolean;
}) {
  const [selected, setSelected] = useState<Selected>(null);
  const [adding, setAdding] = useState<
    { section: string; after: string | null } | 'section' | null
  >(null);
  const [addSectionAfter, setAddSectionAfter] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; section: string; index: number } | null>(null);
  const history = useRef<{ past: VisualDocument[]; future: VisualDocument[] }>({
    past: [],
    future: [],
  });
  const canvas = useRef<HTMLDivElement>(null);
  const css = useMemo(
    () =>
      [
        baseCss(model.theme, '.vb-page '),
        ...model.sections.map((s) => sectionCss(s, '.vb-page ')),
      ].join('\n'),
    [model],
  );
  const commit = (next: VisualDocument) => {
    if (next === model || readOnly) return;
    history.current.past.push(model);
    if (history.current.past.length > 100) history.current.past.shift();
    history.current.future = [];
    onChange(next);
  };
  const undo = () => {
    const previous = history.current.past.pop();
    if (!previous) return;
    history.current.future.push(model);
    onChange(previous);
  };
  const redo = () => {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(model);
    onChange(next);
  };
  const block = selected?.kind === 'block' ? findBlock(model, selected.id)?.value : undefined;
  const section =
    selected?.kind === 'section'
      ? model.sections.find((item) => item.id === selected.id)
      : undefined;
  useEffect(() => {
    if (selected && !block && !section) setSelected(null);
  }, [selected, block, section]);

  const keys = (event: React.KeyboardEvent) => {
    const typing = (event.target as HTMLElement).closest('[contenteditable="true"],input,textarea');
    if (event.key === 'Escape') {
      if (typing) (event.target as HTMLElement).blur();
      setAdding(null);
      setSelected(null);
      return;
    }
    const mod = event.ctrlKey || event.metaKey;
    // Inside the page's outer editor the browser's own select-all finds nothing in a nested
    // text field, so the builder selects the field's contents itself.
    if (mod && event.key.toLowerCase() === 'a' && typing?.matches('[contenteditable="true"]')) {
      event.preventDefault();
      const range = document.createRange();
      range.selectNodeContents(typing);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    if (typing || readOnly) return;
    if (mod && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    } else if (mod && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redo();
    } else if (block && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      commit(removeBlock(model, block.id));
    } else if (block && mod && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      commit(duplicateBlock(model, block.id));
    }
  };

  // Drag a block by its handle: the drop line follows the pointer and snaps between blocks.
  const startDrag = (id: string, event: React.PointerEvent) => {
    if (readOnly) return;
    event.preventDefault();
    const move = (pointer: PointerEvent) => {
      const sections = [...(canvas.current?.querySelectorAll<HTMLElement>('[data-section]') ?? [])];
      const host =
        sections.find((el) => {
          const box = el.getBoundingClientRect();
          return pointer.clientY >= box.top && pointer.clientY <= box.bottom;
        }) ??
        sections.at(pointer.clientY < (sections[0]?.getBoundingClientRect().top ?? 0) ? 0 : -1);
      if (!host) return;
      const blocks = [...host.querySelectorAll<HTMLElement>(':scope > .wrap > [data-block]')];
      let index = blocks.length;
      for (const [position, el] of blocks.entries()) {
        const box = el.getBoundingClientRect();
        if (pointer.clientY < box.top + box.height / 2) {
          index = position;
          break;
        }
      }
      setDrag({ id, section: host.dataset.section!, index });
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      setDrag((current) => {
        if (current) commit(moveBlockTo(model, current.id, current.section, current.index));
        return null;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

  const editable = (item: Block, field: 'text') =>
    readOnly
      ? {}
      : {
          contentEditable: true,
          suppressContentEditableWarning: true,
          spellCheck: false,
          onBlur: (event: React.FocusEvent<HTMLElement>) => {
            const text = event.currentTarget.innerText.replace(/\n$/, '');
            if (text !== (item[field] ?? ''))
              commit(updateBlock(model, item.id, { [field]: text }));
          },
        };

  const renderBlock = (item: Block, sectionId: string, nested = false): ReactNode => {
    const isSelected = selected?.kind === 'block' && selected.id === item.id;
    const cls = `b-${item.id}`;
    let body: ReactNode;
    switch (item.type) {
      case 'heading': {
        const Tag = `h${item.level ?? 2}` as 'h1';
        body = (
          <Tag className={cls} key={editKey(item)} {...editable(item, 'text')}>
            {item.text}
          </Tag>
        );
        break;
      }
      case 'text':
        body = (
          <p className={cls} key={editKey(item)} {...editable(item, 'text')}>
            {item.text}
          </p>
        );
        break;
      case 'button':
        body = (
          <p className={cls}>
            <span className="button" key={editKey(item)} {...editable(item, 'text')}>
              {item.text}
            </span>
          </p>
        );
        break;
      case 'image':
        body = item.src ? (
          <div className={`media ${cls}`}>
            <img src={item.src} alt={item.alt ?? ''} draggable={false} />
          </div>
        ) : (
          <div className={`media empty ${cls}`}>
            <span className="vb-media-hint">
              <ImageIcon size={20} />
              {t('Add an image address in the panel')}
            </span>
          </div>
        );
        break;
      case 'quote':
        body = (
          <blockquote className={cls} key={editKey(item)} {...editable(item, 'text')}>
            {item.text}
          </blockquote>
        );
        break;
      case 'list':
        body = (
          <ul className={cls}>
            {(item.items ?? []).map((entry, index) => (
              <li key={index}>{entry}</li>
            ))}
          </ul>
        );
        break;
      case 'divider':
        body = <hr className={cls} />;
        break;
      case 'spacer':
        body = <div className={`vb-spacer ${cls}`} style={{ height: item.height ?? 48 }} />;
        break;
      case 'columns':
        body = (
          <div
            className={`columns ${cls}`}
            style={{ '--cols': item.columns?.length || 1 } as React.CSSProperties}
          >
            {(item.columns ?? []).map((column, index) => (
              <div key={index}>{column.map((child) => renderBlock(child, sectionId, true))}</div>
            ))}
          </div>
        );
    }
    return (
      <div
        key={item.id}
        data-block={item.id}
        className={`vb-block${isSelected ? ' selected' : ''}${drag?.id === item.id ? ' dragging' : ''}`}
        onClick={(event) => {
          event.stopPropagation();
          setSelected({ kind: 'block', id: item.id });
        }}
      >
        {body}
        {isSelected && !readOnly && (
          <div className="vb-toolbar" contentEditable={false}>
            {!nested && (
              <button
                className="vb-grip"
                aria-label={t('Drag block')}
                title={t('Drag block')}
                onPointerDown={(event) => startDrag(item.id, event)}
              >
                <GripVertical size={14} />
              </button>
            )}
            <IconButton label={t('Move up')} onClick={() => commit(moveBlock(model, item.id, -1))}>
              <ArrowUp size={14} />
            </IconButton>
            <IconButton label={t('Move down')} onClick={() => commit(moveBlock(model, item.id, 1))}>
              <ArrowDown size={14} />
            </IconButton>
            <IconButton
              label={t('Duplicate')}
              onClick={() => commit(duplicateBlock(model, item.id))}
            >
              <Copy size={14} />
            </IconButton>
            <IconButton label={t('Delete')} onClick={() => commit(removeBlock(model, item.id))}>
              <Trash2 size={14} />
            </IconButton>
          </div>
        )}
        {!nested && !readOnly && (
          <AddLine
            open={adding !== 'section' && adding?.after === item.id}
            onOpen={() => setAdding({ section: sectionId, after: item.id })}
          />
        )}
      </div>
    );
  };

  const addBlock = (type: BlockType) => {
    if (!adding || adding === 'section') return;
    const created = localizeVisual(newBlock(type), (text) => t(text));
    commit(insertBlock(model, adding.section, adding.after, created));
    setAdding(null);
    setSelected({ kind: 'block', id: created.id });
  };

  const insertFromBar = (type: BlockType) => {
    const created = localizeVisual(newBlock(type), (text) => t(text));
    const found = block ? findBlock(model, block.id) : null;
    const host = found ? model.sections[found.section] : (section ?? model.sections.at(-1));
    if (!host) {
      const fresh = { ...sectionPresets.Blank(), blocks: [created] };
      commit(insertSection(model, null, fresh));
    } else {
      const after = found ? host.blocks[found.block].id : (host.blocks.at(-1)?.id ?? null);
      commit(insertBlock(model, host.id, after, created));
    }
    setSelected({ kind: 'block', id: created.id });
    // The new block is where the eye should go: bring it into view once it is drawn.
    requestAnimationFrame(() =>
      document
        .querySelector(`[data-block="${created.id}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    );
  };

  return (
    <div className="visual-builder" onKeyDown={keys} data-readonly={readOnly || undefined}>
      {!readOnly && (
        <div className="vb-bar" role="toolbar" aria-label={t('Insert')}>
          {palette.map(({ type, label, Icon }) => (
            <button key={type} title={t(label)} onClick={() => insertFromBar(type)}>
              <Icon size={15} />
              <span>{t(label)}</span>
            </button>
          ))}
          <i aria-hidden="true" />
          <button
            title={t('Add a section')}
            onClick={() => {
              setAddSectionAfter(section?.id ?? model.sections.at(-1)?.id ?? null);
              setAdding('section');
            }}
          >
            <Plus size={15} />
            <span>{t('Section')}</span>
          </button>
          <span className="vb-bar-spacer" />
          <IconButton label={t('Undo')} disabled={!history.current.past.length} onClick={undo}>
            <Undo2 size={15} />
          </IconButton>
          <IconButton label={t('Redo')} disabled={!history.current.future.length} onClick={redo}>
            <Redo2 size={15} />
          </IconButton>
        </div>
      )}
      <div
        className="vb-stage"
        onClick={() => {
          setSelected(null);
          setAdding(null);
        }}
      >
        <div className="vb-page" ref={canvas} aria-label={t('Document canvas')}>
          <style>{css}</style>
          {model.sections.map((item) => (
            <section
              key={item.id}
              data-section={item.id}
              className={`s-${item.id} vb-section${selected?.kind === 'section' && selected.id === item.id ? ' selected' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                setSelected({ kind: 'section', id: item.id });
                setAdding(null);
              }}
            >
              <div className="wrap">
                {drag?.section === item.id && drag.index === 0 && <div className="vb-drop" />}
                {item.blocks.length === 0 && !readOnly && (
                  <button
                    className="vb-empty"
                    onClick={(event) => {
                      event.stopPropagation();
                      setAdding({ section: item.id, after: null });
                    }}
                  >
                    <Plus size={16} />
                    {t('Add a block')}
                  </button>
                )}
                {item.blocks.map((child, index) => (
                  <Fragmented key={child.id}>
                    {renderBlock(child, item.id)}
                    {drag?.section === item.id && drag.index === index + 1 && (
                      <div className="vb-drop" />
                    )}
                  </Fragmented>
                ))}
              </div>
              {!readOnly && (
                <button
                  className="vb-add-section"
                  onClick={(event) => {
                    event.stopPropagation();
                    setAddSectionAfter(item.id);
                    setAdding('section');
                  }}
                >
                  <Plus size={14} />
                  {t('Section')}
                </button>
              )}
            </section>
          ))}
          {model.sections.length === 0 && !readOnly && (
            <button
              className="vb-empty vb-empty-page"
              onClick={(event) => {
                event.stopPropagation();
                setAddSectionAfter(null);
                setAdding('section');
              }}
            >
              <Plus size={16} />
              {t('Add the first section')}
            </button>
          )}
        </div>
        {adding && (
          <div className="vb-palette" role="menu" onClick={(event) => event.stopPropagation()}>
            <strong>{adding === 'section' ? t('Add a section') : t('Add a block')}</strong>
            <div className="vb-palette-grid">
              {adding === 'section'
                ? presetLabels.map((name) => (
                    <button
                      key={name}
                      role="menuitem"
                      onClick={() => {
                        const created = localizeVisual(sectionPresets[name](), (text) => t(text));
                        commit(insertSection(model, addSectionAfter, created));
                        setAdding(null);
                        setSelected({ kind: 'section', id: created.id });
                      }}
                    >
                      <span className={`vb-preset vb-preset-${name.split(' ')[0].toLowerCase()}`} />
                      {t(name)}
                    </button>
                  ))
                : palette.map(({ type, label, Icon }) => (
                    <button key={type} role="menuitem" onClick={() => addBlock(type)}>
                      <Icon size={18} />
                      {t(label)}
                    </button>
                  ))}
            </div>
          </div>
        )}
      </div>
      {!readOnly && (
        <aside className="vb-inspector" aria-label={t('Design')}>
          {block ? (
            <BlockPanel
              block={block}
              change={(patch) => commit(updateBlock(model, block.id, patch))}
            />
          ) : section ? (
            <SectionPanel
              section={section}
              change={(style) => commit(updateSection(model, section.id, style))}
              move={(delta) => commit(moveSection(model, section.id, delta))}
              remove={() => commit(removeSection(model, section.id))}
            />
          ) : (
            <ThemePanel model={model} change={(theme) => commit({ ...model, theme })} />
          )}
        </aside>
      )}
    </div>
  );
}

// Remount after each committed edit: the browser owns the text while it is typed, so React
// must not reconcile against nodes the person replaced.
const editKey = (item: Block) => `${item.id}:${item.text ?? ''}`;
const Fragmented = ({ children }: { children: ReactNode }) => <>{children}</>;

function AddLine({ open, onOpen }: { open: boolean; onOpen(): void }) {
  return (
    <button
      className={`vb-add-line${open ? ' open' : ''}`}
      aria-label={t('Add a block below')}
      title={t('Add a block below')}
      contentEditable={false}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
    >
      <Plus size={13} />
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="vb-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Range({
  label,
  value,
  min,
  max,
  step = 1,
  unit = 'px',
  fallback,
  change,
}: {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  fallback: number;
  change(value: number): void;
}) {
  return (
    <Field label={label}>
      <span className="vb-range">
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value ?? fallback}
          onChange={(event) => change(Number(event.target.value))}
        />
        <output>{value === undefined ? t('Auto') : `${value}${unit}`}</output>
      </span>
    </Field>
  );
}
function Color({
  label,
  value,
  change,
}: {
  label: string;
  value: string | undefined;
  change(value: string | undefined): void;
}) {
  return (
    <Field label={label}>
      <span className="vb-color">
        <input
          type="color"
          aria-label={label}
          value={value ?? '#000000'}
          data-empty={value ? undefined : ''}
          onChange={(event) => change(event.target.value)}
        />
        <code>{value ?? t('Auto')}</code>
        {value && (
          <button className="text-button" onClick={() => change(undefined)}>
            {t('Clear')}
          </button>
        )}
      </span>
    </Field>
  );
}
function AlignField({ value, change }: { value: Align | undefined; change(value: Align): void }) {
  return (
    <Field label={t('Alignment')}>
      <span className="vb-segments" role="group" aria-label={t('Alignment')}>
        {(
          [
            ['left', AlignLeft],
            ['center', AlignCenter],
            ['right', AlignRight],
          ] as const
        ).map(([name, Icon]) => (
          <button
            key={name}
            aria-pressed={value === name}
            aria-label={t(name === 'left' ? 'Left' : name === 'center' ? 'Center' : 'Right')}
            onClick={() => change(name)}
          >
            <Icon size={15} />
          </button>
        ))}
      </span>
    </Field>
  );
}

function BlockPanel({ block, change }: { block: Block; change(patch: Partial<Block>): void }) {
  const style = (patch: BlockStyle) => change({ style: patch });
  const s = block.style;
  const textual = ['heading', 'text', 'button', 'quote', 'list'].includes(block.type);
  return (
    <>
      <h3>{t(palette.find((item) => item.type === block.type)?.label ?? 'Block')}</h3>
      {block.type === 'heading' && (
        <Field label={t('Level')}>
          <Select
            aria-label={t('Level')}
            value={String(block.level ?? 2)}
            onChange={(event) => change({ level: Number(event.target.value) as 1 | 2 | 3 })}
          >
            <option value="1">{t('Title')}</option>
            <option value="2">{t('Section heading')}</option>
            <option value="3">{t('Small heading')}</option>
          </Select>
        </Field>
      )}
      {block.type === 'button' && (
        <Field label={t('Link')}>
          <input
            aria-label={t('Link')}
            defaultValue={block.href ?? ''}
            key={block.id}
            placeholder="https://"
            onBlur={(event) => change({ href: event.target.value })}
          />
        </Field>
      )}
      {block.type === 'image' && (
        <>
          <Field label={t('Image address')}>
            <input
              aria-label={t('Image address')}
              defaultValue={block.src ?? ''}
              key={block.id}
              placeholder="https://"
              onBlur={(event) => change({ src: event.target.value })}
            />
          </Field>
          <Field label={t('Description')}>
            <input
              aria-label={t('Description')}
              defaultValue={block.alt ?? ''}
              key={`${block.id}-alt`}
              onBlur={(event) => change({ alt: event.target.value })}
            />
          </Field>
          <Range
            label={t('Width')}
            value={s.width}
            min={10}
            max={100}
            unit="%"
            fallback={100}
            change={(width) => style({ width })}
          />
        </>
      )}
      {block.type === 'list' && (
        <Field label={t('Items, one per line')}>
          <textarea
            aria-label={t('Items, one per line')}
            rows={5}
            defaultValue={(block.items ?? []).join('\n')}
            key={block.id}
            onBlur={(event) =>
              change({ items: event.target.value.split('\n').filter((line) => line.trim()) })
            }
          />
        </Field>
      )}
      {block.type === 'spacer' && (
        <Range
          label={t('Height')}
          value={block.height}
          min={4}
          max={240}
          fallback={48}
          change={(height) => change({ height })}
        />
      )}
      {block.type === 'columns' && (
        <Field label={t('Columns')}>
          <span className="vb-segments" role="group" aria-label={t('Columns')}>
            {[1, 2, 3, 4].map((count) => (
              <button
                key={count}
                aria-pressed={(block.columns?.length ?? 0) === count}
                onClick={() => {
                  const current = block.columns ?? [];
                  change({
                    columns: Array.from(
                      { length: count },
                      (_, index) => current[index] ?? [newBlock('text')],
                    ),
                  });
                }}
              >
                {count}
              </button>
            ))}
          </span>
        </Field>
      )}
      {textual && (
        <>
          <AlignField value={s.align} change={(align) => style({ align })} />
          <Range
            label={t('Text size')}
            value={s.size}
            min={12}
            max={96}
            fallback={17}
            change={(size) => style({ size })}
          />
          <Range
            label={t('Weight')}
            value={s.weight}
            min={300}
            max={800}
            step={50}
            unit=""
            fallback={400}
            change={(weight) => style({ weight })}
          />
          <Color label={t('Text color')} value={s.color} change={(color) => style({ color })} />
        </>
      )}
      <Color
        label={t('Background')}
        value={s.background}
        change={(background) => style({ background })}
      />
      <Range
        label={t('Inner space')}
        value={s.padding}
        min={0}
        max={96}
        fallback={0}
        change={(padding) => style({ padding })}
      />
      <Range
        label={t('Corners')}
        value={s.radius}
        min={0}
        max={64}
        fallback={0}
        change={(radius) => style({ radius })}
      />
      <Range
        label={t('Space above')}
        value={s.space}
        min={0}
        max={96}
        fallback={18}
        change={(space) => style({ space })}
      />
    </>
  );
}

function SectionPanel({
  section,
  change,
  move,
  remove,
}: {
  section: Section;
  change(style: Section['style']): void;
  move(delta: -1 | 1): void;
  remove(): void;
}) {
  const s = section.style;
  return (
    <>
      <h3>{t('Section')}</h3>
      <Field label={t('Content width')}>
        <Select
          aria-label={t('Content width')}
          value={s.width ?? 'normal'}
          onChange={(event) => change({ width: event.target.value as Section['style']['width'] })}
        >
          <option value="narrow">{t('Narrow')}</option>
          <option value="normal">{t('Normal')}</option>
          <option value="wide">{t('Wide')}</option>
          <option value="full">{t('Full width')}</option>
        </Select>
      </Field>
      <AlignField value={s.align} change={(align) => change({ align })} />
      <Range
        label={t('Vertical space')}
        value={s.padding}
        min={0}
        max={240}
        step={4}
        fallback={72}
        change={(padding) => change({ padding })}
      />
      <Color
        label={t('Background')}
        value={s.background}
        change={(background) => change({ background })}
      />
      <Color label={t('Text color')} value={s.color} change={(color) => change({ color })} />
      <div className="vb-actions">
        <button className="button" onClick={() => move(-1)}>
          <ArrowUp size={14} />
          {t('Move up')}
        </button>
        <button className="button" onClick={() => move(1)}>
          <ArrowDown size={14} />
          {t('Move down')}
        </button>
        <button className="button danger" onClick={remove}>
          <Trash2 size={14} />
          {t('Delete section')}
        </button>
      </div>
    </>
  );
}

function ThemePanel({
  model,
  change,
}: {
  model: VisualDocument;
  change(theme: VisualDocument['theme']): void;
}) {
  const theme = model.theme;
  return (
    <>
      <h3>{t('Document style')}</h3>
      <p className="vb-hint">{t('Select a block or a section to style it.')}</p>
      <Field label={t('Typeface')}>
        <Select
          aria-label={t('Typeface')}
          value={theme.font}
          onChange={(event) =>
            change({ ...theme, font: event.target.value as VisualDocument['theme']['font'] })
          }
        >
          <option value="sans">{t('Sans serif')}</option>
          <option value="serif">{t('Serif')}</option>
          <option value="mono">{t('Monospace')}</option>
        </Select>
      </Field>
      <Color
        label={t('Accent')}
        value={theme.accent}
        change={(accent) => change({ ...theme, accent: accent ?? '#4f46d8' })}
      />
      <Color
        label={t('Page background')}
        value={theme.background}
        change={(background) => change({ ...theme, background: background ?? '#ffffff' })}
      />
      <Color
        label={t('Text color')}
        value={theme.text}
        change={(text) => change({ ...theme, text: text ?? '#1c1b18' })}
      />
      <Range
        label={t('Corners')}
        value={theme.radius}
        min={0}
        max={32}
        fallback={10}
        change={(radius) => change({ ...theme, radius })}
      />
    </>
  );
}
