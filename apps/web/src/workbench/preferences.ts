export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
let windowIdentity: string | null = null;
function windowKey(key: string) {
  if (!windowIdentity) {
    windowIdentity = globalThis.sessionStorage?.getItem('note:window:v1') ?? crypto.randomUUID();
    globalThis.sessionStorage?.setItem('note:window:v1', windowIdentity);
  }
  return `${key}:window:${windowIdentity}`;
}
export const browserPreferences: PreferenceStorage = {
  getItem(key) {
    try {
      return (
        globalThis.localStorage?.getItem(windowKey(key)) ??
        globalThis.localStorage?.getItem(`${key}:last`) ??
        globalThis.localStorage?.getItem(key) ??
        null
      );
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      globalThis.localStorage?.setItem(windowKey(key), value);
      globalThis.localStorage?.setItem(`${key}:last`, value);
    } catch {
      /* Working context remains available in memory. */
    }
  },
  removeItem(key) {
    try {
      const storage = globalThis.localStorage;
      if (storage) {
        const keys = Array.from({ length: storage.length }, (_, index) =>
          storage.key(index),
        ).filter((name): name is string => !!name && (name === key || name.startsWith(key + ':')));
        for (const name of keys) storage.removeItem(name);
      }
    } catch {
      /* Unavailable preferences must not prevent sign-out. */
    }
  },
};
/** Unconfirmed commands belong to this window; another window must not borrow its intent. */
export const commandPreferences: PreferenceStorage = {
  getItem(key) {
    try {
      return globalThis.localStorage?.getItem(windowKey(key)) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      globalThis.localStorage?.setItem(windowKey(key), value);
    } catch {
      /* Keep the active command in memory. */
    }
  },
  removeItem(key) {
    try {
      globalThis.localStorage?.removeItem(windowKey(key));
    } catch {
      /* Scoped commands remain isolated. */
    }
  },
};
