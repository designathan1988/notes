import { t } from '../i18n/index.js';
import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal, Type } from 'lucide-react';
import { fieldIcons } from './fieldIcons.js';
import type { Page } from '@note/contracts';
import { compileFormulas } from '@note/data/formulas';
import { useWorkspace } from '../state/store.js';
import { RecordProperty } from './RecordProperty.js';
import { PropertyManager } from './PropertyManager.js';

/** Full-page and inspector views read the same normalized record and database definition. */
export function RecordPageProperties({ page, readOnly }: { page: Page; readOnly: boolean }) {
  const version = useWorkspace((state) => state.knowledgeVersion),
    record = useWorkspace((state) => state.recordEntities[page.id]),
    definition = useWorkspace((state) => state.tables[page.parentId ?? '']),
    [manager, setManager] = useState(false),
    [error, setError] = useState('');
  const calculate = useMemo(() => compileFormulas(definition?.fields ?? []), [definition?.fields]);
  const refresh = () => useWorkspace.getState().loadRecord(page.parentId!, page.id);
  useEffect(() => {
    let active = true;
    void useWorkspace
      .getState()
      .loadRecord(page.parentId!, page.id)
      .then(() => {
        if (active) setError('');
      })
      .catch((failure) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, [page.id, page.parentId, version]);
  if (error)
    return (
      <p className="activity-error" role="alert">
        {t(error)}{' '}
        <button
          onClick={() =>
            void refresh()
              .then(() => setError(''))
              .catch((failure) => setError(failure.message))
          }
        >
          {t('Retry properties')}
        </button>
      </p>
    );
  if (!definition || !record)
    return <p className="muted-text loading-note">{t('Loading properties…')}</p>;
  const current = { ...record, computedValues: calculate(record.values) };
  return (
    <section className="page-properties" aria-label={t('Record properties')}>
      <dl className="record-properties">
        {definition.fields
          .filter((field) => !field.archived)
          .map((field) => {
            const Icon = fieldIcons[field.type] ?? Type;
            return (
              <div key={field.id}>
                <dt>
                  <Icon size={15} aria-hidden />
                  {field.name}
                </dt>
                <dd>
                  <RecordProperty
                    databaseId={page.parentId!}
                    record={current}
                    field={field}
                    readOnly={readOnly}
                    refresh={refresh}
                  />
                </dd>
              </div>
            );
          })}
      </dl>
      {!readOnly && (
        <div className="page-property-tools">
          <button aria-label={t('Manage database properties')} onClick={() => setManager(true)}>
            <SlidersHorizontal size={12} />
            {t('Database properties')}
          </button>
        </div>
      )}
      {manager && (
        <PropertyManager
          id={page.parentId!}
          fields={definition.fields}
          revision={definition.fieldsRevision}
          initialAdd={false}
          close={() => setManager(false)}
          refresh={refresh}
        />
      )}
    </section>
  );
}
