import { test, expect } from '@playwright/test';
test('background navigation refresh does not replace the global database catalog with a document', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  const session = await (await context.request.get('/api/session')).json();
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Databases', exact: true }).click();
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
test('two application windows do not overwrite each other’s restored tabs', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  const session = await (await context.request.get('/api/session')).json(),
    notes = [];
  for (const suffix of ['one', 'two', 'three'])
    notes.push(
      await (
        await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
          data: { title: `Workbench window ${suffix} ${Date.now()}` },
          headers: { 'x-note-request': '1' },
        })
      ).json(),
    );
  const a = await context.newPage();
  await a.goto(`/#${notes[0].id}/document`);
  await a
    .locator('.page-tree')
    .getByRole('button', { name: notes[1].title, exact: true })
    .click({ modifiers: ['Control'] });
  const b = await context.newPage();
  await b.goto(`/#${notes[2].id}/document`);
  await expect(b.getByLabel('Page title', { exact: true })).toHaveValue(notes[2].title);
  for (const note of notes.slice(0, 2)) {
    const close = b.getByRole('button', { name: `Close ${note.title}`, exact: true });
    if (await close.count()) await close.click();
  }
  await a.reload();
  await expect(a.getByRole('tab', { name: notes[0].title, exact: true })).toBeVisible();
  await expect(a.getByRole('tab', { name: notes[1].title, exact: true })).toBeVisible();
  await b.reload();
  await expect(b.getByRole('tab', { name: notes[2].title, exact: true })).toBeVisible();
  await expect(b.getByRole('tab', { name: notes[0].title, exact: true })).toHaveCount(0);
  await expect(b.getByRole('tab', { name: notes[1].title, exact: true })).toHaveCount(0);
  for (const note of notes)
    await context.request.delete(`/api/pages/${note.id}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
test('modifier navigation and tree actions retain the current working page', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
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
    .click({ modifiers: ['Control'] });
  await expect(page.getByRole('tab', { name: notes[0].title, exact: true })).toBeVisible();
  await page.getByRole('tab', { name: notes[0].title, exact: true }).click();
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
  await expect(page.getByRole('tab', { name: notes[1].title, exact: true })).toHaveCount(0);
  await context.request.delete(`/api/pages/${notes[0].id}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
test('creates directly from the keyboard and keeps independent working tabs through reload', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
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
  const firstTab = page.getByRole('tab', { name: first, exact: true }),
    secondTab = page.getByRole('tab', { name: second, exact: true });
  const a = await firstTab.boundingBox(),
    b = await secondTab.boundingBox();
  await page.mouse.move(b!.x + 35, b!.y + 15);
  await page.mouse.down();
  await page.mouse.move(a!.x + 20, a!.y + 15, { steps: 10 });
  await page.mouse.up();
  const order = await page.getByRole('tab').allTextContents();
  expect(order.indexOf(second)).toBeLessThan(order.indexOf(first));
  await page.getByRole('tab', { name: first, exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Page content' })).toContainText(
    'The first independent working note.',
  );
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Page content' })).toContainText(
    'The second independent working note.',
  );
  await page.getByRole('button', { name: 'Go forward', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Page content' })).toContainText(
    'The first independent working note.',
  );
  await page.reload();
  await expect(page.getByRole('tab', { name: first, exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: second, exact: true })).toBeVisible();
  const restoredOrder = await page.getByRole('tab').allTextContents();
  expect(restoredOrder.indexOf(second)).toBeLessThan(restoredOrder.indexOf(first));
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
  await page.getByRole('tab', { name: second, exact: true }).click();
  await page.getByRole('button', { name: `Close ${second}`, exact: true }).click();
  await page.keyboard.press('Control+Alt+Shift+t');
  await expect(page.getByRole('textbox', { name: 'Page content' })).toContainText(
    'The second independent working note.',
  );
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.getByRole('textbox', { name: 'Page content' }).press('End');
  await page
    .getByRole('textbox', { name: 'Page content' })
    .pressSequentially(' Disconnected tab draft.');
  await expect(page.locator('.save-status')).toHaveText('Saved locally');
  await page.keyboard.press('Control+Alt+w');
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.keyboard.press('Control+Alt+Shift+t');
  await expect(page.getByRole('textbox', { name: 'Page content' })).toContainText(
    'Disconnected tab draft.',
  );
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await context.request.delete(`/api/pages/${firstId}`, { headers: { 'x-note-request': '1' } });
  await context.request.delete(`/api/pages/${secondId}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
