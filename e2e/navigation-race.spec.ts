import { APP_ORIGIN } from './origin.js';
import { expect, test } from '@playwright/test';
test('a delayed page removal preserves settings opened while the request is pending', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json();
  const note = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Workbench removal ${Date.now()}` },
      headers: { 'x-note-request': '1' },
    })
  ).json();
  const page = await context.newPage();
  await page.goto(`/#${note.id}/document`);
  await expect(page.locator('.save-status')).toHaveText('Saved');
  let release!: () => void, received!: () => void;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    intercepted = new Promise<void>((resolve) => {
      received = resolve;
    });
  await page.route(`**/api/pages/${note.id}`, async (route) => {
    if (route.request().method() === 'DELETE') {
      received();
      await gate;
    }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Page actions', exact: true }).click();
  await page
    .getByRole('menu', { name: 'Page actions', exact: true })
    .getByRole('menuitem', { name: 'Move to trash', exact: true })
    .click();
  await intercepted;
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();

  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Trash', exact: true }).click();
  release();
  await expect(dialog.locator('.trash-row').filter({ hasText: note.title })).toBeVisible();
  await expect(dialog).toBeVisible();
  await context.close();
});
