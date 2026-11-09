import { useState } from 'react';
import { t } from '../i18n/index.js';
import type { DatabaseRecord, RecordField } from '@note/contracts';
import { useWorkspace } from '../state/store.js';
import { Cell } from './Cell.js';
import { displayFormula } from '@note/data/formula-input';

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
  const label = t('{{field}} for {{title}}', { field: field.name, title: record.title });
  const fields = useWorkspace((state) => state.tables[databaseId]?.fields);
  const templateRootId = useWorkspace((state) => state.tables[databaseId]?.templateRootId);
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
        {error && <small role="alert">{t(error)}</small>}
      </span>
    );
  return (
    <Cell
      initial={record.values[field.id]}
      templateRootId={templateRootId}
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
