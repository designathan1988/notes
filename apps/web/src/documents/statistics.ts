import { useSyncExternalStore } from 'react';

/**
 * The open page's word count and reading time, published by the editor and read by the page
 * header's chips. A tiny store of its own: it changes as people type, and nothing else needs it.
 */
export type PageStatistics = { words: number; minutes: number };
const values = new Map<string, PageStatistics>();
const listeners = new Set<() => void>();

export function publishStatistics(pageId: string, statistics: PageStatistics) {
  const previous = values.get(pageId);
  if (previous?.words === statistics.words && previous.minutes === statistics.minutes) return;
  values.set(pageId, statistics);
  for (const listener of listeners) listener();
}

export function usePageStatistics(pageId: string): PageStatistics | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => values.get(pageId),
  );
}
