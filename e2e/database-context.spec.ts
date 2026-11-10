import { selectValue } from './select.js';
import { APP_ORIGIN } from './origin.js';
import { expect, test } from './test.js';

test('switching databases closes the previous record panel and keeps each saved view context', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json(),
    databases = [];
  for (const name of ['First', 'Second'])
    databases.push(
      await (
        await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
          data: { title: `Database context ${name} ${Date.now()}`, kind: 'database' },
          headers: { 'x-note-request': '1' },
        })
      ).json(),
    );
  await context.request.post(`/api/databases/${databases[0].id}/records`, {
    data: { title: 'Context record', values: {} },
    headers: { 'x-note-request': '1' },
  });
  await context.request.post(`/api/databases/${databases[1].id}/views`, {
    data: { name: 'Second list', config: { layout: 'list' } },
    headers: { 'x-note-request': '1' },
  });
  const page = await context.newPage();
  await page.goto(`/#${databases[0].id}/database`);
  await page
    .locator('.page-tree')
    .getByRole('button', { name: databases[1].title, exact: true })
    .click();
  await page.getByRole('button', { name: 'Second list', exact: true }).click();
  await expect(
    selectValue(page.getByRole('combobox', { name: 'Layout', exact: true })),
  ).toHaveValue('list');
  await page
    .locator('.page-tree')
    .getByRole('button', { name: databases[0].title, exact: true })
    .click();
  await page.getByRole('button', { name: 'Inspect Context record', exact: true }).click();
  await page
    .locator('.page-tree')
    .getByRole('button', { name: databases[1].title, exact: true })
    .click();
  await expect(
    selectValue(page.getByRole('combobox', { name: 'Layout', exact: true })),
  ).toHaveValue('list');
  await expect(page.getByRole('region', { name: 'Record details', exact: true })).toHaveCount(0);
  for (const database of databases)
    await context.request.delete(`/api/pages/${database.id}`, {
      headers: { 'x-note-request': '1' },
    });
  await context.close();
});
