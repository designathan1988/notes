import { expect, test } from '@playwright/test';
import { APP_ORIGIN } from './origin.js';
import { selectOption } from './select.js';

test('an empty calendar creates and selects a real date property from its guidance', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  const headers = { 'x-note-request': '1' };
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json();
  const response = await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    headers,
    data: { title: 'Calendar configuration regression', kind: 'database' },
  });
  expect(response.ok()).toBe(true);
  const database = await response.json();
  const page = await context.newPage();
  try {
    await page.goto(`/#${database.id}/database`);
    await selectOption(page.getByRole('combobox', { name: 'Layout', exact: true }), 'calendar');
    await page.getByRole('button', { name: 'Add date property', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add a property', exact: true });
    await expect(dialog.getByRole('combobox', { name: 'Type', exact: true })).toContainText('Date');
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Scheduled date');
    await dialog.getByRole('button', { name: 'Add property', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('grid', { name: 'Record calendar', exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Date property', exact: true })).toContainText(
      'Scheduled date',
    );
    const definition = await (await context.request.get(`/api/databases/${database.id}`)).json();
    expect(definition.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Scheduled date', type: 'date' })]),
    );
  } finally {
    await context.request.delete(`/api/pages/${database.id}`, { headers });
    await context.close();
  }
});
