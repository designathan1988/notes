import { useEffect, useId, useRef, useState } from 'react';
import { Search, Plus, Compass, Settings2, FileText } from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import { Dialog } from '../ui/Dialog.js';
import { availableCommands, type AppCommand } from './commands.js';

const groupStyle: Record<AppCommand['group'], { Icon: typeof Plus; tone: number }> = {
  Create: { Icon: Plus, tone: 0 },
  Navigate: { Icon: Compass, tone: 3 },
  Workspace: { Icon: Settings2, tone: 1 },
  Page: { Icon: FileText, tone: 2 },
};
function GroupIcon({ group }: { group: AppCommand['group'] }) {
  const { Icon, tone } = groupStyle[group];
  return (
    <span className="kind-tile command-tile" data-tone={tone} aria-hidden="true">
      <Icon size={15} />
    </span>
  );
}
export function CommandPalette() {
  const state = useWorkspace(),
    [query, setQuery] = useState(''),
    [active, setActive] = useState(0),
    list = useRef<HTMLDivElement>(null),
    id = useId();
  const results = availableCommands(state, query);
  useEffect(() => {
    list.current?.querySelectorAll('[role=option]')[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  const run = (command: AppCommand) => {
    useWorkspace.getState().hideCommands();
    void Promise.resolve(command.run(useWorkspace.getState())).catch(
      useWorkspace.getState().setError,
    );
  };
  return (
    <Dialog title="Command palette" onClose={() => useWorkspace.getState().hideCommands()} wide>
      <div className="command-input">
        <Search size={19} />
        <input
          autoFocus
          role="combobox"
          aria-label="Search commands"
          aria-expanded="true"
          aria-controls={id}
          aria-activedescendant={results[active] ? `${id}-${active}` : undefined}
          value={query}
          placeholder="What would you like to do?"
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setActive(
                (value) =>
                  (value + (event.key === 'ArrowDown' ? 1 : -1) + results.length) %
                  Math.max(1, results.length),
              );
            }
            if (event.key === 'Enter' && results[active]) {
              event.preventDefault();
              run(results[active]);
            }
          }}
        />
        <kbd>Esc</kbd>
      </div>
      <div className="command-results" ref={list} id={id} role="listbox" aria-label="Commands">
        {results.map((command, index) => (
          <button
            key={command.id}
            id={`${id}-${index}`}
            role="option"
            aria-selected={active === index}
            className={index === active ? 'active' : ''}
            onMouseEnter={() => setActive(index)}
            onClick={() => run(command)}
          >
            <GroupIcon group={command.group} />
            <span>
              <strong>{command.title}</strong>
              <small>{command.group}</small>
            </span>
            {command.shortcut && <kbd>{command.shortcut.label}</kbd>}
          </button>
        ))}
        {!results.length && <p className="table-empty">No matching commands.</p>}
      </div>
      <footer className="search-footer">
        <span>↑ ↓ to navigate · Enter to run</span>
        <span>Ctrl K to find a page</span>
      </footer>
    </Dialog>
  );
}
