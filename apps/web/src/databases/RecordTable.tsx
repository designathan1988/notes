import { t, getLocale } from '../i18n/index.js';
import { useMemo } from 'react';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import { Clock3, FileText, PanelRightOpen, Type, type LucideIcon } from 'lucide-react';
import { fieldIcons } from './fieldIcons.js';

function Head({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="th-label">
      <Icon size={13} aria-hidden />
      {label}
    </span>
  );
}
import type { DatabaseRecord, RecordField } from '@note/contracts';
import { useWorkspace } from '../state/store.js';
import { IconButton } from '../ui/IconButton.js';
import { Cell } from './Cell.js';
import { RecordProperty } from './RecordProperty.js';
export function RecordTable({
  id,
  records,
  fields,
  compact,
  readOnly,
  inspect,
  refresh,
}: {
  id: string;
  records: DatabaseRecord[];
  fields: RecordField[];
  compact: boolean;
  readOnly: boolean;
  inspect(id: string): void;
  refresh(): Promise<void>;
}) {
  const locale = getLocale();
  const columns = useMemo<ColumnDef<DatabaseRecord>[]>(
    () => [
      {
        id: 'title',
        header: () => <Head icon={Type} label={t('Name')} />,
        cell: ({ row }) => (
          <div className="record-name">
            <IconButton
              label={t('Open {{value0}}', { value0: row.original.title })}
              onClick={() => useWorkspace.getState().navigate(row.original.pageId)}
            >
              <FileText />
            </IconButton>
            <Cell
              initial={row.original.title}
              label={t('Name for {{value0}}', { value0: row.original.title })}
              readOnly={readOnly}
              save={async (value) => {
                await useWorkspace
                  .getState()
                  .editRecord(id, row.original.pageId, { title: String(value) });
                await refresh();
              }}
            />
            <IconButton
              label={t('Inspect {{value0}}', { value0: row.original.title })}
              onClick={() => inspect(row.original.pageId)}
            >
              <PanelRightOpen />
            </IconButton>
          </div>
        ),
      },
      ...fields.map((field) => ({
        id: field.id,
        header: () => <Head icon={fieldIcons[field.type] ?? Type} label={field.name} />,
        cell: ({ row }: { row: { original: DatabaseRecord } }) => (
          <RecordProperty
            databaseId={id}
            record={row.original}
            field={field}
            readOnly={readOnly}
            refresh={refresh}
          />
        ),
      })),
      ...(!compact
        ? [
            {
              id: 'updated',
              header: () => <Head icon={Clock3} label={t('Updated')} />,
              cell: ({ row }: { row: { original: DatabaseRecord } }) => (
                <span className="table-date">
                  {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(
                    new Date(row.original.updatedAt),
                  )}
                </span>
              ),
            },
          ]
        : []),
    ],
    [id, fields, compact, readOnly, inspect, refresh, locale],
  );
  const table = useReactTable({ data: records, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <div className="table-scroll">
      <table aria-label={compact ? t('Related notes') : t('Database records')}>
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
  );
}
