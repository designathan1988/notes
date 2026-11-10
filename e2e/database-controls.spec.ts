import { selectOption } from './select.js';
import { APP_ORIGIN } from './origin.js';
import { test, expect } from './test.js';
import { openCatalog } from './navigate.js';
test('database controls save typed values, relations, filtered views, sorting, favorites and trash restoration', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await openCatalog(page, 'database');
  await page.getByRole('button', { name: 'New database', exact: true }).click();
  const dialog = page.getByRole('dialog'),
    title = `Database workflow ${Date.now()}`;
  const alpha = `Alpha ${Date.now()}`,
    zeta = `Zeta ${Date.now()}`;
  await expect(page.getByLabel('Page title', { exact: true })).toHaveValue('Untitled database');
  await page.getByLabel('Page title', { exact: true }).fill(title);
  await page.getByLabel('Page title', { exact: true }).press('Enter');
  await expect(page.getByRole('table', { name: 'Database records' })).toBeVisible();
  const id = page.url().split('#')[1].split('/')[0];
  async function property(name: string, type: string) {
    await page.getByRole('button', { name: 'Add property', exact: true }).click();
    await dialog.getByLabel('Name', { exact: true }).fill(name);
    await selectOption(dialog.getByRole('combobox', { name: /^Type/ }), type);
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
    await page.getByLabel('New record name', { exact: true }).fill(name);
    await page.getByLabel('New record name', { exact: true }).press('Enter');
    await page.getByRole('button', { name: 'Close record', exact: true }).click();
    await expect(page.getByLabel(`Name for ${name}`, { exact: true })).toBeVisible();
  }
  await page.getByLabel(`Effort for ${alpha}`, { exact: true }).fill('42');
  await page.getByLabel(`Effort for ${alpha}`, { exact: true }).press('Tab');
  // Let the effort save and its row refresh settle before toggling the next cell.
  await expect(page.locator('.cell-saving')).toHaveCount(0);
  await page.getByLabel(`Done for ${alpha}`, { exact: true }).check();
  await page.getByRole('button', { name: `Related for ${alpha}`, exact: true }).click();
  await dialog.getByLabel('Find a record', { exact: true }).fill(zeta);
  await dialog.getByRole('button', { name: zeta, exact: true }).click();
  await expect(page.getByRole('button', { name: `Related for ${alpha}`, exact: true })).toHaveText(
    zeta,
  );
  await selectOption(page.getByRole('combobox', { name: 'Sort records', exact: true }), 'title');
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
  await page.getByRole('button', { name: 'Page actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Add to favorites', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Focused view', exact: true }).click();
  await expect(page.getByRole('button', { name: `Related for ${alpha}`, exact: true })).toHaveText(
    zeta,
  );
  await expect(page.getByLabel(`Done for ${alpha}`, { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'All records', exact: true }).click();
  await expect(page.getByLabel(`Effort for ${alpha}`, { exact: true })).toHaveValue('42');
  await page.getByRole('button', { name: 'Page actions', exact: true }).click();
  await page
    .getByRole('menu', { name: 'Page actions' })
    .getByRole('menuitem', { name: 'Move to trash', exact: true })
    .click();
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();

  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await dialog.getByRole('tab', { name: 'Trash', exact: true }).click();
  await dialog
    .locator('.trash-row')
    .filter({ hasText: title })
    .getByRole('button', { name: `Restore ${title}`, exact: true })
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
