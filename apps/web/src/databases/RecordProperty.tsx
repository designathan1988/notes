import { useState } from 'react';
import type { DatabaseRecord, RecordField } from '../../../../packages/contracts/src/index.js';
import { useWorkspace } from '../state/store.js';
import { Cell } from './Cell.js';
import { displayFormula } from '../../../../packages/data/src/formula-input.js';

export function RecordProperty({
  databaseId,
  record,
  field,
  readOnly,
  refresh,
}: {
  databaseId: string;
  record: DatabaseRecord;
  field: RecordField;
  readOnly: boolean;
  refresh?(): Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const label = `${field.name} for ${record.title}`;
  const fields = useWorkspace((state) => state.tables[databaseId]?.fields);
  if (field.type === 'formula')
    return (
      <output
        className="computed-value"
        aria-label={label}
        title={displayFormula(field.formula ?? '', fields ?? [])}
      >
        {record.computedValues?.[field.id] ?? '—'}
      </output>
    );
  if (field.type === 'button')
    return (
      <span className="record-action">
        <button
          className="button"
          aria-label={label}
          disabled={readOnly || busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await useWorkspace.getState().runRecordAction(databaseId, record.pageId, field.id);
              await refresh?.();
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {field.name}
        </button>
        {error && <small role="alert">{error}</small>}
      </span>
    );
  return (
    <Cell
      initial={record.values[field.id]}
      field={field}
      readOnly={readOnly}
      label={label}
      save={async (value, original, originalField) => {
        await useWorkspace
          .getState()
          .editRecord(
            databaseId,
            record.pageId,
            { values: { [field.id]: value } },
            { id: field.id, value: original, field: originalField ?? field },
          );
        await refresh?.();
      }}
    />
  );
}
