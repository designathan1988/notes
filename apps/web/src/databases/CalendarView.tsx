import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import type { DatabaseRecord } from '../../../../packages/contracts/src/index.js';
import { useWorkspace } from '../state/store.js';
import { calendarDate, calendarDays } from './calendar.js';
import { useRecordDrag } from './useRecordDrag.js';

export function CalendarView({
  id,
  records,
  dateField,
  month,
  changeMonth,
  undated,
  toggleUndated,
  readOnly,
  inspect,
  refresh,
  error,
}: {
  id: string;
  records: DatabaseRecord[];
  dateField?: string;
  month: Date;
  changeMonth(offset: number): void;
  undated: boolean;
  toggleUndated(): void;
  readOnly: boolean;
  inspect(id: string): void;
  refresh(): Promise<void>;
  error(message: string): void;
}) {
  const move = async (recordId: string, date: string) => {
    if (!dateField || readOnly) return;
    await useWorkspace.getState().editRecord(id, recordId, { values: { [dateField]: date } });
    await refresh();
  };
  const drag = useRecordDrag(move, error);
  const days = calendarDays(month);
  if (!dateField)
    return (
      <div className="table-empty">Add a date property to place your records on a calendar.</div>
    );
  const card = (record: DatabaseRecord) => (
    <div className="calendar-record" key={record.pageId}>
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
          title="Drag to another date"
          onPointerDown={(event) => drag.begin(record.pageId, record.title, event)}
        >
          <GripVertical size={13} />
        </button>
      )}
    </div>
  );
  return (
    <div className="database-calendar" ref={drag.root}>
      <header>
        <h3>{new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(month)}</h3>
        <button aria-label="Previous month" onClick={() => changeMonth(-1)}>
          <ChevronLeft size={17} />
        </button>
        <button aria-label="Next month" onClick={() => changeMonth(1)}>
          <ChevronRight size={17} />
        </button>
        <button aria-pressed={undated} onClick={toggleUndated}>
          Undated
        </button>
      </header>
      {undated && (
        <div className="calendar-undated" aria-label="Undated records">
          {records.map(card)}
          {!records.length && <p>No undated records in this view.</p>}
        </div>
      )}
      <div className="calendar-grid" role="grid" aria-label="Record calendar">
        <div role="row" className="calendar-week">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} role="columnheader" className="calendar-weekday">
              {day}
            </div>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, week) => (
          <div role="row" className="calendar-week" key={week}>
            {days.slice(week * 7, week * 7 + 7).map((date) => {
              const key = calendarDate(date);
              return (
                <div
                  role="gridcell"
                  aria-label={new Intl.DateTimeFormat('en', { dateStyle: 'full' }).format(date)}
                  key={key}
                  data-calendar-date={key}
                  data-record-drop={key}
                  className={`calendar-day ${date.getMonth() !== month.getMonth() ? 'outside-month' : ''} ${drag.over === key ? 'drop-active' : ''}`}
                >
                  <time dateTime={key}>{date.getDate()}</time>
                  {!undated &&
                    records.filter((record) => record.values[dateField] === key).map(card)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {!undated && (
        <ul className="calendar-agenda" aria-label="Monthly agenda">
          {records.map((record) => (
            <li key={record.pageId}>
              <time dateTime={String(record.values[dateField] ?? '')}>
                {String(record.values[dateField] ?? '')
                  .slice(5)
                  .replace('-', '/')}
              </time>
              {card(record)}
            </li>
          ))}
          {!records.length && <li>No records in this calendar view.</li>}
        </ul>
      )}
      {drag.ghost}
    </div>
  );
}
