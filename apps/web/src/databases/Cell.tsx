import { useEffect, useRef, useState } from 'react';
import type { RecordField } from '../../../../packages/contracts/src/index.js';
import { RelationCell } from './RelationCell.js';
export function Cell({
  initial,
  field,
  readOnly,
  label,
  save,
  relationKind = 'record',
}: {
  initial: unknown;
  field?: RecordField;
  readOnly: boolean;
  label: string;
  save(value: unknown, original: unknown, field?: RecordField): Promise<void>;
  relationKind?: 'record' | 'page';
}) {
  const [value, setValue] = useState(initial ?? '');
  const [error, setError] = useState('');
  const focused = useRef(false);
  const baseline = useRef<{ value: unknown; field?: RecordField }>({
    value: initial ?? null,
    field,
  });
  const begin = () => {
    focused.current = true;
    baseline.current = { value: initial ?? null, field };
  };
  const cancelled = useRef(false);
  useEffect(() => {
    if (!focused.current && !error) {
      setValue(initial ?? '');
      baseline.current = { value: initial ?? null, field };
    }
  }, [JSON.stringify(initial), JSON.stringify(field)]);
  async function commit(next: unknown) {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const original = baseline.current;
    if (JSON.stringify(next ?? '') === JSON.stringify(original.value ?? '')) {
      setValue(initial ?? '');
      baseline.current = { value: initial ?? null, field };
      return;
    }
    try {
      await save(next, original.value, original.field);
      baseline.current = { value: next, field };
      setError('');
    } catch (error) {
      setError('Not saved: ' + (error as Error).message);
    }
  }
  if (field?.type === 'relation')
    return (
      <div className="cell-control">
        <RelationCell
          kind={relationKind}
          value={String(value || '')}
          label={label}
          readOnly={readOnly}
          begin={begin}
          end={() => {
            focused.current = false;
            setValue(initial ?? '');
            baseline.current = { value: initial ?? null, field };
          }}
          change={(next) => {
            setValue(next ?? '');
            void commit(next).finally(() => {
              focused.current = false;
            });
          }}
        />
        {error && (
          <span className="cell-error" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  if (readOnly)
    return (
      <span className={field?.type === 'select' ? 'status-label' : ''}>
        {Array.isArray(initial) ? initial.join(', ') : String(initial ?? '')}
      </span>
    );
  if (field?.type === 'checkbox')
    return (
      <div className="cell-control">
        <input
          type="checkbox"
          aria-label={label}
          checked={Boolean(value)}
          onFocus={begin}
          onBlur={() => {
            focused.current = false;
          }}
          onChange={(event) => {
            setValue(event.target.checked);
            void commit(event.target.checked);
          }}
        />
        {error && (
          <span className="cell-error" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  return (
    <div className="cell-control">
      {field?.type === 'select' ? (
        <select
          aria-label={label}
          className="status-label"
          value={String(value)}
          onFocus={begin}
          onBlur={() => {
            focused.current = false;
          }}
          onChange={(event) => {
            setValue(event.target.value);
            void commit(event.target.value);
          }}
        >
          <option value="" />
          {field.options?.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input
          aria-label={label}
          type={field?.type === 'number' ? 'number' : field?.type === 'date' ? 'date' : 'text'}
          value={Array.isArray(value) ? value.join(', ') : String(value)}
          onFocus={() => {
            begin();
          }}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => {
            focused.current = false;
            void commit(
              field?.type === 'number' && value !== ''
                ? Number(value)
                : field?.type === 'multi-select'
                  ? String(value)
                      .split(',')
                      .map((value) => value.trim())
                      .filter(Boolean)
                  : value,
            );
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              cancelled.current = true;
              setValue(initial ?? '');
              setError('');
              event.currentTarget.blur();
            }
          }}
        />
      )}{' '}
      {error && (
        <span className="cell-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
