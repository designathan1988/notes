import type { AppearanceOverrides, AppearancePreference } from '@note/contracts';
import type { WorkspaceState } from '../state/store.js';
import { api, ApiError, json } from '../state/api.js';

type Patch = { [K in keyof AppearanceOverrides]?: AppearanceOverrides[K] | null };
export interface AppearanceSlice {
  appearance: AppearanceOverrides;
  appearanceRevision: number;
  appearanceOwner: string | null;
  appearancePending: Patch;
  appearanceStatus: 'loading' | 'saved' | 'saving' | 'error';
  appearanceError: string;
  appearanceScope: 'app' | 'page' | null;
  openAppearance(scope: 'app' | 'page'): void;
  closeAppearance(): void;
  pageAppearanceDrafts: Record<
    string,
    { overrides: AppearanceOverrides; revision: number; status: 'saving' | 'error'; error?: string }
  >;
  changePageAppearance(id: string, overrides: AppearanceOverrides): void;
  savePageAppearance(id: string): Promise<void>;
  loadAppearance(identity: string): Promise<void>;
  changeAppearance(patch: Patch): void;
  saveAppearance(): Promise<void>;
  resetAppearance(): void;
  clearAppearance(): void;
}
function merge(base: AppearanceOverrides, patch: Patch): AppearanceOverrides {
  const result = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete result[key];
    else result[key] = value;
  }
  return result as AppearanceOverrides;
}
const cacheKey = (identity: string) => `note:appearance:pending:${identity}`;
function cache(identity: string, patch: Patch) {
  try {
    if (Object.keys(patch).length) localStorage.setItem(cacheKey(identity), json(patch));
    else localStorage.removeItem(cacheKey(identity));
  } catch {
    /* The in-memory draft remains available when browser storage is full. */
  }
}
export function appearanceSlice(
  set: (patch: Partial<WorkspaceState>) => void,
  get: () => WorkspaceState,
): AppearanceSlice {
  let flight: Promise<void> | null = null,
    timer: ReturnType<typeof setTimeout> | undefined,
    generation = 0,
    loadSequence = 0;
  const pageTimers = new Map<string, ReturnType<typeof setTimeout>>(),
    pageFlights = new Set<string>();
  return {
    appearance: {},
    appearanceRevision: 0,
    appearanceOwner: null,
    appearancePending: {},
    appearanceStatus: 'loading',
    appearanceError: '',
    appearanceScope: null,
    openAppearance(scope) {
      set({
        appearanceScope: scope,
        contextOpen: false,
        commandOpen: false,
        dialog: null,
        sidebarOpen: false,
      });
    },
    closeAppearance() {
      set({ appearanceScope: null });
    },
    pageAppearanceDrafts: {},
    changePageAppearance(id, overrides) {
      const page = get().pages.find((page) => page.id === id);
      if (!page) return;
      const draft = get().pageAppearanceDrafts[id];
      set({
        pageAppearanceDrafts: {
          ...get().pageAppearanceDrafts,
          [id]: { overrides, revision: draft?.revision ?? page.revision, status: 'saving' },
        },
      });
      clearTimeout(pageTimers.get(id));
      pageTimers.set(
        id,
        setTimeout(() => void get().savePageAppearance(id), 400),
      );
    },
    async savePageAppearance(id) {
      if (pageFlights.has(id)) return;
      const token = generation;
      pageFlights.add(id);
      try {
        while (generation === token && get().pageAppearanceDrafts[id]) {
          const sent = get().pageAppearanceDrafts[id];
          try {
            await get().updatePage(id, { appearance: sent.overrides }, sent.revision);
            if (generation !== token) return;
            const drafts = { ...get().pageAppearanceDrafts },
              current = drafts[id];
            if (current === sent) delete drafts[id];
            else if (current)
              drafts[id] = {
                ...current,
                revision: get().pages.find((page) => page.id === id)!.revision,
              };
            set({ pageAppearanceDrafts: drafts });
          } catch (error) {
            if (generation === token)
              set({
                pageAppearanceDrafts: {
                  ...get().pageAppearanceDrafts,
                  [id]: {
                    ...get().pageAppearanceDrafts[id],
                    status: 'error',
                    error: (error as Error).message,
                  },
                },
              });
            break;
          }
        }
      } finally {
        pageFlights.delete(id);
      }
    },
    async loadAppearance(identity) {
      const token = ++loadSequence;
      const changingIdentity = get().appearanceOwner !== identity;
      if (changingIdentity) generation++;
      const epoch = generation;
      clearTimeout(timer);
      set({
        appearanceOwner: identity,
        ...(changingIdentity ? { appearance: {}, appearancePending: {} } : {}),
        appearanceStatus: 'loading',
        appearanceError: '',
      });
      try {
        const preference = await api<AppearancePreference>('/preferences/appearance');
        if (generation !== epoch || loadSequence !== token || get().user?.id !== identity) return;
        let pending: Patch = {};
        try {
          pending = JSON.parse(localStorage.getItem(cacheKey(identity)) ?? '{}');
        } catch {
          /* Ignore a corrupt browser cache. */
        }
        set({
          appearance: merge(preference.overrides, pending),
          appearanceRevision: preference.revision,
          appearancePending: pending,
          appearanceStatus: 'saved',
        });
        if (Object.keys(pending).length) void get().saveAppearance();
      } catch (error) {
        if (generation === epoch && loadSequence === token)
          set({ appearanceStatus: 'error', appearanceError: (error as Error).message });
      }
    },
    changeAppearance(patch) {
      const state = get();
      if (!state.appearanceOwner || state.appearanceStatus === 'loading') return;
      const pending = { ...state.appearancePending, ...patch };
      set({
        appearance: merge(state.appearance, patch),
        appearancePending: pending,
        appearanceStatus: 'saving',
        appearanceError: '',
      });
      cache(state.appearanceOwner, pending);
      clearTimeout(timer);
      timer = setTimeout(() => void get().saveAppearance(), 400);
    },
    async saveAppearance() {
      if (flight) {
        await flight;
        if (Object.keys(get().appearancePending).length && get().appearanceStatus !== 'error')
          await get().saveAppearance();
        return;
      }
      const identity = get().appearanceOwner,
        token = generation;
      if (!identity || !Object.keys(get().appearancePending).length) return;
      flight = (async () => {
        let conflicts = 0;
        while (generation === token && Object.keys(get().appearancePending).length) {
          const {
            appearancePending: sent,
            appearanceRevision: revision,
            appearance: overrides,
          } = get();
          set({ appearanceStatus: 'saving', appearanceError: '' });
          try {
            const saved = await api<AppearancePreference>('/preferences/appearance', {
              method: 'PATCH',
              body: json({ revision, overrides }),
            });
            if (generation !== token) return;
            const pending = { ...get().appearancePending };
            for (const key of Object.keys(sent) as (keyof Patch)[])
              if (json(pending[key]) === json(sent[key])) delete pending[key];
            set({
              appearance: merge(saved.overrides, pending),
              appearanceRevision: saved.revision,
              appearancePending: pending,
              appearanceStatus: Object.keys(pending).length ? 'saving' : 'saved',
            });
            cache(identity, pending);
            conflicts = 0;
          } catch (error) {
            if (generation !== token) return;
            if (error instanceof ApiError && error.status === 409 && conflicts++ < 2) {
              try {
                const current = await api<AppearancePreference>('/preferences/appearance');
                if (generation !== token) return;
                set({
                  appearance: merge(current.overrides, get().appearancePending),
                  appearanceRevision: current.revision,
                });
                continue;
              } catch {
                /* Keep the pending changes and expose Retry. */
              }
            }
            set({ appearanceStatus: 'error', appearanceError: (error as Error).message });
            break;
          }
        }
      })();
      try {
        await flight;
      } finally {
        flight = null;
      }
    },
    resetAppearance() {
      const patch = Object.fromEntries(
        Object.keys(get().appearance).map((key) => [key, null]),
      ) as Patch;
      get().changeAppearance(patch);
      void get().saveAppearance();
    },
    clearAppearance() {
      generation++;
      loadSequence++;
      clearTimeout(timer);
      for (const timer of pageTimers.values()) clearTimeout(timer);
      pageTimers.clear();
      set({
        appearance: {},
        appearanceOwner: null,
        appearancePending: {},
        appearanceRevision: 0,
        appearanceScope: null,
        appearanceStatus: 'loading',
        appearanceError: '',
        pageAppearanceDrafts: {},
      });
    },
  };
}
