import type { RecordField } from '../../../../packages/contracts/src/index.js';
import { PropertyManager as FieldEditor } from '../properties/PropertyManager.js';
import { api, json } from '../state/api.js';

/** Database schemas keep their existing command; only the field editor is shared. */
export function PropertyManager({
  id,
  fields,
  revision,
  initialAdd,
  close,
  refresh,
}: {
  id: string;
  fields: RecordField[];
  revision: number;
  initialAdd: boolean;
  close(): void;
  refresh(): Promise<void>;
}) {
  return (
    <FieldEditor
      label="Database properties"
      fields={fields}
      revision={revision}
      initialAdd={initialAdd}
      close={close}
      commit={async (fields, revision) => {
        await api(`/databases/${id}/fields`, { method: 'PUT', body: json({ fields, revision }) });
        await refresh();
      }}
    />
  );
}
