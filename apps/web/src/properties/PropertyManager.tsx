import { useState } from 'react';
import type { RecordField } from '../../../../packages/contracts/src/index.js';
import { Dialog } from '../ui/Dialog.js';
import {
  canonicalFormula,
  displayFormula,
  formulaReference,
} from '../../../../packages/data/src/formula-input.js';

export function PropertyManager({
  label,
  fields,
  revision,
  initialAdd,
  close,
  commit,
}: {
  label: string;
  fields: RecordField[];
  revision: number;
  initialAdd: boolean;
  close(): void;
  commit(fields: RecordField[], expectedRevision: number): Promise<void>;
}) {
  const blank = (): RecordField => ({ id: crypto.randomUUID(), name: '', type: 'text' });
  const [draft, setDraft] = useState<RecordField | null>(initialAdd ? blank() : null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [draftRevision, setDraftRevision] = useState(revision);
  const existing = fields.find((field) => field.id === draft?.id);
  const save = async (next: RecordField[]) => {
    if (draft && draftRevision !== revision) {
      setError(
        'The properties changed while you were editing. Reopen this property to review the latest version.',
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      await commit(next, revision);
      setDraft(null);
      if (initialAdd) close();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={initialAdd ? 'Add a property' : label} onClose={close}>
      {!draft ? (
        <div className="property-manager-list">
          {fields.map((field) => (
            <div key={field.id}>
              <button
                disabled={busy}
                onClick={() => {
                  setDraft({
                    ...field,
                    ...(field.type === 'formula'
                      ? { formula: displayFormula(field.formula ?? '', fields) }
                      : {}),
                  });
                  setDraftRevision(revision);
                  setError('');
                }}
              >
                <strong>{field.name}</strong>
                <small>
                  {field.type}
                  {field.archived ? ' · Archived' : ''}
                </small>
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void save(
                    fields.map((item) =>
                      item.id === field.id ? { ...item, archived: !item.archived } : item,
                    ),
                  )
                }
              >
                {field.archived ? 'Restore' : 'Archive'}
              </button>
            </div>
          ))}
          <button
            className="button"
            disabled={busy}
            onClick={() => {
              setDraft(blank());
              setDraftRevision(revision);
            }}
          >
            Add property
          </button>
          <p className="muted-text">Archiving hides a property and preserves its values.</p>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            let next = ['select', 'multi-select'].includes(draft.type)
              ? {
                  ...draft,
                  options: String(new FormData(event.currentTarget).get('options') ?? '')
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean),
                }
              : draft;
            try {
              if (next.type === 'formula')
                next = {
                  ...next,
                  formula: canonicalFormula(next.formula ?? '', [
                    ...fields.filter((field) => field.id !== next.id),
                    next,
                  ]),
                };
            } catch (error) {
              setError((error as Error).message);
              return;
            }
            void save(
              existing
                ? fields.map((field) => (field.id === draft.id ? next : field))
                : [...fields, next],
            );
          }}
        >
          <fieldset className="property-editor-fields" disabled={busy}>
            <label>
              Name
              <input
                autoFocus
                name="name"
                required
                maxLength={100}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <label>
              Type
              <select
                name="type"
                value={draft.type}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    type: event.target.value as RecordField['type'],
                    options: event.target.value.includes('select')
                      ? (draft.options ?? [])
                      : undefined,
                    formula: event.target.value === 'formula' ? (draft.formula ?? '') : undefined,
                    action: event.target.value === 'button' ? draft.action : undefined,
                  })
                }
              >
                {[
                  'text',
                  'number',
                  'checkbox',
                  'select',
                  'multi-select',
                  'date',
                  'url',
                  'relation',
                  'formula',
                  'button',
                ].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            {['select', 'multi-select'].includes(draft.type) && (
              <label>
                Select options
                <input
                  key={draft.id + draft.type}
                  name="options"
                  placeholder="First option, Second option"
                  defaultValue={draft.options?.join(', ') ?? ''}
                />
              </label>
            )}
            {draft.type === 'formula' && (
              <>
                <label>
                  Formula
                  <textarea
                    aria-label="Formula"
                    required
                    value={draft.formula ?? ''}
                    onChange={(event) => setDraft({ ...draft, formula: event.target.value })}
                    placeholder={'prop("Hours") * 15'}
                  />
                </label>
                <div className="formula-references">
                  {fields
                    .filter(
                      (field) =>
                        ['number', 'formula'].includes(field.type) && field.id !== draft.id,
                    )
                    .map((field) => (
                      <button
                        type="button"
                        key={field.id}
                        title={field.name}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            formula: (draft.formula ?? '') + formulaReference(field, fields),
                          })
                        }
                      >
                        {field.name}
                      </button>
                    ))}
                </div>
                <p className="muted-text">
                  Use + − * / %, parentheses, round, abs, min and max. Empty values and invalid
                  arithmetic display as —.
                </p>
              </>
            )}
            {draft.type === 'button' && (
              <>
                <label>
                  Update property
                  <select
                    aria-label="Action property"
                    value={draft.action?.fieldId ?? ''}
                    required
                    onChange={(event) => {
                      const target = fields.find((field) => field.id === event.target.value);
                      setDraft({
                        ...draft,
                        action: {
                          fieldId: event.target.value,
                          value:
                            target?.type === 'checkbox' ? true : target?.type === 'number' ? 0 : '',
                        },
                      });
                    }}
                  >
                    <option value="">Choose a property</option>
                    {fields
                      .filter(
                        (field) =>
                          !field.archived &&
                          ['text', 'number', 'checkbox', 'select', 'date', 'url'].includes(
                            field.type,
                          ),
                      )
                      .map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.name}
                        </option>
                      ))}
                  </select>
                </label>
                {draft.action && (
                  <label>
                    Action value
                    {(() => {
                      const target = fields.find((field) => field.id === draft.action?.fieldId);
                      const change = (value: unknown) =>
                        setDraft({ ...draft, action: { ...draft.action!, value } });
                      return target?.type === 'checkbox' ? (
                        <select
                          aria-label="Action value"
                          value={String(draft.action.value)}
                          onChange={(event) => change(event.target.value === 'true')}
                        >
                          <option value="true">Checked</option>
                          <option value="false">Unchecked</option>
                        </select>
                      ) : target?.type === 'select' ? (
                        <select
                          aria-label="Action value"
                          value={String(draft.action.value)}
                          onChange={(event) => change(event.target.value)}
                        >
                          <option value="" />
                          {target.options?.map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          aria-label="Action value"
                          type={
                            target?.type === 'number'
                              ? 'number'
                              : target?.type === 'date'
                                ? 'date'
                                : 'text'
                          }
                          value={String(draft.action.value ?? '')}
                          onChange={(event) =>
                            change(
                              target?.type === 'number'
                                ? Number(event.target.value)
                                : event.target.value,
                            )
                          }
                        />
                      );
                    })()}
                  </label>
                )}
                <p className="muted-text">
                  This button updates one property on this item. Actions use the current permissions
                  and revision.
                </p>
              </>
            )}
            <div className="form-actions">
              <button className="button primary" disabled={busy}>
                {existing ? 'Save property' : 'Add property'}
              </button>
              {!initialAdd && (
                <button className="button" type="button" onClick={() => setDraft(null)}>
                  Back
                </button>
              )}
            </div>
          </fieldset>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
