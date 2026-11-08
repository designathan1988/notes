import { test, expect } from '@playwright/test';

test('internal database links open the table even when their branch has never been expanded', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  const page = await context.newPage();
  const session = await (await context.request.get('/api/session')).json();
  const pages = await (
    await context.request.get(`/api/workspaces/${session.workspaces[0].id}/pages`)
  ).json();
  const reading = pages.find((page: { title: string }) => page.title === 'Reading room');
  await page.goto(`/#${reading.id}/document`);
  await page
    .locator('.favorites')
    .getByRole('button', { name: 'Product direction', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Page content' })
    .getByRole('link', { name: 'Research', exact: true })
    .click();
  await expect(page.getByRole('table', { name: 'Database records' })).toBeVisible();
  await expect(page).toHaveURL(/\/database$/);
  const id = page.url().split('#')[1].split('/')[0];
  await page.goto(`/#${id}/document`);
  await expect(page.getByRole('table', { name: 'Database records' })).toBeVisible();
  await expect(page).toHaveURL(/\/database$/);
  await context.close();
});

test('creates pages through the UI, edits table structure, embeds an editable database, and drags the page tree', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  const page = await context.newPage();
  const session = await (await context.request.get('/api/session')).json();
  const destination = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Drop destination ${Date.now()}` },
      headers: { 'x-note-request': '1' },
    })
  ).json();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'New page options', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const title = `Interface workflow ${Date.now()}`;
  await expect(dialog.getByLabel('Title', { exact: true })).toBeFocused();
  await expect(dialog.getByRole('combobox', { name: /Location/ })).toHaveValue('');
  await dialog.getByLabel('Title', { exact: true }).fill(title);
  await dialog.getByRole('button', { name: 'Create page', exact: true }).click();
  await expect(page.getByLabel('Page title', { exact: true })).toHaveValue(title);
  const id = page.url().split('#')[1].split('/')[0];
  const content = page.getByRole('textbox', { name: 'Page content' });
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await content.press('/');
  await page.getByRole('menuitem', { name: 'Table', exact: true }).click();
  await expect(content.locator('table tr')).toHaveCount(3);
  expect(
    await content
      .locator(':scope > *')
      .first()
      .evaluate((element) => element.tagName === 'TABLE' || !!element.querySelector('table')),
  ).toBe(true);
  await content.locator('th').first().click();
  await page.keyboard.type('Topic');
  await page.getByRole('button', { name: 'Table actions', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add row below', exact: true }).click();
  await expect(content.locator('table tr')).toHaveCount(4);
  await page.getByRole('button', { name: 'Table actions', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add column after', exact: true }).click();
  await expect(content.locator('tr').first().locator('th,td')).toHaveCount(4);
  await page.getByRole('button', { name: 'Add a block', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Database view', exact: true }).click();
  await dialog.getByLabel('Find a database').fill('Workflow data');
  await dialog.getByRole('button', { name: 'Create a new database', exact: true }).click();
  await expect(content.locator('.embedded-database')).toHaveCount(1);
  await content
    .locator('.embedded-database')
    .getByRole('button', { name: 'New record', exact: true })
    .click();
  await page.getByLabel('New record name', { exact: true }).fill('Embedded record');
  await page.getByLabel('New record name', { exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Close record', exact: true }).click();
  await expect(content.getByLabel('Name for Embedded record', { exact: true })).toBeVisible();
  await content.getByLabel('Name for Embedded record', { exact: true }).fill('Edited inline');
  await content.getByLabel('Name for Embedded record', { exact: true }).press('Tab');
  await expect(content.getByLabel('Name for Edited inline', { exact: true })).toBeVisible();
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await page.reload();
  await expect(content.getByLabel('Name for Edited inline', { exact: true })).toHaveValue(
    'Edited inline',
  );
  await expect(content.locator('table').first().locator('tr')).toHaveCount(4);
  // Use a genuine mouse gesture rather than synthetic HTML DragEvents.
  const source = page
    .locator('[data-tree-page]')
    .filter({ has: page.getByRole('button', { name: title, exact: true }) });
  const target = page
    .locator('[data-tree-page]')
    .filter({ has: page.getByRole('button', { name: destination.title, exact: true }) });
  await source.scrollIntoViewIfNeeded();
  const from = await source.boundingBox(),
    to = await target.boundingBox();
  await page.mouse.move(from!.x + 75, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(to!.x + 80, to!.y + to!.height / 2, { steps: 12 });
  await expect(page.locator('.tree-drag-status')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.breadcrumb-parent')).toHaveText(destination.title);
  await page.reload();
  await expect(page.locator('.breadcrumb-parent')).toHaveText(destination.title);
  expect(errors).toEqual([]);
  await context.request.delete(`/api/pages/${id}`, { headers: { 'x-note-request': '1' } });
  await context.request.delete(`/api/pages/${destination.id}`, {
    headers: { 'x-note-request': '1' },
  });
  await context.close();
});
test('a failed document request offers a working retry instead of an endless loading message', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  const page = await context.newPage();
  let fail = true;
  await page.route('**/api/pages/*/document', (route) =>
    fail
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'UNAVAILABLE', message: 'Connection interrupted.' }),
        })
      : route.continue(),
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Retry document', exact: true })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Retry document', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Page content' })).toBeVisible();
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await context.close();
});
test('rapid title and description edits persist in order rather than conflicting with each other', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  const session = await (await context.request.get('/api/session')).json();
  const note = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Metadata workflow ${Date.now()}` },
      headers: { 'x-note-request': '1' },
    })
  ).json();
  const page = await context.newPage();
  await page.route(`**/api/pages/${note.id}`, async (route) => {
    if (route.request().method() === 'PATCH' && route.request().postDataJSON().title)
      await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.goto(`/#${note.id}/document`);
  await expect(page.locator('.save-status')).toHaveText('Saved');
  const title = page.getByLabel('Page title', { exact: true });
  const description = page.getByLabel('Page description', { exact: true });
  await title.fill('Updated title');
  await title.press('Tab');
  await description.fill('A description edited immediately after its title.');
  await description.press('Tab');
  await expect
    .poll(
      async () => (await (await context.request.get(`/api/pages/${note.id}`)).json()).description,
    )
    .toBe('A description edited immediately after its title.');
  await expect
    .poll(async () => (await (await context.request.get(`/api/pages/${note.id}`)).json()).title)
    .toBe('Updated title');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await expect(title).toHaveValue('Updated title');
  await expect(description).toHaveValue('A description edited immediately after its title.');
  await context.request.delete(`/api/pages/${note.id}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
