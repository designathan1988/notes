import { test, expect } from '@playwright/test';
test('database controls save typed values, relations, filtered views, sorting, favorites and trash restoration', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Databases', exact: true }).click();
  await page.getByRole('button', { name: 'New database', exact: true }).click();
  const dialog = page.getByRole('dialog'),
    title = `Database workflow ${Date.now()}`;
  const alpha = `Alpha ${Date.now()}`,
    zeta = `Zeta ${Date.now()}`;
  await expect(dialog.getByRole('combobox', { name: 'Page type', exact: true })).toHaveValue(
    'database',
  );
  await dialog.getByLabel('Title', { exact: true }).fill(title);
  await dialog.getByRole('button', { name: 'Create page', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Database records' })).toBeVisible();
  const id = page.url().split('#')[1].split('/')[0];
  async function property(name: string, type: string) {
    await page.getByRole('button', { name: 'Add property', exact: true }).click();
    await dialog.getByLabel('Name', { exact: true }).fill(name);
    await dialog.getByRole('combobox', { name: /^Type/ }).selectOption(type);
    await dialog.getByRole('button', { name: 'Add property', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name, exact: true })).toBeVisible();
  }
  await property('Effort', 'number');
  await property('Related', 'relation');
  await property('Done', 'checkbox');
  for (const name of [zeta, alpha]) {
    await page
      .locator('.table-actions')
      .getByRole('button', { name: 'New record', exact: true })
      .click();
    await dialog.getByLabel('Name', { exact: true }).fill(name);
    await dialog.getByRole('button', { name: 'Create record', exact: true }).click();
    await expect(page.getByLabel(`Name for ${name}`, { exact: true })).toBeVisible();
  }
  await page.getByLabel(`Effort for ${alpha}`, { exact: true }).fill('42');
  await page.getByLabel(`Effort for ${alpha}`, { exact: true }).press('Tab');
  await page.getByLabel(`Done for ${alpha}`, { exact: true }).check();
  await page.getByRole('button', { name: `Related for ${alpha}`, exact: true }).click();
  await dialog.getByLabel('Find a record', { exact: true }).fill(zeta);
  await dialog.getByRole('button', { name: zeta, exact: true }).click();
  await expect(page.getByRole('button', { name: `Related for ${alpha}`, exact: true })).toHaveText(
    zeta,
  );
  await page.getByRole('combobox', { name: 'Sort records', exact: true }).selectOption('title');
  await page.getByRole('button', { name: 'Sort ascending', exact: true }).click();
  await expect(
    page.getByRole('table').locator('tbody tr').first().getByRole('textbox').first(),
  ).toHaveValue(zeta);
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await page.getByPlaceholder('Search names and properties…').fill(alpha);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Visible columns', exact: true }).click();
  await dialog.getByLabel('Effort', { exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'New view', exact: true }).click();
  await dialog.getByLabel('View name', { exact: true }).fill('Focused view');
  await dialog.getByRole('button', { name: 'Save view', exact: true }).click();
  await page.getByRole('button', { name: 'All records', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'Focused view', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('columnheader', { name: 'Effort', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add to favorites', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Focused view', exact: true }).click();
  await expect(page.getByRole('button', { name: `Related for ${alpha}`, exact: true })).toHaveText(
    zeta,
  );
  await expect(page.getByLabel(`Done for ${alpha}`, { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'All records', exact: true }).click();
  await expect(page.getByLabel(`Effort for ${alpha}`, { exact: true })).toHaveValue('42');
  await page.getByRole('button', { name: 'Page actions', exact: true }).click();
  await dialog.getByRole('button', { name: 'Move to trash', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await dialog.getByRole('button', { name: 'Trash', exact: true }).click();
  await dialog
    .locator('.trash-row')
    .filter({ hasText: title })
    .getByRole('button', { name: 'Restore', exact: true })
    .click();
  await expect(dialog.locator('.trash-row').filter({ hasText: title })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.locator('.favorites').getByRole('button', { name: title, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${id}/database$`));
  await expect(page.getByRole('table', { name: 'Database records' })).toBeVisible();
  expect(errors).toEqual([]);
  await context.request.delete(`/api/pages/${id}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
