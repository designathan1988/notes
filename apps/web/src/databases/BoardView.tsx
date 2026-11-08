import { GripVertical, Plus } from 'lucide-react';
import type { DatabaseRecord, RecordField } from '@note/contracts';
import { useWorkspace } from '../state/store.js';
import { RecordProperty } from './RecordProperty.js';
import { useRecordDrag } from './useRecordDrag.js';

export function BoardView({
  id,
  records,
  fields,
  groupBy,
  readOnly,
  inspect,
  refresh,
  create,
  error,
}: {
  id: string;
  records: DatabaseRecord[];
  fields: RecordField[];
  groupBy?: string;
  readOnly: boolean;
  inspect(id: string): void;
  refresh(): Promise<void>;
  create(values: Record<string, unknown>): void;
  error(message: string): void;
}) {
  const field = fields.find((field) => field.id === groupBy);
  const groups = field?.type === 'checkbox' ? ['false', 'true'] : [...(field?.options ?? []), ''];
  const move = async (recordId: string, value: string) => {
    if (readOnly || !field) return;
    await useWorkspace.getState().editRecord(id, recordId, {
      values: { [field.id]: field.type === 'checkbox' ? value === 'true' : value || null },
    });
    await refresh();
  };
  const drag = useRecordDrag(move, error);
  if (!field)
    return (
      <div className="table-empty">
        Add a select or checkbox property, then choose how to group this board.
      </div>
    );
  return (
    <div className="database-board" ref={drag.root}>
      {groups.map((group, index) => {
        const label =
          field.type === 'checkbox'
            ? group === 'true'
              ? 'Checked'
              : 'Unchecked'
            : group || 'Unassigned';
        const rows = records.filter((record) =>
          field.type === 'checkbox'
            ? String(!!record.values[field.id]) === group
            : String(record.values[field.id] ?? '') === group,
        );
        return (
          <section
            key={group}
            role="region"
            aria-label={`${label} group`}
            data-record-drop={group}
            className={`board-column ${drag.over === group ? 'drop-active' : ''}`}
          >
            <header>
              <strong>{label}</strong>
              <span>{rows.length}</span>
              {!readOnly && (
                <button
                  aria-label={`Add record to ${label}`}
                  onClick={() =>
                    create({
                      [field.id]: field.type === 'checkbox' ? group === 'true' : group || null,
                    })
                  }
                >
                  <Plus size={15} />
                </button>
              )}
            </header>
            {rows.map((record) => (
              <article className="board-record" key={record.pageId}>
                <div className="board-record-title">
                  <button
                    className="record-open"
                    aria-label={`Inspect ${record.title}`}
                    onClick={() => inspect(record.pageId)}
                  >
                    {record.title}
                  </button>
                  {!readOnly && (
                    <button
                      className="record-grip"
                      aria-label={`Drag ${record.title}`}
                      title="Drag or use left and right arrow keys to change group"
                      onPointerDown={(event) => drag.begin(record.pageId, record.title, event)}
                      onKeyDown={(event) => {
                        const next =
                          event.key === 'ArrowLeft'
                            ? index - 1
                            : event.key === 'ArrowRight'
                              ? index + 1
                              : -1;
                        if (next >= 0 && next < groups.length) {
                          event.preventDefault();
                          void move(record.pageId, groups[next]).catch(
                            (error) => error && useWorkspace.getState().setError(error),
                          );
                        }
                      }}
                    >
                      <GripVertical size={16} />
                    </button>
                  )}
                </div>
                {fields
                  .filter((item) => !item.archived && item.id !== field.id)
                  .slice(0, 3)
                  .map((item) => (
                    <div className="board-record-property" key={item.id}>
                      <small>{item.name}</small>
                      <RecordProperty
                        databaseId={id}
                        record={record}
                        field={item}
                        readOnly={readOnly}
                        refresh={refresh}
                      />
                    </div>
                  ))}
              </article>
            ))}
          </section>
        );
      })}
      {drag.ghost}
    </div>
  );
}
