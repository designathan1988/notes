import { selectOption, selectValue } from './select.js';
import { APP_ORIGIN } from './origin.js';
import { expect, test, type Page } from './test.js';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
async function capture(page: Page, name: string) {
  if (process.env.NOTE_QA_OUTPUT) {
    await mkdir(process.env.NOTE_QA_OUTPUT, { recursive: true });
    await page.screenshot({ path: resolve(process.env.NOTE_QA_OUTPUT, name + '.png') });
  }
}

test('connected layouts, pointer grouping, record panel, computed values and actions use the same records', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json();
  const database = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Data layouts ${Date.now()}`, kind: 'database' },
      headers: { 'x-note-request': '1' },
    })
  ).json();
  await context.request.put(`/api/databases/${database.id}/fields`, {
    data: {
      revision: 1,
      fields: [
        { id: 'status', name: 'Status', type: 'select', options: ['Planned', 'Active'] },
        { id: 'due', name: 'Due', type: 'date' },
        { id: 'hours', name: 'Hours', type: 'number' },
        { id: 'cost', name: 'Cost', type: 'formula', formula: '[hours] * 15' },
        { id: 'done', name: 'Done', type: 'checkbox' },
        { id: 'related', name: 'Related', type: 'relation' },
        {
          id: 'complete',
          name: 'Complete',
          type: 'button',
          action: { fieldId: 'done', value: true },
        },
      ],
    },
    headers: { 'x-note-request': '1' },
  });
  const today = new Date().toISOString().slice(0, 10);
  const record = await (
    await context.request.post(`/api/databases/${database.id}/records`, {
      data: { title: 'Interview', values: { status: 'Planned', due: today, hours: 2 } },
      headers: { 'x-note-request': '1' },
    })
  ).json();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.text());
  });
  await page.goto(`/#${database.id}/database`);
  await selectOption(page.getByRole('combobox', { name: 'Layout', exact: true }), 'board');
  await selectOption(page.getByRole('combobox', { name: 'Group by', exact: true }), 'status');
  await page.getByRole('button', { name: 'Drag Interview', exact: true }).press('ArrowRight');
  await expect(page.getByRole('region', { name: 'Active group', exact: true })).toContainText(
    'Interview',
  );
  await page.getByRole('button', { name: 'Drag Interview', exact: true }).press('ArrowLeft');
  await expect(page.getByRole('region', { name: 'Planned group', exact: true })).toContainText(
    'Interview',
  );
  const grip = await page
    .getByRole('button', { name: 'Drag Interview', exact: true })
    .boundingBox();
  const column = await page
    .getByRole('region', { name: 'Active group', exact: true })
    .boundingBox();
  await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2);
  await page.mouse.down();
  await page.mouse.move(column!.x + column!.width / 2, column!.y + 70, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole('region', { name: 'Active group', exact: true })).toContainText(
    'Interview',
  );
  await page.getByRole('button', { name: 'Inspect Interview', exact: true }).click();
  await capture(page, 'board-inspector-desktop');
  const panel = page.getByRole('region', { name: 'Record details', exact: true });
  await panel.getByRole('spinbutton', { name: 'Hours for Interview', exact: true }).fill('3');
  await page.keyboard.press('Enter');
  await expect(panel.getByLabel('Cost for Interview', { exact: true })).toHaveText('45');
  await panel.getByRole('button', { name: 'Complete for Interview', exact: true }).click();
  await expect(
    panel.getByRole('checkbox', { name: 'Done for Interview', exact: true }),
  ).toBeChecked();
  await panel
    .getByRole('textbox', { name: 'Page content', exact: true })
    .fill('Evidence from the interview.');
  await expect(
    panel.getByRole('status', { name: 'Record document status', exact: true }),
  ).toHaveText('Saved');
  await capture(page, 'record-inspector-desktop');
  await panel.getByRole('button', { name: 'Close record', exact: true }).click();
  await selectOption(page.getByRole('combobox', { name: 'Layout', exact: true }), 'list');
  await expect(page.getByRole('list', { name: 'Database list', exact: true })).toContainText(
    'Interview',
  );
  await selectOption(page.getByRole('combobox', { name: 'Layout', exact: true }), 'calendar');
  await expect(page.locator(`[data-calendar-date="${today}"]`)).toContainText('Interview');
  const tomorrowDate = new Date(today + 'T12:00:00');
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  const calendarGrip = await page
      .getByRole('button', { name: 'Drag Interview', exact: true })
      .boundingBox(),
    day = await page.locator(`[data-calendar-date="${tomorrow}"]`).boundingBox();
  await page.mouse.move(
    calendarGrip!.x + calendarGrip!.width / 2,
    calendarGrip!.y + calendarGrip!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(day!.x + day!.width / 2, day!.y + 45, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator(`[data-calendar-date="${tomorrow}"]`)).toContainText('Interview');
  await expect(page.locator(`[data-calendar-date="${today}"]`)).not.toContainText('Interview');
  await page.getByRole('button', { name: 'New view', exact: true }).click();
  await page.getByRole('textbox', { name: 'View name', exact: true }).fill('Editorial calendar');
  await page.getByRole('button', { name: 'Save view', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Save this view', exact: true })).toBeHidden();
  await page.reload();
  await expect(
    selectValue(page.getByRole('combobox', { name: 'Layout', exact: true })),
  ).toHaveValue('calendar');
  await page.getByRole('button', { name: 'Editorial calendar', exact: true }).click();
  await expect(
    selectValue(page.getByRole('combobox', { name: 'Layout', exact: true })),
  ).toHaveValue('calendar');
  await selectOption(page.getByRole('combobox', { name: 'Layout', exact: true }), 'table');
  await expect(
    selectValue(page.getByRole('combobox', { name: 'Status for Interview', exact: true })),
  ).toHaveValue('Active');
  await expect(page.getByLabel('Cost for Interview', { exact: true })).toHaveText('45');
  await page.getByRole('button', { name: 'Related for Interview', exact: true }).click();
  const relation = page.getByRole('dialog', { name: 'Link a record', exact: true });
  await relation.getByRole('textbox', { name: 'Find a record', exact: true }).fill('Interview');
  const beforeRefresh = await (await context.request.get(`/api/databases/${database.id}`)).json();
  const currentRecord = beforeRefresh.records.find(
    (row: { pageId: string }) => row.pageId === record.pageId,
  );
  await context.request.patch(`/api/databases/${database.id}/records/${record.pageId}`, {
    data: { revision: currentRecord.revision, values: { hours: 6 } },
    headers: { 'x-note-request': '1' },
  });
  await expect(page.getByLabel('Cost for Interview', { exact: true })).toHaveText('90');
  await expect(relation).toBeVisible();
  await relation
    .getByRole('button', { name: 'Interview', exact: true })
    .filter({ hasText: database.title })
    .click();
  const second = await browser.newContext({ baseURL: APP_ORIGIN });
  await second.request.post('/api/auth/sign-in/email', {
    data: { email: 'amelia@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const colleague = await second.newPage();
  await colleague.goto(`/#${database.id}/database`);
  await selectOption(colleague.getByRole('combobox', { name: 'Layout', exact: true }), 'list');
  await colleague.getByRole('spinbutton', { name: 'Hours for Interview', exact: true }).fill('4');
  await colleague
    .getByRole('spinbutton', { name: 'Hours for Interview', exact: true })
    .press('Enter');
  await expect(page.getByLabel('Cost for Interview', { exact: true })).toHaveText('60');
  await second.close();
  await page.getByRole('button', { name: 'Edit view', exact: true }).click();
  await page.getByRole('textbox', { name: 'View name', exact: true }).fill('Team calendar');
  await page.getByRole('button', { name: 'Save view', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editorial calendar', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'Team calendar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit view', exact: true }).click();
  await page.getByRole('button', { name: 'Delete view', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Team calendar', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Manage properties', exact: true }).click();
  const properties = page.getByRole('dialog', { name: 'Database properties', exact: true });
  await properties.getByRole('button', { name: /^Hours/ }).click();
  await properties.getByRole('textbox', { name: 'Name', exact: true }).fill('Effort');
  await properties.getByRole('button', { name: 'Save property', exact: true }).click();
  const effort = properties.locator('.property-manager-list > div').filter({ hasText: 'Effort' });
  await effort.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(effort).toContainText('Archived');
  await properties.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Effort', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Cost for Interview', { exact: true })).toHaveText('60');
  await page.getByRole('button', { name: 'Manage properties', exact: true }).click();
  await effort.getByRole('button', { name: 'Restore', exact: true }).click();
  await properties.getByRole('button', { name: /^Cost/ }).click();
  await expect(properties.getByRole('textbox', { name: 'Formula', exact: true })).toHaveValue(
    'prop("Effort") * 15',
  );
  await properties
    .getByRole('textbox', { name: 'Formula', exact: true })
    .fill('prop("Effort") * 20');
  await properties.getByRole('button', { name: 'Save property', exact: true }).click();
  await properties.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Effort for Interview', exact: true }),
  ).toHaveValue('4');
  await expect(page.getByLabel('Cost for Interview', { exact: true })).toHaveText('80');
  await selectOption(page.getByRole('combobox', { name: 'Layout', exact: true }), 'board');
  await capture(page, 'board-desktop');
  await selectOption(page.getByRole('combobox', { name: 'Layout', exact: true }), 'calendar');
  await capture(page, 'calendar-desktop');
  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    await selectOption(page.getByRole('combobox', { name: 'Layout', exact: true }), 'board');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await capture(page, 'board-mobile-' + width);
    await selectOption(page.getByRole('combobox', { name: 'Layout', exact: true }), 'calendar');
    await expect(
      page
        .getByRole('grid', { name: 'Record calendar', exact: true })
        .getByRole('columnheader', { name: 'Sun', exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole('grid', { name: 'Record calendar', exact: true }).getByRole('row'),
    ).toHaveCount(7);
    await expect(page.getByRole('list', { name: 'Monthly agenda', exact: true })).toContainText(
      'Interview',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await capture(page, 'calendar-mobile-' + width);
  }
  const persisted = await (await context.request.get(`/api/databases/${database.id}`)).json();
  expect(errors).toEqual([]);
  expect(
    persisted.records.find((row: { pageId: string }) => row.pageId === record.pageId).values.done,
  ).toBe(true);
  await context.request.delete(`/api/pages/${database.id}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
