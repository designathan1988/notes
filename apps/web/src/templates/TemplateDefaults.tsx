import { t } from '../i18n/index.js';
import { useEffect, useMemo, useState } from 'react';
import type { Page, RecordField } from '@note/contracts';
import { compileFormulas } from '@note/data/formulas';
import { useWorkspace } from '../state/store.js';
import { Cell } from '../databases/Cell.js';
function DefaultCell({
  page,
  field,
  readOnly,
  revision,
  computed,
}: {
  page: Page;
  field: RecordField;
  readOnly: boolean;
  revision: number;
  computed: Record<string, number | null>;
}) {
  if (field.type === 'formula')
    return (
      <output aria-label={t('Default {{value0}}', { value0: field.name })}>
        {computed[field.id] ?? '—'}
      </output>
    );
  if (field.type === 'button')
    return <small className="muted-text">{t('Available on new records')}</small>;
  return (
    <Cell
      label={t('Default {{value0}}', { value0: field.name })}
      field={field}
      initial={page.templateValues?.[field.id]}
      readOnly={readOnly}
      selfRelation={{ id: page.id, title: t('New record (self)') }}
      save={async (value, original, originalField) => {
        await useWorkspace.getState().updatePage(page.id, {
          templateDefaults: {
            fieldsRevision: revision,
            property: {
              id: field.id,
              value,
              expectedValue: original,
              expectedField: originalField ?? field,
            },
          },
        });
        await useWorkspace.getState().loadTemplateDefaults(page.id);
      }}
    />
  );
}
export function TemplateDefaults({ page, readOnly = false }: { page: Page; readOnly?: boolean }) {
  const review = useWorkspace((state) => state.templateReviews[page.id]),
    error = useWorkspace((state) => state.templateDefaultsErrors[page.id]),
    definition = useWorkspace((state) => state.tables[page.templateDatabaseId ?? '']),
    version = useWorkspace((state) => state.knowledgeVersion);
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState('');
  const fields = definition?.fields,
    calculate = useMemo(() => compileFormulas(fields ?? []), [fields]),
    computed = calculate(page.templateValues ?? {});
  useEffect(() => {
    void useWorkspace.getState().loadTemplateDefaults(page.id);
  }, [page.id, page.revision, version, definition?.fieldsRevision]);
  return (
    <section
      className="template-defaults page-properties"
      aria-label={t('Record template defaults')}
    >
      <header>
        <strong>{t('Record defaults')}</strong>
        <button
          className="text-button"
          onClick={() =>
            useWorkspace.getState().navigate(page.templateDatabaseId ?? null, 'database')
          }
        >
          {definition?.title ?? t('Open database')}
        </button>
      </header>
      <p>
        {t('Properties belong to the database. These starting values belong to this template.')}
      </p>
      {error ? (
        <div className="form-error" role="alert">
          {t(error)}{' '}
          <button
            className="text-button"
            onClick={() => void useWorkspace.getState().loadTemplateDefaults(page.id)}
          >
            {t('Refresh defaults')}
          </button>
        </div>
      ) : !review ? (
        <p className="muted-text">{t('Checking defaults…')}</p>
      ) : (
        <>
          {!!review.issues.length && (
            <div className="template-default-issues" role="alert">
              <strong>{t('Some saved defaults need review')}</strong>
              <ul>
                {review.issues.map((issue) => (
                  <li key={issue.fieldId}>
                    {issue.name}: {t(issue.message)}
                  </li>
                ))}
              </ul>
              {!readOnly && (
                <button
                  className="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setFailure('');
                    try {
                      await useWorkspace.getState().updatePage(
                        page.id,
                        {
                          templateDefaults: {
                            fieldsRevision: review.fieldsRevision,
                            resetInvalid: true,
                          },
                        },
                        review.templateRevision,
                      );
                      await useWorkspace.getState().loadTemplateDefaults(page.id);
                    } catch (error) {
                      setFailure((error as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t('Reset invalid defaults')}
                </button>
              )}
            </div>
          )}
          <dl className="record-properties">
            {fields
              ?.filter((field) => !field.archived)
              .map((field) => (
                <div key={field.id}>
                  <dt>{field.name}</dt>
                  <dd>
                    <DefaultCell
                      page={page}
                      field={field}
                      readOnly={readOnly || busy}
                      revision={review.fieldsRevision}
                      computed={computed}
                    />
                  </dd>
                </div>
              ))}
          </dl>
          {!fields?.filter((field) => !field.archived).length && (
            <p className="muted-text">{t('No database properties yet.')}</p>
          )}
        </>
      )}
      {failure && (
        <p className="form-error" role="alert">
          {t(failure)}
        </p>
      )}
    </section>
  );
}
