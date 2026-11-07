import { useEffect, useRef, useState } from 'react';
import type { RecordField } from '../../../../packages/contracts/src/index.js';
import { RelationCell } from './RelationCell.js';
export function Cell({
  initial,
  field,
  readOnly,
  label,
  save,
}: {
  initial: unknown;
  field?: RecordField;
  readOnly: boolean;
  label: string;
  save(value: unknown): Promise<void>;
}) {
  const [value, setValue] = useState(initial ?? '');
  const [error, setError] = useState('');
  const focused = useRef(false);
  const cancelled = useRef(false);
  useEffect(() => {
    if (!focused.current && !error) setValue(initial ?? '');
  }, [JSON.stringify(initial)]);
  async function commit(next: unknown) {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (JSON.stringify(next) === JSON.stringify(initial ?? '')) return;
    try {
      await save(next);
      setError('');
    } catch (error) {
      setError('Not saved: ' + (error as Error).message);
    }
  }
  if (field?.type === 'relation')
    return (
      <div className="cell-control">
        <RelationCell
          value={String(value || '')}
          label={label}
          readOnly={readOnly}
          change={(next) => {
            setValue(next ?? '');
            void commit(next);
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
            focused.current = true;
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
