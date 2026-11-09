import { t } from '../i18n/index.js';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Database, Plus, X } from 'lucide-react';
import { compileFormulas } from '@note/data/formulas';
import { useWorkspace } from '../state/store.js';
import { Dialog } from '../ui/Dialog.js';
import { IconButton } from '../ui/IconButton.js';
import { tableQueryKey, type TableOptions } from './state.js';
import { DatabaseToolbar } from './DatabaseToolbar.js';
import { RecordTable } from './RecordTable.js';
import { BoardView } from './BoardView.js';
import { ListView } from './ListView.js';
import { CalendarView } from './CalendarView.js';
import { calendarDate, calendarDays } from './calendar.js';
import { RecordInspector } from './RecordInspector.js';
import { PropertyManager } from './PropertyManager.js';
import { ViewSettings } from './ViewSettings.js';
const emptyRecords: never[] = [];

export function DatabaseView({ id, compact = false }: { id: string; compact?: boolean }) {
  const definition = useWorkspace((state) => state.tables[id]),
    entities = useWorkspace((state) => state.recordEntities),
    load = useWorkspace((state) => state.loadTable);
  const role = useWorkspace(
      (state) => state.workspaces.find((item) => item.id === state.workspaceId)?.role,
    ),
    readOnly = role === 'viewer';
  const [options, setOptions] = useState<TableOptions>({ limit: compact ? 3 : 50 });
  const preferredView = useWorkspace((state) => state.tableSelections[id] ?? 'all');
  const selectedView = compact ? 'all' : preferredView;
  const restored = useRef(false);
  const [filterOpen, setFilterOpen] = useState(false),
    [columnsOpen, setColumnsOpen] = useState(false),
    [property, setProperty] = useState<'add' | 'manage' | 'date' | null>(null),
    [viewEditing, setViewEditing] = useState<'new' | 'edit' | null>(null);
  const [newRecord, setNewRecord] = useState<Record<string, unknown> | null>(null),
    [recordName, setRecordName] = useState(''),
    [inspected, setInspected] = useState<string | null>(null);
  const [error, setError] = useState(''),
    [loadError, setLoadError] = useState(''),
    [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(
      () => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12),
    ),
    [undated, setUndated] = useState(false);
  const queryOptions = useMemo(() => {
    const days = calendarDays(month);
    return options.layout === 'calendar' && options.dateField
      ? {
          ...options,
          undated,
          ...(!undated ? { dateFrom: calendarDate(days[0]), dateTo: calendarDate(days[41]) } : {}),
        }
      : options;
  }, [options, month, undated]);
  const query = useWorkspace((state) => state.tableQueries[tableQueryKey(id, queryOptions)]);
  const refresh = useCallback(() => load(id, queryOptions), [id, queryOptions, load]);
  useEffect(() => {
    let active = true;
    const update = () =>
      void refresh()
        .then(() => {
          if (active) setLoadError('');
        })
        .catch((error) => {
          if (active) setLoadError(error.message);
        });
    update();
    const timer = setInterval(update, 3500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refresh]);
  const records = useMemo(() => {
    if (!definition || !query) return emptyRecords;
    const calculate = compileFormulas(definition.fields);
    return query.ids
      .map((id) => entities[id])
      .filter(Boolean)
      .map((record) => ({ ...record, computedValues: calculate(record.values) }));
  }, [definition, query, entities]);
  const fields = definition?.fields ?? emptyRecords;
  const activeFields = useMemo(() => fields.filter((field) => !field.archived), [fields]);
  // Stable column definitions keep focused cells and their dialogs mounted during row refreshes.
  const visibleFields = useMemo(
    () =>
      compact
        ? activeFields.slice(0, 2)
        : options.columns
          ? activeFields.filter((field) => options.columns!.includes(field.id))
          : activeFields,
    [activeFields, compact, options.columns],
  );
  const selected = definition?.views.find((view) => view.id === selectedView);
  const selectView = (value: string) => {
    if (!compact) useWorkspace.getState().selectTableView(id, value);
    setOptions(
      value === 'all'
        ? { limit: 50 }
        : { ...definition?.views.find((view) => view.id === value)?.config, limit: 50 },
    );
    setUndated(false);
  };
  useEffect(() => {
    if (compact || !definition) return;
    const saved = definition.views.find((view) => view.id === preferredView);
    if (!restored.current) {
      restored.current = true;
      if (saved) setOptions({ ...saved.config, limit: 50 });
    }
    if (preferredView !== 'all' && !saved) {
      useWorkspace.getState().selectTableView(id, 'all');
      setOptions({ limit: 50 });
    }
  }, [id, compact, definition, preferredView]);
  const create = (values: Record<string, unknown> = {}) => {
    setRecordName('');
    setNewRecord(values);
    setError('');
  };
  const inspect = useCallback((pageId: string) => setInspected(pageId), []);
  return (
    <div
      className={`database-view ${compact ? 'compact' : ''}${inspected ? ' has-inspector' : ''}`}
      contentEditable={false}
    >
      {compact ? (
        <div className="embedded-table-title">
          <Database size={15} />
          <strong>{definition?.title ?? t('Database view')}</strong>
        </div>
      ) : (
        <DatabaseToolbar
          definition={definition}
          options={options}
          change={setOptions}
          selected={selectedView}
          selectView={selectView}
          readOnly={readOnly}
          create={() => create()}
          columns={() => setColumnsOpen(true)}
          property={(add) => setProperty(add ? 'add' : 'manage')}
          filter={() => setFilterOpen((value) => !value)}
          view={(edit) => setViewEditing(edit ? 'edit' : 'new')}
          templates={() => {
            const state = useWorkspace.getState();
            useWorkspace.getState().setTemplateFilters({ database: id, kind: 'record', q: '' });
            state.navigate(null, 'templates');
          }}
        />
      )}
      {filterOpen && (
        <label className="table-filter">
          {t('Filter records')}
          <input
            autoFocus
            placeholder={t('Search names and properties…')}
            value={options.filter ?? ''}
            onChange={(event) => setOptions({ ...options, filter: event.target.value, offset: 0 })}
          />
        </label>
      )}
      {newRecord && !readOnly && (
        <form
          className="inline-record-create"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            try {
              const record = await useWorkspace.getState().createRecord(id, recordName, newRecord);
              await refresh();
              setNewRecord(null);
              if (record) setInspected(record.pageId);
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Plus size={16} />
          <input
            autoFocus
            aria-label={t('New record name')}
            required
            maxLength={300}
            placeholder={t('Name this record…')}
            value={recordName}
            onChange={(event) => setRecordName(event.target.value)}
          />
          <button className="inline-record-submit" disabled={busy || !recordName.trim()}>
            {t('Add')} <kbd aria-hidden="true">{t('Enter')}</kbd>
          </button>
          <IconButton label={t('Cancel new record')} onClick={() => setNewRecord(null)}>
            <X />
          </IconButton>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {t(error)}
        </p>
      )}
      {loadError && (
        <p className="form-error" role="alert">
          {loadError}{' '}
          <button
            className="text-button"
            onClick={() =>
              void refresh()
                .then(() => setLoadError(''))
                .catch((error) => setLoadError(error.message))
            }
          >
            {t('Retry records')}
          </button>
        </p>
      )}
      {(!options.layout || options.layout === 'table' || compact) && (
        <RecordTable
          id={id}
          records={records}
          fields={visibleFields}
          compact={compact}
          readOnly={readOnly}
          inspect={inspect}
          refresh={refresh}
        />
      )}
      {!compact && options.layout === 'board' && (
        <BoardView
          id={id}
          records={records}
          fields={activeFields}
          groupBy={options.groupBy}
          readOnly={readOnly}
          inspect={inspect}
          refresh={refresh}
          create={create}
          error={setError}
        />
      )}
      {!compact && options.layout === 'list' && (
        <ListView
          id={id}
          records={records}
          fields={visibleFields}
          readOnly={readOnly}
          inspect={inspect}
          refresh={refresh}
        />
      )}
      {!compact && options.layout === 'calendar' && (
        <CalendarView
          id={id}
          records={records}
          dateField={options.dateField}
          addDateProperty={() => setProperty('date')}
          month={month}
          changeMonth={(offset) => {
            setMonth((value) => new Date(value.getFullYear(), value.getMonth() + offset, 1, 12));
            setOptions({ ...options, offset: 0 });
          }}
          undated={undated}
          toggleUndated={() => {
            setUndated((value) => !value);
            setOptions({ ...options, offset: 0 });
          }}
          readOnly={readOnly}
          inspect={inspect}
          refresh={refresh}
          error={setError}
        />
      )}
      {query && !records.length && options.layout !== 'calendar' && (
        <div className="table-empty">{t('No records match this view.')}</div>
      )}
      {!query && !loadError && (
        <div className="table-empty" role="status">
          {t('Loading records…')}
        </div>
      )}
      {!compact ? (
        <>
          <div className="table-footer">
            {!readOnly && (
              <button onClick={() => create()}>
                <Plus />
                {t('New record')}
              </button>
            )}
            <span>
              {query?.total ?? 0} {(query?.total ?? 0) === 1 ? t('record') : t('records')}
              {(query?.total ?? 0) > 50
                ? t(' · Showing {{value0}}–{{value1}}', {
                    value0: (options.offset ?? 0) + 1,
                    value1: Math.min((options.offset ?? 0) + 50, query?.total ?? 0),
                  })
                : ''}
            </span>
            {(query?.total ?? 0) > 50 && (
              <div>
                <IconButton
                  label={t('Previous records')}
                  disabled={!options.offset}
                  onClick={() =>
                    setOptions({ ...options, offset: Math.max(0, (options.offset ?? 0) - 50) })
                  }
                >
                  <ChevronLeft />
                </IconButton>
                <IconButton
                  label={t('Next records')}
                  disabled={(options.offset ?? 0) + 50 >= (query?.total ?? 0)}
                  onClick={() => setOptions({ ...options, offset: (options.offset ?? 0) + 50 })}
                >
                  <ChevronRight />
                </IconButton>
              </div>
            )}
          </div>
          <p className="table-hint">
            {t('Changes appear in every connected view.')}
            {options.layout === 'board' && (query?.total ?? 0) > 50
              ? t(' Group counts reflect the current page of records.')
              : ''}
          </p>
        </>
      ) : (
        <div className="embedded-table-footer">
          {!readOnly && (
            <button className="text-button" onClick={() => create()}>
              <Plus size={13} />
              {t('New record')}
            </button>
          )}
          <button
            className="open-table"
            onClick={() => useWorkspace.getState().navigate(id, 'database')}
          >
            <ArrowUpRight />
            {t('Open database')}
          </button>
        </div>
      )}
      {columnsOpen && (
        <Dialog title={t('Visible columns')} onClose={() => setColumnsOpen(false)}>
          <div className="column-list">
            <label className="checkbox-label">
              <input type="checkbox" checked disabled />
              {t('Name')}
            </label>
            {activeFields.map((field) => (
              <label className="checkbox-label" key={field.id}>
                <input
                  type="checkbox"
                  checked={!options.columns || options.columns.includes(field.id)}
                  onChange={(event) => {
                    const current = options.columns ?? activeFields.map((field) => field.id);
                    setOptions({
                      ...options,
                      columns: event.target.checked
                        ? [...current, field.id]
                        : current.filter((id) => id !== field.id),
                    });
                  }}
                />
                {field.name}
              </label>
            ))}
          </div>
          <p className="muted-text">{t('Save a view to keep this column selection.')}</p>
          <button className="button" onClick={() => setColumnsOpen(false)}>
            {t('Done')}
          </button>
        </Dialog>
      )}
      {property && definition && (
        <PropertyManager
          id={id}
          fields={fields}
          revision={definition.fieldsRevision}
          initialAdd={property === 'add' || property === 'date'}
          initialType={property === 'date' ? 'date' : undefined}
          onCreated={(field) => {
            if (property === 'date' && field.type === 'date')
              setOptions((current) => ({ ...current, dateField: field.id, offset: 0 }));
          }}
          close={() => setProperty(null)}
          refresh={refresh}
        />
      )}
      {viewEditing && (
        <ViewSettings
          id={id}
          view={viewEditing === 'edit' ? (selected ?? null) : null}
          config={options}
          close={() => setViewEditing(null)}
          saved={(viewId) => useWorkspace.getState().selectTableView(id, viewId)}
          removed={() => selectView('all')}
          refresh={refresh}
        />
      )}
      {inspected && definition && (
        <RecordInspector
          databaseId={id}
          pageId={inspected}
          fields={fields}
          readOnly={readOnly}
          close={() => setInspected(null)}
          refresh={refresh}
        />
      )}
    </div>
  );
}
