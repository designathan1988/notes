import { expect, test } from '@playwright/test';

test('creates records inline and configures typed properties, formulas and actions without losing concurrent schema edits', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  const session = await (await context.request.get('/api/session')).json();
  const database = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Data properties ${Date.now()}`, kind: 'database' },
      headers: { 'x-note-request': '1' },
    })
  ).json();
  await context.request.put(`/api/databases/${database.id}/fields`, {
    data: { revision: 1, fields: [] },
    headers: { 'x-note-request': '1' },
  });
  const page = await context.newPage();
  await page.goto(`/#${database.id}/database`);
  const add = async (name: string, type: string) => {
    await page
      .locator('.table-actions')
      .getByRole('button', { name: 'Add property', exact: true })
      .click();
    const form = page.getByRole('dialog', { name: 'Add a property', exact: true });
    await form.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
    await form.getByRole('combobox', { name: 'Type', exact: true }).selectOption(type);
    return form;
  };
  let form = await add('Estimate', 'number');
  await form.getByRole('button', { name: 'Add property', exact: true }).click();
  form = await add('Category', 'select');
  await form
    .getByRole('textbox', { name: 'Select options', exact: true })
    .pressSequentially('One, Two');
  await form.getByRole('button', { name: 'Add property', exact: true }).click();
  form = await add('Cost', 'formula');
  await form.getByRole('button', { name: 'Estimate', exact: true }).click();
  await expect(form.getByRole('textbox', { name: 'Formula', exact: true })).toHaveValue(
    'prop("Estimate")',
  );
  await form.getByRole('textbox', { name: 'Formula', exact: true }).press('End');
  await page.keyboard.type(' * 10');
  await form.getByRole('button', { name: 'Add property', exact: true }).click();
  form = await add('Approved', 'checkbox');
  await form.getByRole('button', { name: 'Add property', exact: true }).click();
  form = await add('Approve', 'button');
  await form
    .getByRole('combobox', { name: 'Action property', exact: true })
    .selectOption({ label: 'Approved' });
  await form.getByRole('button', { name: 'Add property', exact: true }).click();
  await page
    .locator('.table-actions')
    .getByRole('button', { name: 'New record', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'New record name', exact: true }).fill('Brief');
  await page.keyboard.press('Enter');
  const panel = page.getByRole('region', { name: 'Record details', exact: true });
  await panel.getByRole('spinbutton', { name: 'Estimate for Brief', exact: true }).fill('5');
  await page.keyboard.press('Enter');
  await expect(panel.getByLabel('Cost for Brief', { exact: true })).toHaveText('50');
  await panel
    .getByRole('combobox', { name: 'Category for Brief', exact: true })
    .selectOption('Two');
  await panel.getByRole('button', { name: 'Approve for Brief', exact: true }).click();
  await expect(
    panel.getByRole('checkbox', { name: 'Approved for Brief', exact: true }),
  ).toBeChecked();
  await panel.getByRole('button', { name: 'Close record', exact: true }).click();
  await page.getByRole('button', { name: 'Manage properties', exact: true }).click();
  form = page.getByRole('dialog', { name: 'Database properties', exact: true });
  await form.getByRole('button', { name: /^Estimate/ }).click();
  await form.getByRole('textbox', { name: 'Name', exact: true }).fill('Wrong overwrite');
  const current = await (await context.request.get(`/api/databases/${database.id}`)).json();
  const result = await context.request.put(`/api/databases/${database.id}/fields`, {
    data: {
      revision: current.fieldsRevision,
      fields: current.fields.map((field: { id: string; name: string }) =>
        field.name === 'Estimate' ? { ...field, name: 'Effort' } : field,
      ),
    },
    headers: { 'x-note-request': '1' },
  });
  expect(result.ok()).toBe(true);
  await form.getByRole('button', { name: 'Save property', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText(/properties changed/i);
  await form.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(form.getByRole('button', { name: /^Effort/ })).toBeVisible();
  await form.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Effort for Brief', exact: true })).toHaveValue(
    '5',
  );
  await expect(page.getByLabel('Cost for Brief', { exact: true })).toHaveText('50');
  await expect(page.getByRole('combobox', { name: 'Category for Brief', exact: true })).toHaveValue(
    'Two',
  );
  await context.request.delete(`/api/pages/${database.id}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
