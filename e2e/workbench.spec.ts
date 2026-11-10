import { APP_ORIGIN } from './origin.js';
import { test, expect } from './test.js';
import { openCatalog } from './navigate.js';
test('an authorized initial page opens while the redundant background navigation read is delayed', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = 0;
  try {
    await context.request.post('/api/auth/sign-in/email', {
      data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
      headers: { origin: APP_ORIGIN },
    });
    const page = await context.newPage();
    await page.route('**/api/workspaces/*/navigation', async (route) => {
      if (route.request().method() === 'POST') {
        held++;
        await pending;
      }
      await route.continue().catch(() => {});
    });
    await page.goto('/#ea293f81-c7fa-4551-9da5-58b8af0510a9/document');
    await expect.poll(() => held).toBeGreaterThan(0);
    await expect(page.getByRole('textbox', { name: 'Page content', exact: true })).toBeVisible();
    await page.keyboard.press('Control+Shift+p');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    release();
    await expect(page.locator('.save-status')).toHaveText('Saved');
  } finally {
    release();
    await context.close();
  }
});

test('background navigation refresh does not replace the global database catalog with a document', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json();
  const page = await context.newPage();
  await page.goto('/');
  await openCatalog(page, 'database');
  await expect(page.getByRole('region', { name: 'Databases', exact: true })).toBeVisible();
  const note = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Workbench refresh ${Date.now()}` },
      headers: { 'x-note-request': '1' },
    })
  ).json();
  await expect(
    page.locator('.page-tree').getByRole('button', { name: note.title, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Databases', exact: true })).toBeVisible();
  await context.request.delete(`/api/pages/${note.id}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
test('trashing another page from the tree keeps the current page in front', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json();
  const notes = [];
  for (const title of [`Workbench active ${Date.now()}`, `Workbench target ${Date.now()}`])
    notes.push(
      await (
        await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
          data: { title },
          headers: { 'x-note-request': '1' },
        })
      ).json(),
    );
  const page = await context.newPage();
  await page.goto(`/#${notes[0].id}/document`);
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await page
    .locator('.page-tree')
    .getByRole('button', { name: notes[1].title, exact: true })
    .click({ button: 'right' });
  await page
    .getByRole('menu', { name: 'Page actions' })
    .getByRole('menuitem', { name: 'Move to trash', exact: true })
    .click();
  await expect(
    page.locator('.page-tree').getByRole('button', { name: notes[1].title, exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Page title', { exact: true })).toHaveValue(notes[0].title);
  await context.request.delete(`/api/pages/${notes[0].id}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
test('creates directly from the keyboard, moves through history and keeps an offline draft', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await expect(page.getByRole('button', { name: 'Go back', exact: true })).toBeDisabled();
  await page.keyboard.press('Control+Alt+n');
  const title = page.getByLabel('Page title', { exact: true });
  await expect(title).toHaveValue('Untitled');
  await expect(title).toBeFocused();
  const first = `Workbench first ${Date.now()}`;
  await title.fill(first);
  await title.press('Enter');
  await page
    .getByRole('textbox', { name: 'Page content' })
    .pressSequentially('The first independent working note.');
  await expect(page.locator('.save-status')).toHaveText('Saved');
  const firstId = page.url().split('#')[1].split('/')[0];
  await page.keyboard.press('Control+Alt+n');
  await expect(title).toHaveValue('Untitled');
  const second = `Workbench second ${Date.now()}`;
  await title.fill(second);
  await title.press('Enter');
  await page
    .getByRole('textbox', { name: 'Page content' })
    .pressSequentially('The second independent working note.');
  await expect(page.locator('.save-status')).toHaveText('Saved');
  const secondId = page.url().split('#')[1].split('/')[0];
  // History moves between the pages written in this window.
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Page content' })).toContainText(
    'The first independent working note.',
  );
  await page.getByRole('button', { name: 'Go forward', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Page content' })).toContainText(
    'The second independent working note.',
  );
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page.getByLabel('Page title', { exact: true })).toHaveValue(first);
  // A reload reopens the page that was in front.
  await page.reload();
  await expect(page.getByLabel('Page title', { exact: true })).toHaveValue(first);
  await page.keyboard.press('Control+k');
  await expect(
    page.getByRole('dialog').getByText('Recently opened', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('listbox', { name: 'Search results' }).getByRole('option').first(),
  ).toContainText(first);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+Shift+p');
  await page
    .getByRole('dialog', { name: 'Command palette' })
    .getByRole('combobox')
    .fill('all pages');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'All pages', exact: true })).toBeVisible();
  // A draft written offline survives leaving the page and coming back to it.
  await page.locator('.page-tree').getByRole('button', { name: second, exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Page content' })).toContainText(
    'The second independent working note.',
  );
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.getByRole('textbox', { name: 'Page content' }).press('End');
  await page
    .getByRole('textbox', { name: 'Page content' })
    .pressSequentially(' Disconnected draft.');
  await expect(page.locator('.save-status')).toHaveText('Saved locally');
  await page.locator('.page-tree').getByRole('button', { name: first, exact: true }).click();
  await expect(page.getByLabel('Page title', { exact: true })).toHaveValue(first);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.locator('.page-tree').getByRole('button', { name: second, exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Page content' })).toContainText(
    'Disconnected draft.',
  );
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await context.request.delete(`/api/pages/${firstId}`, { headers: { 'x-note-request': '1' } });
  await context.request.delete(`/api/pages/${secondId}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
