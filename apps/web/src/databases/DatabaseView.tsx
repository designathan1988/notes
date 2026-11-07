import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import {
  Plus,
  Filter,
  ArrowDownUp,
  FileText,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Settings2,
  Columns3,
  Database,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import { api, json } from '../state/api.js';
import type { DatabaseRecord, RecordField } from '../../../../packages/contracts/src/index.js';
import { tableQueryKey, type TableOptions } from './state.js';
import { Dialog } from '../ui/Dialog.js';
import { IconButton } from '../ui/IconButton.js';
import { Cell } from './Cell.js';
const emptyRows: DatabaseRecord[] = [];
export function DatabaseView({ id, compact = false }: { id: string; compact?: boolean }) {
  const definition = useWorkspace((state) => state.tables[id]);
  const load = useWorkspace((state) => state.loadTable);
  const [options, setOptions] = useState<TableOptions>({ limit: compact ? 3 : 50 });
  const query = useWorkspace((state) => state.tableQueries[tableQueryKey(id, options)]);
  const entities = useWorkspace((state) => state.recordEntities);
  const snapshot = useMemo(
    () =>
      definition && query
        ? {
            ...definition,
            total: query.total,
            records: query.ids.map((id) => entities[id]).filter(Boolean),
          }
        : undefined,
    [definition, query, entities],
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [newRecord, setNewRecord] = useState(false);
  const [newView, setNewView] = useState(false);
  const [property, setProperty] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [selectedView, setSelectedView] = useState('all');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const role = useWorkspace(
    (state) => state.workspaces.find((item) => item.id === state.workspaceId)?.role,
  );
  const readOnly = role === 'viewer';
  useEffect(() => {
    let active = true;
    const refresh = () =>
      void load(id, options)
        .then(() => {
          if (active) setLoadError('');
        })
        .catch((error) => {
          if (active) setLoadError(error.message);
        });
    refresh();
    const timer = setInterval(refresh, 3500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, options, load]);
  const fields = snapshot?.fields ?? [];
  const visibleFields = compact
    ? fields.slice(0, 2)
    : options.columns
      ? fields.filter((field) => options.columns!.includes(field.id))
      : fields;
  const columns = useMemo<ColumnDef<DatabaseRecord>[]>(
    () => [
      {
        id: 'title',
        header: 'Name',
        cell: ({ row }) => (
          <div className="record-name">
            <IconButton
              label={`Open ${row.original.title}`}
              onClick={() => useWorkspace.getState().navigate(row.original.pageId)}
            >
              <FileText />
            </IconButton>
            <Cell
              initial={row.original.title}
              readOnly={readOnly}
              label={`Name for ${row.original.title}`}
              save={async (value) => {
                await useWorkspace
                  .getState()
                  .editRecord(id, row.original.pageId, { title: String(value) });
                await load(id, options);
              }}
            />
          </div>
        ),
      },
      ...visibleFields.map((field) => ({
        id: field.id,
        header: field.name,
        cell: ({ row }: { row: { original: DatabaseRecord } }) => (
          <Cell
            initial={row.original.values[field.id]}
            field={field}
            readOnly={readOnly}
            label={`${field.name} for ${row.original.title}`}
            save={async (value) => {
              await useWorkspace
                .getState()
                .editRecord(id, row.original.pageId, { values: { [field.id]: value } });
              await load(id, options);
            }}
          />
        ),
      })),
      ...(!compact
        ? [
            {
              id: 'updated',
              header: 'Updated',
              cell: ({ row }: { row: { original: DatabaseRecord } }) => (
                <span className="table-date">{formatDate(row.original.updatedAt)}</span>
              ),
            },
          ]
        : []),
    ],
    [
      id,
      visibleFields.map((field) => JSON.stringify(field)).join('|'),
      readOnly,
      compact,
      options,
      load,
    ],
  );
  const table = useReactTable({
    data: snapshot?.records ?? emptyRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      await api(`/databases/${id}/records`, {
        method: 'POST',
        body: json({ title: String(data.get('title')), values: {} }),
      });
      await load(id, options);
      setNewRecord(false);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`database-view ${compact ? 'compact' : ''}`} contentEditable={false}>
      {compact && (
        <div className="embedded-table-title">
          <Database size={15} />
          <strong>{definition?.title ?? 'Database view'}</strong>
        </div>
      )}
      {!compact && (
        <div className="table-toolbar">
          <div className="view-tabs">
            <button
              className={selectedView === 'all' ? 'active' : ''}
              onClick={() => {
                setOptions({ limit: 50 });
                setSelectedView('all');
              }}
            >
              All records
            </button>
            {snapshot?.views.map((view) => (
              <button
                key={view.id}
                className={selectedView === view.id ? 'active' : ''}
                onClick={() => {
                  setSelectedView(view.id);
                  setOptions({ ...view.config, limit: 50 });
                }}
              >
                {view.name}
              </button>
            ))}
            {!readOnly && (
              <button onClick={() => setNewView(true)}>
                <Plus />
                New view
              </button>
            )}
          </div>
          <div className="table-actions">
            <IconButton label="Visible columns" onClick={() => setColumnsOpen(true)}>
              <Columns3 />
            </IconButton>
            <button className="button" onClick={() => setFilterOpen(!filterOpen)}>
              <Filter />
              Filter
            </button>
            <label className="sort-control">
              <ArrowDownUp />
              <select
                aria-label="Sort records"
                value={options.sort ?? ''}
                onChange={(event) =>
                  setOptions({ ...options, sort: event.target.value, offset: 0 })
                }
              >
                <option value="">Sort</option>
                <option value="title">Name</option>
                {fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
                <option value="updated">Updated</option>
              </select>
            </label>
            {options.sort && (
              <IconButton
                label={options.direction === 'desc' ? 'Sort descending' : 'Sort ascending'}
                onClick={() =>
                  setOptions({
                    ...options,
                    direction: options.direction === 'desc' ? 'asc' : 'desc',
                    offset: 0,
                  })
                }
              >
                {options.direction === 'desc' ? <ArrowDown /> : <ArrowUp />}
              </IconButton>
            )}
            {!readOnly && (
              <>
                <IconButton label="Add property" onClick={() => setProperty(true)}>
                  <Settings2 />
                </IconButton>
                <button className="button primary" onClick={() => setNewRecord(true)}>
                  <Plus />
                  New record
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {filterOpen && (
        <label className="table-filter">
          Filter records
          <input
            autoFocus
            placeholder="Search names and properties…"
            value={options.filter ?? ''}
            onChange={(event) => setOptions({ ...options, filter: event.target.value, offset: 0 })}
          />
        </label>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loadError && (
        <p className="form-error" role="alert">
          {loadError}{' '}
          <button
            className="text-button"
            onClick={() =>
              void load(id, options)
                .then(() => setLoadError(''))
                .catch((error) => setLoadError(error.message))
            }
          >
            Retry records
          </button>
        </p>
      )}
      <div className="table-scroll">
        <table aria-label={compact ? 'Related notes' : 'Database records'}>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.original.pageId}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {snapshot && !snapshot.records.length && (
        <div className="table-empty">No records match this view.</div>
      )}
      {!snapshot && !loadError && (
        <div className="table-empty" role="status">
          Loading records…
        </div>
      )}
      {!compact && (
        <>
          <div className="table-footer">
            {!readOnly && (
              <button onClick={() => setNewRecord(true)}>
                <Plus />
                New record
              </button>
            )}
            <span>{snapshot?.total ?? 0} records</span>
            {(snapshot?.total ?? 0) > 50 && (
              <div>
                <IconButton
                  label="Previous records"
                  disabled={!options.offset}
                  onClick={() =>
                    setOptions({ ...options, offset: Math.max(0, (options.offset ?? 0) - 50) })
                  }
                >
                  <ChevronLeft />
                </IconButton>
                <IconButton
                  label="Next records"
                  disabled={(options.offset ?? 0) + 50 >= (snapshot?.total ?? 0)}
                  onClick={() => setOptions({ ...options, offset: (options.offset ?? 0) + 50 })}
                >
                  <ChevronRight />
                </IconButton>
              </div>
            )}
          </div>
          <p className="table-hint">Changes appear in every connected view.</p>
        </>
      )}
      {compact && (
        <div className="embedded-table-footer">
          {!readOnly && (
            <button className="text-button" onClick={() => setNewRecord(true)}>
              <Plus size={13} />
              New record
            </button>
          )}
          <button
            className="open-table"
            onClick={() => useWorkspace.getState().navigate(id, 'database')}
          >
            <ArrowUpRight />
            Open database
          </button>
        </div>
      )}
      {newRecord && (
        <Dialog title="New record" onClose={() => setNewRecord(false)}>
          <form onSubmit={createRecord}>
            <label>
              Name
              <input name="title" autoFocus required maxLength={300} />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button disabled={busy} className="button primary">
              Create record
            </button>
          </form>
        </Dialog>
      )}
      {columnsOpen && (
        <Dialog title="Visible columns" onClose={() => setColumnsOpen(false)}>
          <div className="column-list">
            <label className="checkbox-label">
              <input type="checkbox" checked disabled />
              Name
            </label>
            {fields.map((field) => (
              <label className="checkbox-label" key={field.id}>
                <input
                  type="checkbox"
                  checked={!options.columns || options.columns.includes(field.id)}
                  onChange={(event) => {
                    const current = options.columns ?? fields.map((item) => item.id);
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
          <p className="muted-text">Save a view to keep this column selection.</p>
          <button className="button" onClick={() => setColumnsOpen(false)}>
            Done
          </button>
        </Dialog>
      )}
      {newView && (
        <Dialog title="Save this view" onClose={() => setNewView(false)}>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setBusy(true);
              setError('');
              try {
                const view = await api<{ id: string }>(`/databases/${id}/views`, {
                  method: 'POST',
                  body: json({ name: data.get('name'), config: options }),
                });
                await load(id, options);
                setSelectedView(view.id);
                setNewView(false);
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              View name
              <input name="name" required autoFocus maxLength={100} />
            </label>
            <p className="muted-text">Save the current filter, sort and columns with this view.</p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button disabled={busy} className="button primary">
              Save view
            </button>
          </form>
        </Dialog>
      )}
      {property && (
        <Dialog title="Add a property" onClose={() => setProperty(false)}>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setBusy(true);
              setError('');
              const field: RecordField = {
                id: crypto.randomUUID(),
                name: String(data.get('name')),
                type: String(data.get('type')) as RecordField['type'],
              };
              if (['select', 'multi-select'].includes(field.type))
                field.options = String(data.get('options'))
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean);
              try {
                await api(`/databases/${id}/fields`, {
                  method: 'PUT',
                  body: json({ fields: [...fields, field], revision: snapshot?.fieldsRevision }),
                });
                await load(id, options);
                setProperty(false);
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Name
              <input name="name" autoFocus required maxLength={100} />
            </label>
            <label>
              Type
              <select name="type">
                {[
                  'text',
                  'number',
                  'checkbox',
                  'select',
                  'multi-select',
                  'date',
                  'url',
                  'relation',
                ].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Select options
              <input name="options" placeholder="First option, Second option" />
            </label>
            <button disabled={busy} className="button primary">
              Add property
            </button>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </form>
        </Dialog>
      )}
    </div>
  );
}
function formatDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === new Date(now.getTime() - 86400000).toDateString()) return 'Yesterday';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
}
