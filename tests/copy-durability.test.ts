import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as Y from 'yjs';
import { ensureCopySourcesSaved } from '../apps/web/src/documents/session.js';
import { openRecovery, type Recovery } from '../apps/web/src/documents/recovery.js';
import { api } from '../apps/web/src/state/api.js';
import { useWorkspace } from '../apps/web/src/state/store.js';

vi.mock('../apps/web/src/documents/recovery.js', () => ({ openRecovery: vi.fn() }));
vi.mock('../apps/web/src/state/api.js', async () => ({
  ...(await vi.importActual('../apps/web/src/state/api.js')),
  api: vi.fn(),
}));
const initial = useWorkspace.getState();
const key = 'owner:studio:template:1';
const pages = [{ id: 'template', title: 'Copied template', generation: 1 }];
let doc: Y.Doc;
let bytes: Uint8Array;
let pending: boolean;
let recovery: Recovery;
const snapshot = () => Buffer.from(Y.encodeSnapshot(Y.snapshot(doc))).toString('base64');
const acknowledgement = () => ({ pageId: 'template', generation: 1, snapshot: snapshot() });
beforeEach(() => {
  doc = new Y.Doc();
  doc.getText('body').insert(0, 'Already saved content');
  bytes = Y.encodeStateAsUpdate(doc);
  pending = true;
  useWorkspace.setState({
    user: { id: 'owner', name: 'Owner', email: 'owner@test.test' },
    workspaceId: 'studio',
  });
  vi.stubGlobal('indexedDB', {});
  recovery = {
    read: vi.fn(async () => bytes),
    pendingIdentity: vi.fn(async () => (pending ? [key] : [])),
    acknowledge: vi.fn(async (_key, expected) => {
      if (Buffer.compare(Buffer.from(expected), Buffer.from(bytes))) return false;
      pending = false;
      return true;
    }),
    write: vi.fn(),
    setPending: vi.fn(),
    clearIdentity: vi.fn(),
    close: vi.fn(),
  };
  vi.mocked(openRecovery).mockResolvedValue(recovery);
  vi.mocked(api).mockResolvedValue(acknowledgement());
});
afterEach(() => {
  doc.destroy();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  useWorkspace.setState(initial, true);
});

test('a retained initial-sync marker does not block copying bytes already saved on the server', async () => {
  await expect(ensureCopySourcesSaved('owner', 'studio', pages)).resolves.toBeUndefined();
  expect(api).toHaveBeenCalledWith('/pages/template/document/acknowledgement');
  expect(recovery.acknowledge).toHaveBeenCalledWith(key, bytes);
  expect(pending).toBe(false);
  expect(recovery.close).toHaveBeenCalled();
});

test('genuinely unsent content is retained and copying remains blocked', async () => {
  doc.getText('body').insert(doc.getText('body').length, ' Offline change');
  bytes = Y.encodeStateAsUpdate(doc);
  await expect(ensureCopySourcesSaved('owner', 'studio', pages)).rejects.toThrow(
    'synchronize its local draft',
  );
  expect(pending).toBe(true);
  expect(recovery.acknowledge).not.toHaveBeenCalled();
});

test('an unsent deletion is not mistaken for saved content by comparing only state vectors', async () => {
  doc.getText('body').delete(0, 3);
  bytes = Y.encodeStateAsUpdate(doc);
  await expect(ensureCopySourcesSaved('owner', 'studio', pages)).rejects.toThrow(
    'synchronize its local draft',
  );
  expect(pending).toBe(true);
});

test.each([{ generation: 2 }, { pageId: 'different' }, { snapshot: 'invalid' }])(
  'a mismatched or invalid acknowledgement cannot clear recovery: %j',
  async (patch) => {
    vi.mocked(api).mockResolvedValue({ ...acknowledgement(), ...patch });
    await expect(ensureCopySourcesSaved('owner', 'studio', pages)).rejects.toThrow(
      'synchronize its local draft',
    );
    expect(recovery.acknowledge).not.toHaveBeenCalled();
    expect(pending).toBe(true);
  },
);

test('a newer local edit arriving during the read-only verification keeps its pending marker', async () => {
  vi.mocked(api).mockImplementation(async () => {
    const ack = acknowledgement();
    doc.getText('body').insert(0, 'Newer ');
    bytes = Y.encodeStateAsUpdate(doc);
    return ack;
  });
  await expect(ensureCopySourcesSaved('owner', 'studio', pages)).rejects.toThrow(
    'synchronize its local draft',
  );
  expect(recovery.acknowledge).toHaveBeenCalled();
  expect(pending).toBe(true);
});

test('offline or denied verification cannot discard a local draft', async () => {
  vi.mocked(api).mockRejectedValue(new Error('Unavailable'));
  await expect(ensureCopySourcesSaved('owner', 'studio', pages)).rejects.toThrow(
    'synchronize its local draft',
  );
  expect(recovery.acknowledge).not.toHaveBeenCalled();
  expect(pending).toBe(true);
});

test('an identity change during verification cannot acknowledge the previous account draft', async () => {
  vi.mocked(api).mockImplementation(async () => {
    useWorkspace.setState({ workspaceId: 'another' });
    return acknowledgement();
  });
  await expect(ensureCopySourcesSaved('owner', 'studio', pages)).rejects.toThrow(
    'synchronize its local draft',
  );
  expect(recovery.acknowledge).not.toHaveBeenCalled();
});

test('a clean source never needs an additional request', async () => {
  pending = false;
  await ensureCopySourcesSaved('owner', 'studio', pages);
  expect(api).not.toHaveBeenCalled();
});
