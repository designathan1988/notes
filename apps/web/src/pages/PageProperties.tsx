import { t } from '../i18n/index.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, SlidersHorizontal } from 'lucide-react';
import type { Page, RecordField } from '@note/contracts';
import { compileFormulas } from '@note/data/formulas';
import { displayFormula } from '@note/data/formula-input';
import { useWorkspace } from '../state/store.js';
import { Cell } from '../databases/Cell.js';
import { PropertyManager } from '../properties/PropertyManager.js';
import { RecordPageProperties } from '../databases/RecordPageProperties.js';
import { TemplateDefaults } from '../templates/TemplateDefaults.js';

function PageProperty({
  page,
  field,
  readOnly,
  computed,
}: {
  page: Page;
  field: RecordField;
  readOnly: boolean;
  computed: Record<string, number | null>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const label = t('{{field}} for {{title}}', { field: field.name, title: page.title });
  if (field.type === 'formula')
    return (
      <output
        className="computed-value"
        aria-label={label}
        title={displayFormula(field.formula ?? '', page.properties?.fields ?? [])}
      >
        {computed[field.id] ?? '—'}
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
              await useWorkspace
                .getState()
                .updatePage(page.id, { propertyAction: field.id }, page.revision);
            } catch (failure) {
              setError((failure as Error).message);
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
      initial={page.properties?.values[field.id]}
      field={field}
      readOnly={readOnly}
      relationKind="page"
      templateRootId={page.templateRootId}
      label={label}
      save={(value, original, originalField) =>
        useWorkspace.getState().updatePage(page.id, {
          property: {
            id: field.id,
            value,
            expectedValue: original,
            expectedField: originalField ?? field,
          },
        })
      }
    />
  );
}

function DocumentProperties({ page, readOnly }: { page: Page; readOnly: boolean }) {
  const properties = page.properties ?? { fields: [], values: {} },
    [manager, setManager] = useState<'add' | 'manage' | null>(null),
    [opening, setOpening] = useState(false),
    openingRequest = useRef(0),
    calculate = useMemo(() => compileFormulas(properties.fields), [properties.fields]),
    computed = calculate(properties.values);
  useEffect(
    () => () => {
      openingRequest.current++;
    },
    [page.id],
  );
  async function openManager(mode: 'add' | 'manage') {
    const state = useWorkspace.getState(),
      identity = state.user?.id,
      workspace = state.workspaceId,
      request = ++openingRequest.current;
    const current = () => {
      const state = useWorkspace.getState();
      return (
        request === openingRequest.current &&
        identity === state.user?.id &&
        workspace === state.workspaceId &&
        state.selectedId === page.id &&
        state.pages.some((item) => item.id === page.id) &&
        state.workspaces.find((item) => item.id === workspace)?.role !== 'viewer'
      );
    };
    setOpening(true);
    try {
      await state.settlePageWrites([page.id]);
      if (current()) setManager(mode);
    } catch (error) {
      if (current()) useWorkspace.getState().setError(error);
    } finally {
      if (request === openingRequest.current) setOpening(false);
    }
  }
  return (
    <section className="page-properties" aria-label={t('Page properties')}>
      {!!properties.fields.filter((field) => !field.archived).length && (
        <dl className="record-properties">
          {properties.fields
            .filter((field) => !field.archived)
            .map((field) => (
              <div key={field.id}>
                <dt>{field.name}</dt>
                <dd>
                  <PageProperty page={page} field={field} readOnly={readOnly} computed={computed} />
                </dd>
              </div>
            ))}
        </dl>
      )}
      {!readOnly && (
        <div className="page-property-tools">
          <button
            aria-label={t('Add page property')}
            disabled={opening}
            onClick={() => void openManager('add')}
          >
            <Plus size={12} />
            {t('Add property')}
          </button>
          {!!properties.fields.length && (
            <button
              aria-label={t('Manage page properties')}
              disabled={opening}
              onClick={() => void openManager('manage')}
            >
              <SlidersHorizontal size={12} />
              {t('Properties')}
            </button>
          )}
          {opening && (
            <small className="muted-text" role="status">
              {t('Saving current edits…')}
            </small>
          )}
        </div>
      )}
      {manager && (
        <PropertyManager
          label={t('Page properties')}
          fields={properties.fields}
          revision={page.revision}
          initialAdd={manager === 'add'}
          close={() => setManager(null)}
          commit={(fields, revision) =>
            useWorkspace.getState().updatePage(page.id, { fields }, revision)
          }
        />
      )}
    </section>
  );
}

export function PageProperties({ page, readOnly }: { page: Page; readOnly: boolean }) {
  if (page.templateDatabaseId) return <TemplateDefaults page={page} readOnly={readOnly} />;
  if (page.kind === 'record') return <RecordPageProperties page={page} readOnly={readOnly} />;
  if (!['document', 'canvas'].includes(page.kind)) return null;
  return <DocumentProperties page={page} readOnly={readOnly} />;
}
