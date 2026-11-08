import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Columns3,
  Filter,
  Plus,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react';
import type { TableDefinition, TableOptions } from './state.js';
import { IconButton } from '../ui/IconButton.js';
export function DatabaseToolbar({
  definition,
  options,
  change,
  selected,
  selectView,
  readOnly,
  create,
  columns,
  property,
  filter,
  view,
}: {
  definition?: TableDefinition;
  options: TableOptions;
  change(options: TableOptions): void;
  selected: string;
  selectView(id: string): void;
  readOnly: boolean;
  create(): void;
  columns(): void;
  property(add: boolean): void;
  filter(): void;
  view(edit: boolean): void;
}) {
  const fields = definition?.fields.filter((field) => !field.archived) ?? [];
  return (
    <div className="table-toolbar">
      <div className="view-tabs">
        <button className={selected === 'all' ? 'active' : ''} onClick={() => selectView('all')}>
          All records
        </button>
        {definition?.views.map((item) => (
          <button
            key={item.id}
            className={selected === item.id ? 'active' : ''}
            onClick={() => selectView(item.id)}
          >
            {item.name}
          </button>
        ))}
        {!readOnly && (
          <button onClick={() => view(false)}>
            <Plus />
            New view
          </button>
        )}
      </div>
      <div className="table-actions">
        <select
          aria-label="Layout"
          value={options.layout ?? 'table'}
          onChange={(event) =>
            change({
              ...options,
              layout: event.target.value as TableOptions['layout'],
              groupBy:
                options.groupBy ??
                fields.find((field) => ['select', 'checkbox'].includes(field.type))?.id,
              dateField: options.dateField ?? fields.find((field) => field.type === 'date')?.id,
              offset: 0,
            })
          }
        >
          {['table', 'board', 'list', 'calendar'].map((layout) => (
            <option value={layout} key={layout}>
              {layout[0].toUpperCase() + layout.slice(1)}
            </option>
          ))}
        </select>
        {options.layout === 'board' && (
          <select
            aria-label="Group by"
            value={options.groupBy ?? ''}
            onChange={(event) => change({ ...options, groupBy: event.target.value, offset: 0 })}
          >
            <option value="">Group by…</option>
            {fields
              .filter((field) => ['select', 'checkbox'].includes(field.type))
              .map((field) => (
                <option key={field.id} value={field.id}>
                  {field.name}
                </option>
              ))}
          </select>
        )}
        {options.layout === 'calendar' && (
          <select
            aria-label="Date property"
            value={options.dateField ?? ''}
            onChange={(event) => change({ ...options, dateField: event.target.value, offset: 0 })}
          >
            <option value="">Date property…</option>
            {fields
              .filter((field) => field.type === 'date')
              .map((field) => (
                <option key={field.id} value={field.id}>
                  {field.name}
                </option>
              ))}
          </select>
        )}
        <IconButton label="Visible columns" onClick={columns}>
          <Columns3 />
        </IconButton>
        <button className="button" onClick={filter}>
          <Filter />
          Filter
        </button>
        <label className="sort-control">
          <ArrowDownUp />
          <select
            aria-label="Sort records"
            value={options.sort ?? ''}
            onChange={(event) => change({ ...options, sort: event.target.value, offset: 0 })}
          >
            <option value="">Sort</option>
            <option value="title">Name</option>
            {fields
              .filter((field) => field.type !== 'button')
              .map((field) => (
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
              change({
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
            <IconButton label="Add property" onClick={() => property(true)}>
              <Settings2 />
            </IconButton>
            <IconButton label="Manage properties" onClick={() => property(false)}>
              <SlidersHorizontal />
            </IconButton>
            {selected !== 'all' && (
              <button className="button" onClick={() => view(true)}>
                Edit view
              </button>
            )}
            <button className="button primary" onClick={create}>
              <Plus />
              New record
            </button>
          </>
        )}
      </div>
    </div>
  );
}
