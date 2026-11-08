import { expect, test } from '@playwright/test';
test('real recovery storage acknowledges only the exact state that was copied', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/documents/recovery.ts',
      { openRecovery } = await import(path);
    const storage = await openRecovery(),
      identity = 'storage-contract-' + crypto.randomUUID(),
      key = `${identity}:workspace:page:1`;
    try {
      await storage.write(key, new Uint8Array([1, 2]), true);
      await storage.write(key, new Uint8Array([1, 2, 3]), true);
      const older = await storage.acknowledge(key, new Uint8Array([1, 2]));
      const pendingAfterOlder = await storage.pendingIdentity(identity),
        retained = Array.from(await storage.read(key));
      const exact = await storage.acknowledge(key, new Uint8Array([1, 2, 3]));
      return {
        older,
        exact,
        pendingAfterOlder: pendingAfterOlder.length,
        pendingAfterExact: (await storage.pendingIdentity(identity)).length,
        retained,
        after: Array.from(await storage.read(key)),
      };
    } finally {
      await storage.clearIdentity(identity);
      storage.close();
    }
  });
  expect(result).toEqual({
    older: false,
    exact: true,
    pendingAfterOlder: 1,
    pendingAfterExact: 0,
    retained: [1, 2, 3],
    after: [1, 2, 3],
  });
});
