import { t } from '../i18n/index.js';
import { FileText } from 'lucide-react';
import type { DatabaseRecord, RecordField } from '@note/contracts';
import { RecordProperty } from './RecordProperty.js';

export function ListView({
  id,
  records,
  fields,
  readOnly,
  inspect,
  refresh,
}: {
  id: string;
  records: DatabaseRecord[];
  fields: RecordField[];
  readOnly: boolean;
  inspect(id: string): void;
  refresh(): Promise<void>;
}) {
  return (
    <ul className="database-list" aria-label={t('Database list')}>
      {records.map((record) => (
        <li key={record.pageId}>
          <button
            className="record-open"
            aria-label={t('Inspect {{value0}}', { value0: record.title })}
            onClick={() => inspect(record.pageId)}
          >
            <FileText size={17} />
            {record.title}
          </button>
          <div className="list-properties">
            {fields
              .filter((field) => !field.archived)
              .map((field) => (
                <div key={field.id} title={field.name}>
                  <RecordProperty
                    databaseId={id}
                    record={record}
                    field={field}
                    readOnly={readOnly}
                    refresh={refresh}
                  />
                </div>
              ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
