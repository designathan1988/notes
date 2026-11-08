import { afterEach, expect, test, vi } from 'vitest';
import { appearanceSlice } from '../apps/web/src/appearance/state.js';
import type { WorkspaceState } from '../apps/web/src/state/store.js';
import { api, ApiError } from '../apps/web/src/state/api.js';
vi.mock('../apps/web/src/state/api.js', async () => ({
  ...(await vi.importActual<typeof import('../apps/web/src/state/api.js')>(
    '../apps/web/src/state/api.js',
  )),
  api: vi.fn(),
}));
const request = vi.mocked(api);
afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function fixture() {
  const saved = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
    removeItem: (key: string) => saved.delete(key),
  });
  let state: WorkspaceState;
  const set = (patch: Partial<WorkspaceState>) => Object.assign(state, patch);
  state = {
    user: { id: 'alice' },
    pages: [],
    ...appearanceSlice(set, () => state),
  } as unknown as WorkspaceState;
  return { get: () => state, set, saved };
}
test('edits during an in-flight appearance save survive its acknowledgement', async () => {
  vi.useFakeTimers();
  const { get, saved } = fixture();
  request.mockResolvedValueOnce({ revision: 0, overrides: {} });
  await get().loadAppearance('alice');
  let finish!: (value: unknown) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  get().changeAppearance({ bodyFont: 'Georgia' });
  const saving = get().saveAppearance();
  get().changeAppearance({ bodyFont: 'Arial', text: '#222222' });
  request.mockResolvedValueOnce({ revision: 2, overrides: { bodyFont: 'Arial', text: '#222222' } });
  finish({ revision: 1, overrides: { bodyFont: 'Georgia' } });
  await saving;
  expect(JSON.parse(request.mock.calls[2][1]!.body as string)).toEqual({
    revision: 1,
    overrides: { bodyFont: 'Arial', text: '#222222' },
  });
  expect(get().appearanceStatus).toBe('saved');
  expect(saved.size).toBe(0);
});
test('a stale window rebases only its pending fields on current account settings', async () => {
  vi.useFakeTimers();
  const { get } = fixture();
  request.mockResolvedValueOnce({ revision: 1, overrides: {} });
  await get().loadAppearance('alice');
  get().changeAppearance({ bodyFont: 'Georgia' });
  request
    .mockRejectedValueOnce(new ApiError('CONFLICT', 'Changed elsewhere', 409))
    .mockResolvedValueOnce({ revision: 2, overrides: { navigation: '#efefef' } })
    .mockResolvedValueOnce({
      revision: 3,
      overrides: { navigation: '#efefef', bodyFont: 'Georgia' },
    });
  await get().saveAppearance();
  expect(JSON.parse(request.mock.calls[3][1]!.body as string)).toEqual({
    revision: 2,
    overrides: { navigation: '#efefef', bodyFont: 'Georgia' },
  });
});
test('failed appearance writes remain recoverable and late account responses cannot affect another identity', async () => {
  vi.useFakeTimers();
  const { get, set, saved } = fixture();
  request.mockResolvedValueOnce({ revision: 0, overrides: {} });
  await get().loadAppearance('alice');
  get().changeAppearance({ bodyFont: 'Georgia' });
  request.mockRejectedValueOnce(new Error('Offline'));
  await get().saveAppearance();
  expect(get().appearanceStatus).toBe('error');
  expect(saved.get('note:appearance:pending:alice')).toContain('Georgia');
  get().clearAppearance();
  set({ user: { id: 'bob' } as WorkspaceState['user'] });
  request.mockResolvedValueOnce({ revision: 0, overrides: { bodyFont: 'Verdana' } });
  await get().loadAppearance('bob');
  expect(get().appearance).toEqual({ bodyFont: 'Verdana' });
  get().clearAppearance();
  set({ user: { id: 'alice' } as WorkspaceState['user'] });
  request
    .mockResolvedValueOnce({ revision: 0, overrides: {} })
    .mockResolvedValueOnce({ revision: 1, overrides: { bodyFont: 'Georgia' } });
  await get().loadAppearance('alice');
  await get().saveAppearance();
  expect(get().appearance).toEqual({ bodyFont: 'Georgia' });
  expect(get().appearancePending).toEqual({});
});

test('retrying personal preference loading does not abandon an in-flight page style write', async () => {
  vi.useFakeTimers();
  const { get, set } = fixture();
  request.mockResolvedValue({ revision: 0, overrides: {} });
  await get().loadAppearance('alice');
  set({ pages: [{ id: 'note', revision: 1 }] as WorkspaceState['pages'] });
  let finish!: () => void;
  set({
    updatePage: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = () => {
            set({ pages: [{ id: 'note', revision: 2 }] as WorkspaceState['pages'] });
            resolve();
          };
        }),
    ),
  });
  get().changePageAppearance('note', { bodyFont: 'Georgia' });
  const saving = get().savePageAppearance('note');
  await get().loadAppearance('alice');
  finish();
  await saving;
  expect(get().pageAppearanceDrafts).toEqual({});
});

test('a late personal preference response cannot project the previous account into the new one', async () => {
  const { get, set } = fixture();
  let finish!: (result: unknown) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const first = get().loadAppearance('alice');
  get().clearAppearance();
  set({ user: { id: 'bob' } as WorkspaceState['user'] });
  request.mockResolvedValueOnce({ revision: 0, overrides: { bodyFont: 'Verdana' } });
  await get().loadAppearance('bob');
  finish({ revision: 20, overrides: { bodyFont: 'Georgia' } });
  await first;
  expect(get().appearance).toEqual({ bodyFont: 'Verdana' });
  expect(get().appearanceOwner).toBe('bob');
});
