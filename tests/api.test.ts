import { afterEach, expect, test, vi } from 'vitest';
import { api } from '../apps/web/src/state/api.js';
afterEach(() => vi.unstubAllGlobals());
test('bodyless commands do not declare an empty JSON body', async () => {
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    expect(new Headers(options.headers).has('content-type')).toBe(false);
    return Response.json({ ok: true });
  });
  expect(await api('/pages/one', { method: 'DELETE' })).toEqual({ ok: true });
});
test('a transient non-JSON gateway failure during a read recovers without exposing parser errors', async () => {
  let attempts = 0;
  vi.stubGlobal('fetch', async () =>
    ++attempts === 1 ? new Response('', { status: 502 }) : Response.json({ ok: true }),
  );
  expect(await api('/health')).toEqual({ ok: true });
  expect(attempts).toBe(2);
});
test('a failed mutation is not replayed without an idempotency guarantee', async () => {
  let attempts = 0;
  vi.stubGlobal('fetch', async () => {
    attempts++;
    return new Response('', { status: 502 });
  });
  await expect(api('/pages', { method: 'POST', body: '{}' })).rejects.toThrow(
    'temporarily unavailable',
  );
  expect(attempts).toBe(1);
});
