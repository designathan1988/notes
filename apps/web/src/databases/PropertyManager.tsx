import { t } from '../i18n/index.js';
import type { RecordField } from '@note/contracts';
import { PropertyManager as FieldEditor } from '../properties/PropertyManager.js';
import { api, json } from '../state/api.js';

/** Database schemas keep their existing command; only the field editor is shared. */
export function PropertyManager({
  id,
  fields,
  revision,
  initialAdd,
  initialType,
  onCreated,
  close,
  refresh,
}: {
  id: string;
  fields: RecordField[];
  revision: number;
  initialAdd: boolean;
  initialType?: RecordField['type'];
  onCreated?(field: RecordField): void;
  close(): void;
  refresh(): Promise<void>;
}) {
  return (
    <FieldEditor
      label={t('Database properties')}
      fields={fields}
      revision={revision}
      initialAdd={initialAdd}
      initialType={initialType}
      close={close}
      commit={async (next, revision) => {
        await api(`/databases/${id}/fields`, {
          method: 'PUT',
          body: json({ fields: next, revision }),
        });
        await refresh();
        const created = next.find((field) => !fields.some((existing) => existing.id === field.id));
        if (created) onCreated?.(created);
      }}
    />
  );
}
