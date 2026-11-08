import type { View } from '../state/store.js';
export interface WorkbenchLocation {
  pageId: string | null;
  view: View;
}
export interface WorkbenchHistory {
  entries: WorkbenchLocation[];
  index: number;
}
const same = (a: WorkbenchLocation | undefined, b: WorkbenchLocation) =>
  a?.pageId === b.pageId && a.view === b.view;
export function navigateHistory(
  history: WorkbenchHistory,
  location: WorkbenchLocation,
  mode: 'push' | 'replace' | 'none',
  entryIndex?: number,
): WorkbenchHistory {
  if (!history.entries.length) return { entries: [location], index: 0 };
  if (mode === 'none') {
    if (entryIndex !== undefined && same(history.entries[entryIndex], location))
      return { ...history, index: entryIndex };
    let index = history.entries.length - 1;
    while (index >= 0 && !same(history.entries[index], location)) index--;
    return index >= 0 ? { ...history, index } : { entries: [location], index: 0 };
  }
  if (mode === 'replace') {
    const entries = [...history.entries];
    entries[history.index] = location;
    return { entries, index: history.index };
  }
  if (same(history.entries[history.index], location)) return history;
  const entries = [...history.entries.slice(0, history.index + 1), location];
  return { entries, index: entries.length - 1 };
}
