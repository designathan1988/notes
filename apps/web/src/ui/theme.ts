import { useSyncExternalStore } from 'react';

export type Theme = 'system' | 'light' | 'dark';
const KEY = 'note:theme';
const listeners = new Set<() => void>();

/** Per-browser display preference. index.html applies it before first paint. */
export function readTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    /* The choice still applies for this page. */
  }
  listeners.forEach((listener) => listener());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readTheme,
    () => 'system',
  );
}
