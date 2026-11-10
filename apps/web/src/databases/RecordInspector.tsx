import { t } from '../i18n/index.js';
import { lazy, Suspense, useEffect, useRef, useMemo } from 'react';
import { compileFormulas } from '@note/data/formulas';
import { ArrowUpRight, X } from 'lucide-react';
import type { Page, RecordField } from '@note/contracts';
import { useWorkspace } from '../state/store.js';
import { api } from '../state/api.js';
import { IconButton } from '../ui/IconButton.js';
import { Cell } from './Cell.js';
import { RecordProperty } from './RecordProperty.js';
const Editor = lazy(() =>
  import('../documents/Editor.js').then((module) => ({ default: module.DocumentEditor })),
);

export function RecordInspector({
  databaseId,
  pageId,
  fields,
  readOnly,
  close,
  refresh,
}: {
  databaseId: string;
  pageId: string;
  fields: RecordField[];
  readOnly: boolean;
  close(): void;
  refresh(): Promise<void>;
}) {
  const entity = useWorkspace((state) => state.recordEntities[pageId]);
  const calculate = useMemo(() => compileFormulas(fields), [fields]);
  const record = useMemo(
    () => (entity ? { ...entity, computedValues: calculate(entity.values) } : null),
    [entity, calculate],
  );
  const page = useWorkspace((state) => state.pages.find((page) => page.id === pageId));
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const identity = useWorkspace.getState().user?.id,
      workspace = useWorkspace.getState().workspaceId;
    let active = true;
    // Load the record's page once on open when the workspace does not hold it yet.
    if (!useWorkspace.getState().pages.some((item) => item.id === pageId))
      void api<Page>(`/pages/${pageId}`)
        .then((page) => {
          const state = useWorkspace.getState();
          if (active && identity === state.user?.id && workspace === state.workspaceId)
            state.receivePage(page);
        })
        .catch(useWorkspace.getState().setError);
    const previous = document.activeElement as HTMLElement;
    root.current?.focus();
    return () => {
      active = false;
      if (previous?.isConnected) previous.focus();
    };
  }, [pageId]);
  if (!record) return null;
  return (
    <aside
      ref={root}
      tabIndex={-1}
      className="record-inspector"
      role="region"
      aria-label={t('Record details')}
      onKeyDown={(event) => {
        // The record's own editor uses Escape first (it lifts the caret into a block selection).
        if (
          event.key === 'Escape' &&
          !event.defaultPrevented &&
          !document.querySelector('dialog[open],.app-popover,.block-popover')
        ) {
          event.preventDefault();
          close();
        }
      }}
    >
      <header>
        <span>{t('Record')}</span>
        <IconButton
          label={t('Open record in tab')}
          onClick={() => {
            close();
            useWorkspace.getState().openTab(pageId);
          }}
        >
          <ArrowUpRight />
        </IconButton>
        <IconButton label={t('Close record')} onClick={close}>
          <X />
        </IconButton>
      </header>
      <div className="record-inspector-scroll">
        <div className="record-inspector-name">
          <Cell
            initial={record.title}
            label={t('Record name')}
            readOnly={readOnly}
            save={async (value) => {
              await useWorkspace
                .getState()
                .editRecord(databaseId, pageId, { title: String(value) });
              await refresh();
            }}
          />
        </div>
        <dl className="record-properties">
          {fields
            .filter((field) => !field.archived)
            .map((field) => (
              <div key={field.id}>
                <dt>{field.name}</dt>
                <dd>
                  <RecordProperty
                    databaseId={databaseId}
                    record={record}
                    field={field}
                    readOnly={readOnly}
                    refresh={refresh}
                  />
                </dd>
              </div>
            ))}
        </dl>
        <div className="record-document">
          <Suspense fallback={<p className="loading-note">{t('Opening document…')}</p>}>
            {page && <Editor page={page} embedded />}
          </Suspense>
        </div>
      </div>
    </aside>
  );
}
