import { APP_ORIGIN } from './origin.js';
import { test, expect, type BrowserContext } from '@playwright/test';
async function signIn(context: BrowserContext) {
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
}
test('mobile navigation is hidden from keyboard when closed and restores focus after Escape', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: APP_ORIGIN,
    viewport: { width: 390, height: 844 },
  });
  await signIn(context);
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await expect(page.locator('.sidebar')).toBeHidden();
  const open = page.getByRole('button', { name: 'Open navigation', exact: true });
  await open.click();
  const close = page.getByRole('button', { name: 'Close navigation drawer', exact: true });
  await expect(close).toBeFocused();
  await expect(page.locator('.workspace-main')).toHaveAttribute('inert', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(open).toBeFocused();
  await open.click();
  await close.click();
  await expect(page.locator('.sidebar')).toBeHidden();
  await context.close();
});
test('signing out from graph clears recovery even after the document editor was unmounted', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await signIn(context);
  const session = await (await context.request.get('/api/session')).json();
  const note = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Logout recovery ${Date.now()}` },
      headers: { 'x-note-request': '1' },
    })
  ).json();
  const page = await context.newPage();
  await page.goto(`/#${note.id}/document`);
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await page
    .getByRole('textbox', { name: 'Page content' })
    .pressSequentially('Local recovery content');
  await expect(page.locator('.save-status')).toHaveText('Saved');
  const keys = () =>
    page.evaluate(
      () =>
        new Promise<IDBValidKey[]>((resolve, reject) => {
          const request = indexedDB.open('note-recovery-v1', 1);
          request.onsuccess = () => {
            const db = request.result;
            const result = db.transaction('documents').objectStore('documents').getAllKeys();
            result.onsuccess = () => {
              db.close();
              resolve(result.result);
            };
            result.onerror = () => reject(result.error);
          };
          request.onerror = () => reject(request.error);
        }),
    );
  await expect.poll(async () => (await keys()).length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Knowledge graph', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Knowledge graph' })).toBeVisible();
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();

  await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Open demo workspace', exact: true }),
  ).toBeVisible();
  expect(await keys()).toHaveLength(0);
  await signIn(context);
  await context.request.delete(`/api/pages/${note.id}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
test('sign out preserves disconnected drafts after navigating away, then succeeds after recovery', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await signIn(context);
  const session = await (await context.request.get('/api/session')).json();
  const note = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Pending recovery ${Date.now()}` },
      headers: { 'x-note-request': '1' },
    })
  ).json();
  const page = await context.newPage();
  await page.goto(`/#${note.id}/document`);
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page
    .getByRole('textbox', { name: 'Page content' })
    .pressSequentially('Keep this disconnected draft');
  await expect(page.locator('.save-status')).toHaveText('Saved locally');
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();

  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog').getByRole('tab', { name: 'Data', exact: true }).click();
  await expect(page.locator('.local-draft')).toContainText('Keep this disconnected draft');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download local drafts', exact: true }).click();
  const download = await downloading;
  const { readFile } = await import('node:fs/promises');
  const { unzipSync, strFromU8 } = await import('fflate');
  const archive = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  const manifest = JSON.parse(strFromU8(archive['recovery.json'])),
    draft = manifest.drafts.find((entry: { pageId: string }) => entry.pageId === note.id);
  expect(manifest.version).toBe(2);
  expect(strFromU8(archive[draft.jsonFile])).toContain('Keep this disconnected draft');
  expect(archive[draft.yjsFile].byteLength).toBeGreaterThan(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'All pages', exact: true }).click();
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();

  await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Some edits are saved only on this device' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await context.setOffline(false);
  await page.goto(`/#${note.id}/document`);
  await expect(page.getByRole('textbox', { name: 'Page content' })).toContainText(
    'Keep this disconnected draft',
  );
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();

  await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Open demo workspace', exact: true }),
  ).toBeVisible();
  await signIn(context);
  await context.request.delete(`/api/pages/${note.id}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
