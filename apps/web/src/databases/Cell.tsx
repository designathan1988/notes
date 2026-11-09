import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { RecordField } from '@note/contracts';
import { RelationCell } from './RelationCell.js';
import { toneOf } from '../ui/tone.js';
export function Cell({
  initial,
  field,
  readOnly,
  label,
  save,
  relationKind = 'record',
  templateRootId,
  selfRelation,
}: {
  initial: unknown;
  field?: RecordField;
  readOnly: boolean;
  label: string;
  save(value: unknown, original: unknown, field?: RecordField): Promise<void>;
  relationKind?: 'record' | 'page';
  templateRootId?: string | null;
  selfRelation?: { id: string; title: string };
}) {
  const [value, setValue] = useState(initial ?? '');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
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
  // Values arrive as fresh objects on every refresh; compare them by content.
  const initialKey = JSON.stringify(initial ?? null),
    fieldKey = JSON.stringify(field ?? null);
  // Adopt the stored value unless the person is editing or a save is still in flight.
  const adoptStoredValue = useEffectEvent(() => {
    if (!focused.current && !error && !pending && !submitting.current) {
      setValue(initial ?? '');
      baseline.current = { value: initial ?? null, field };
    }
  });
  useEffect(() => {
    adoptStoredValue();
  }, [initialKey, fieldKey, pending, error]);
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
    submitting.current = true;
    setPending(true);
    try {
      await save(next, original.value, original.field);
      baseline.current = { value: next, field };
      setError('');
    } catch (error) {
      setError('Not saved: ' + (error as Error).message);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  const feedback = (
    <>
      {pending && (
        <small className="cell-saving" role="status">
          Saving…
        </small>
      )}
      {error && (
        <span className="cell-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
  if (field?.type === 'relation')
    return (
      <div className="cell-control" aria-busy={pending}>
        <RelationCell
          kind={relationKind}
          templateRootId={templateRootId}
          selfRelation={selfRelation}
          value={String(value || '')}
          label={label}
          readOnly={readOnly}
          busy={pending}
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
        {feedback}
      </div>
    );
  if (readOnly)
    return (
      <span
        className={field?.type === 'select' ? 'status-label' : ''}
        data-tone={field?.type === 'select' ? toneOf(initial) : undefined}
      >
        {Array.isArray(initial) ? initial.join(', ') : String(initial ?? '')}
      </span>
    );
  if (field?.type === 'checkbox')
    return (
      <div className="cell-control" aria-busy={pending}>
        <input
          type="checkbox"
          disabled={pending}
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
        {feedback}
      </div>
    );
  return (
    <div className="cell-control" aria-busy={pending}>
      {field?.type === 'select' ? (
        <select
          aria-label={label}
          className="status-label"
          data-tone={value ? toneOf(value) : undefined}
          data-empty={value ? undefined : ''}
          disabled={pending}
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
          <option value="">Empty</option>
          {field.options?.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input
          aria-label={label}
          type={field?.type === 'number' ? 'number' : field?.type === 'date' ? 'date' : 'text'}
          placeholder="Empty"
          data-empty={value === '' || value == null ? '' : undefined}
          disabled={pending}
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
      {feedback}
    </div>
  );
}
