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
      aria-label="Canvas selection"
    >
      <header>
        <strong>Selection</strong>
        <IconButton label="Close selection" onClick={() => c.setInspector(false)}>
          <X />
        </IconButton>
      </header>
      <p>
        {selected.length} {selected.length === 1 ? 'element' : 'elements'} selected
      </p>
      <fieldset className="canvas-style-controls" disabled={c.readOnly}>
        <legend>Appearance</legend>
        <div className="canvas-color-options" role="group" aria-label="Element color">
          {canvasColors.map((value) => (
            <button
              key={value}
              type="button"
              className="canvas-color-option"
              aria-label={`Use ${value} color`}
              aria-pressed={color === value}
              style={{ '--swatch': `var(--canvas-color-${value})` } as React.CSSProperties}
              onClick={() => change({ color: value })}
            />
          ))}
          <label className="canvas-custom-color" title="Custom element color">
            <input
              type="color"
              aria-label="Custom element color"
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
                <select
                  aria-label={label}
                  value={edgeValue(key)}
                  onChange={(event) => change({ [key]: event.target.value })}
                >
                  {!edgeValue(key) && (
                    <option value="" disabled>
                      Mixed
                    </option>
                  )}
                  {options.map((value) => (
                    <option key={value} value={value}>
                      {value === 'auto' ? 'Automatic' : value[0].toUpperCase() + value.slice(1)}
                    </option>
                  ))}
                </select>
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
              <span>Bring forward</span>
            </button>
            <button disabled={c.readOnly} onClick={() => c.order('back')}>
              <ArrowDown />
              <span>Send backward</span>
            </button>
          </>
        )}
        <button disabled={c.readOnly} onClick={c.duplicate}>
          <Copy />
          <span>Duplicate</span>
        </button>
        <button disabled={c.readOnly} onClick={c.remove}>
          <Trash2 />
          <span>Delete</span>
        </button>
      </div>
    </aside>
  );
}
