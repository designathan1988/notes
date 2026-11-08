import { afterEach, expect, test, vi } from 'vitest';
import { knowledgeSlice } from '../apps/web/src/knowledge/state.js';
import type { WorkspaceState } from '../apps/web/src/state/store.js';
afterEach(() => vi.restoreAllMocks());
function fixture() {
  let state: WorkspaceState;
  const set = (patch: Partial<WorkspaceState>) => Object.assign(state, patch);
  state = {
    user: { id: 'alice' },
    workspaceId: 'studio',
    ...knowledgeSlice(set, () => state),
  } as WorkspaceState;
  return { get: () => state, set };
}
test('page-reference reads batch and deduplicate without storing a second writable page', async () => {
  const { get } = fixture(),
    state = get();
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify([{ id: 'one', title: 'One', kind: 'document' }]), {
      status: 200,
    }),
  );
  await Promise.all([
    state.loadPageReference('one'),
    state.loadPageReference('two'),
    state.loadPageReference('one'),
  ]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string).ids).toEqual(['one', 'two']);
  expect(state.references['alice:studio:one']).toEqual({
    status: 'ready',
    page: { id: 'one', title: 'One', kind: 'document' },
  });
  expect(state.references['alice:studio:two']).toEqual({ status: 'unavailable' });
});
test('a delayed reference response cannot restore a private title after knowledge, actor or workspace invalidation', async () => {
  for (const scope of ['knowledge', 'identity', 'workspace']) {
    const { get, set } = fixture(),
      state = get();
    let reply!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      reply = resolve;
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => pending);
    const read = state.loadPageReference('secret');
    await Promise.resolve();
    if (scope === 'knowledge') state.invalidateKnowledge();
    else if (scope === 'identity') set({ user: { id: 'bob' } as WorkspaceState['user'] });
    else set({ workspaceId: 'other' });
    reply(
      new Response(JSON.stringify([{ id: 'secret', title: 'PRIVATE TITLE', kind: 'document' }]), {
        status: 200,
      }),
    );
    await read;
    expect(JSON.stringify(state.references)).not.toContain('PRIVATE TITLE');
    vi.restoreAllMocks();
  }
});
