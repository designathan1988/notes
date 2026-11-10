import type { PageKind } from '@note/contracts';
import { useWorkspace } from '../state/store.js';

/**
 * What this computer remembers about the last person who signed in, so the sign-in screen can
 * greet them by name, ask only for the password, and say where they will land.
 * Kept in localStorage: it never leaves the browser and "Use another account" erases it.
 */
export type Returning = {
  name: string;
  email: string;
  workspace?: string;
  page?: { id: string; title: string; kind?: PageKind; at: number };
};

const KEY = 'sinapta:returning';

export function readReturning(): Returning | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Returning | null;
    return value && typeof value.email === 'string' && typeof value.name === 'string'
      ? value
      : null;
  } catch {
    return null;
  }
}

export function forgetReturning() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage can be unavailable (private windows); the screen then shows the full form.
  }
}

function write(value: Returning) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Same as above: remembering is a convenience, never a requirement.
  }
}

let started = false;

/** Follows the signed-in person and the page they have open. Safe to call more than once. */
export function startRemembering() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const save = () => {
    const state = useWorkspace.getState();
    if (!state.user) return;
    const previous = readReturning();
    const same = previous?.email === state.user.email;
    const workspace = state.workspaces.find((item) => item.id === state.workspaceId)?.name;
    const open = state.selectedId ? state.pages.find((page) => page.id === state.selectedId) : null;
    const next: Returning = {
      name: state.user.name || state.user.email.split('@')[0],
      email: state.user.email,
      workspace: workspace ?? (same ? previous?.workspace : undefined),
      page: open
        ? {
            id: open.id,
            title: open.title,
            kind: open.kind,
            at: open.id === previous?.page?.id ? previous.page.at : Date.now(),
          }
        : same
          ? previous?.page
          : undefined,
    };
    if (JSON.stringify(next) !== JSON.stringify(previous)) write(next);
  };
  useWorkspace.subscribe((state, before) => {
    if (
      state.user !== before.user ||
      state.selectedId !== before.selectedId ||
      state.workspaceId !== before.workspaceId ||
      state.pages !== before.pages
    )
      save();
  });
  save();
}
