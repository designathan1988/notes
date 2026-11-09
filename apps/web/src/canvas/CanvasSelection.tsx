import { t } from '../i18n/index.js';
import { Select } from '../ui/Select.js';
import { ArrowUp, ArrowDown, Copy, Trash2, X } from 'lucide-react';
import { useCanvas } from './context.js';
import { IconButton } from '../ui/IconButton.js';
import { styleCanvas, type CanvasStyle } from '@note/editor/canvas-commands';
import { canvasColors } from '@note/editor/canvas';
import { canvasSides, canvasEnds } from '@note/editor/canvas-geometry';

export function CanvasSelection() {
  const c = useCanvas(),
    selected = c.items.filter((item) => c.selected.includes(item.id));
  if (!c.inspector || !selected.length) return null;
  const edges = selected.filter((item) => item.node.type.name === 'canvasEdge');
  const hasBoxes = selected.some((item) => item.node.type.name !== 'canvasEdge');
  const common = (key: keyof CanvasStyle) =>
    selected.every((item) => item.node.attrs[key] === selected[0].node.attrs[key])
      ? selected[0].node.attrs[key]
      : '';
  const edgeValue = (key: keyof CanvasStyle) =>
    edges.every((item) => item.node.attrs[key] === edges[0].node.attrs[key])
      ? edges[0].node.attrs[key]
      : '';
  const color = common('color');
  const change = (patch: CanvasStyle) => c.run((tr) => styleCanvas(tr, c.selected, patch));
  return (
    <aside
      className="canvas-inspector"
      contentEditable={false}
      data-spatial-control
      aria-label={t('Canvas selection')}
    >
      <header>
        <strong>{t('Selection')}</strong>
        <IconButton label={t('Close selection')} onClick={() => c.setInspector(false)}>
          <X />
        </IconButton>
      </header>
      <p>
        {t(selected.length === 1 ? '{{count}} element selected' : '{{count}} elements selected', {
          count: selected.length,
        })}
      </p>
      <fieldset className="canvas-style-controls" disabled={c.readOnly}>
        <legend>{t('Appearance')}</legend>
        <div className="canvas-color-options" role="group" aria-label={t('Element color')}>
          {canvasColors.map((value) => (
            <button
              key={value}
              type="button"
              className="canvas-color-option"
              aria-label={t('Use {{value}} color', { value: t(value) })}
              aria-pressed={color === value}
              style={{ '--swatch': `var(--canvas-color-${value})` } as React.CSSProperties}
              onClick={() => change({ color: value })}
            />
          ))}
          <label className="canvas-custom-color" title={t('Custom element color')}>
            <input
              type="color"
              aria-label={t('Custom element color')}
              value={/^#[a-f0-9]{6}$/i.test(color) ? color : '#73737c'}
              onChange={(event) => change({ color: event.target.value })}
            />
          </label>
        </div>
        {edges.length > 0 && (
          <div className="canvas-edge-options">
            {(
              [
                ['fromSide', 'Start side', canvasSides],
                ['toSide', 'End side', canvasSides],
                ['fromEnd', 'Start arrow', canvasEnds],
                ['toEnd', 'End arrow', canvasEnds],
              ] as const
            ).map(([key, label, options]) => (
              <label key={key}>
                {label}
                <Select
                  aria-label={t(label)}
                  value={edgeValue(key)}
                  onChange={(event) => change({ [key]: event.target.value })}
                >
                  {!edgeValue(key) && (
                    <option value="" disabled>
                      {t('Mixed')}
                    </option>
                  )}
                  {options.map((value) => (
                    <option key={value} value={value}>
                      {value === 'auto'
                        ? t('Automatic')
                        : t(value[0].toUpperCase() + value.slice(1))}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="canvas-selection-actions">
        {hasBoxes && (
          <>
            <button disabled={c.readOnly} onClick={() => c.order('front')}>
              <ArrowUp />
              <span>{t('Bring forward')}</span>
            </button>
            <button disabled={c.readOnly} onClick={() => c.order('back')}>
              <ArrowDown />
              <span>{t('Send backward')}</span>
            </button>
          </>
        )}
        <button disabled={c.readOnly} onClick={c.duplicate}>
          <Copy />
          <span>{t('Duplicate')}</span>
        </button>
        <button disabled={c.readOnly} onClick={c.remove}>
          <Trash2 />
          <span>{t('Delete')}</span>
        </button>
      </div>
    </aside>
  );
}
