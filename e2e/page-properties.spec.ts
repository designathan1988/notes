import { test, expect, type BrowserContext } from '@playwright/test';
const headers = { 'x-note-request': '1' };
async function signIn(context: BrowserContext, email = 'jonathan@note.test') {
  await context.request.post('/api/auth/sign-in/email', {
    data: { email, password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
}

test('ordinary-page properties edit inline, calculate, retain conflicts and archive without losing values', async ({
  browser,
}) => {
  const firstContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' }),
    secondContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await signIn(firstContext);
  await signIn(secondContext, 'amelia@note.test');
  const session = await (await firstContext.request.get('/api/session')).json();
  const note = await (
    await firstContext.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      headers,
      data: { title: `Typed page ${Date.now()}` },
    })
  ).json();
  const first = await firstContext.newPage(),
    second = await secondContext.newPage();
  const errors: string[] = [];
  first.on('pageerror', (error) => errors.push(error.message));
  try {
    await first.goto(`/#${note.id}/document`);
    await expect(
      first.getByRole('button', { name: 'Add page property', exact: true }),
    ).toBeVisible();
    await first.getByRole('button', { name: 'Add page property', exact: true }).click();
    const dialog = first.getByRole('dialog', { name: 'Add a property', exact: true });
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Topic');
    await dialog.getByRole('button', { name: 'Add property', exact: true }).click();
    const topic = first.getByRole('textbox', { name: `Topic for ${note.title}`, exact: true });
    await topic.fill('Research synthesis');
    await topic.press('Enter');
    await first.getByRole('button', { name: 'Add page property', exact: true }).click();
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Hours');
    await dialog.getByRole('combobox', { name: 'Type', exact: true }).selectOption('number');
    await dialog.getByRole('button', { name: 'Add property', exact: true }).click();
    const hours = first.getByRole('spinbutton', { name: `Hours for ${note.title}`, exact: true });
    await hours.fill('4');
    await hours.press('Enter');
    await first.getByRole('button', { name: 'Add page property', exact: true }).click();
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Cost');
    await dialog.getByRole('combobox', { name: 'Type', exact: true }).selectOption('formula');
    await dialog.getByRole('textbox', { name: 'Formula', exact: true }).fill('prop("Hours") * 15');
    await dialog.getByRole('button', { name: 'Add property', exact: true }).click();
    await expect(first.getByLabel(`Cost for ${note.title}`, { exact: true })).toHaveText('60');
    await first.reload();
    await expect(topic).toHaveValue('Research synthesis');
    await expect(hours).toHaveValue('4');
    await second.goto(`/#${note.id}/document`);
    await expect(
      second.getByRole('textbox', { name: `Topic for ${note.title}`, exact: true }),
    ).toHaveValue('Research synthesis');
    await topic.fill('Unsubmitted local edit');
    const refreshed = first.waitForResponse(
      async (response) =>
        response.url().includes('/navigation') &&
        response.ok() &&
        JSON.stringify(await response.json()).includes('Colleague decision'),
    );
    const other = second.getByRole('textbox', { name: `Topic for ${note.title}`, exact: true });
    await other.fill('Colleague decision');
    await other.press('Enter');
    await refreshed;
    await topic.press('Enter');
    await expect(
      first.getByRole('alert').filter({ hasText: 'This property changed while you were editing' }),
    ).toBeVisible();
    expect(
      JSON.stringify(
        (await (await firstContext.request.get(`/api/pages/${note.id}`)).json()).properties.values,
      ),
    ).toContain('Colleague decision');
    await first.reload();
    await first.getByRole('button', { name: 'Manage page properties', exact: true }).click();
    const manager = first.getByRole('dialog', { name: 'Page properties', exact: true }),
      row = manager.locator('.property-manager-list > div').filter({ hasText: 'Topic' });
    await manager.getByRole('button', { name: /^Hours/ }).click();
    await manager.getByRole('textbox', { name: 'Name', exact: true }).fill('Effort');
    const stored = await (await firstContext.request.get(`/api/pages/${note.id}`)).json(),
      hoursId = stored.properties.fields.find(
        (field: { name: string }) => field.name === 'Hours',
      ).id;
    const schemaRefresh = first.waitForResponse(
      async (response) =>
        response.url().includes('/navigation') &&
        response.ok() &&
        (await response.json()).pages?.some(
          (page: { id: string; properties?: { values: Record<string, unknown> } }) =>
            page.id === note.id && page.properties?.values[hoursId] === 6,
        ),
    );
    const otherHours = second.getByRole('spinbutton', {
      name: `Hours for ${note.title}`,
      exact: true,
    });
    await otherHours.fill('6');
    await otherHours.press('Enter');
    await schemaRefresh;
    await manager.getByRole('button', { name: 'Save property', exact: true }).click();
    await expect(manager.getByRole('alert')).toContainText(
      'The properties changed while you were editing',
    );
    await manager.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await expect(hours).toHaveValue('6');
    await first.getByRole('button', { name: 'Manage page properties', exact: true }).click();
    await row.getByRole('button', { name: 'Archive', exact: true }).click();
    await manager.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await expect(topic).toBeHidden();
    await first.reload();
    await first.getByRole('button', { name: 'Manage page properties', exact: true }).click();
    await row.getByRole('button', { name: 'Restore', exact: true }).click();
    await manager.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await expect(topic).toHaveValue('Colleague decision');
    await first.getByRole('button', { name: 'Add page property', exact: true }).click();
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Source');
    await dialog.getByRole('combobox', { name: 'Type', exact: true }).selectOption('relation');
    await dialog.getByRole('button', { name: 'Add property', exact: true }).click();
    await first.getByRole('button', { name: `Source for ${note.title}`, exact: true }).click();
    const links = first.getByRole('dialog', { name: 'Link a page', exact: true });
    await links.getByRole('textbox', { name: 'Find a page', exact: true }).fill(note.title);
    await links.getByRole('button', { name: note.title, exact: true }).click();
    await expect(
      first.getByRole('button', { name: `Source for ${note.title}`, exact: true }),
    ).toContainText(note.title);
    await first.setViewportSize({ width: 360, height: 844 });
    expect(await first.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    expect(errors).toEqual([]);
  } finally {
    await firstContext.request.delete(`/api/pages/${note.id}`, { headers }).catch(() => {});
    await firstContext.close().catch(() => {});
    await secondContext.close().catch(() => {});
  }
});

test('opening a record directly edits the canonical properties and updates its table', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await signIn(context);
  const session = await (await context.request.get('/api/session')).json();
  const database = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      headers,
      data: { title: `Record page ${Date.now()}`, kind: 'database' },
    })
  ).json();
  await context.request.put(`/api/databases/${database.id}/fields`, {
    headers,
    data: {
      revision: 1,
      fields: [
        { id: 'hours', name: 'Hours', type: 'number' },
        { id: 'cost', name: 'Cost', type: 'formula', formula: '[hours] * 15' },
        { id: 'done', name: 'Done', type: 'checkbox' },
      ],
    },
  });
  const record = await (
    await context.request.post(`/api/databases/${database.id}/records`, {
      headers,
      data: { title: 'Interview analysis', values: { hours: 3, done: false } },
    })
  ).json();
  const page = await context.newPage();
  try {
    await page.goto(`/#${record.pageId}/document`);
    const hours = page.getByRole('spinbutton', {
      name: 'Hours for Interview analysis',
      exact: true,
    });
    await expect(hours).toHaveValue('3');
    await page.getByRole('tab', { name: 'Interview analysis', exact: true }).dblclick();
    await hours.fill('5');
    await hours.press('Enter');
    await expect(page.getByLabel('Cost for Interview analysis', { exact: true })).toHaveText('75');
    const done = page.getByRole('checkbox', { name: 'Done for Interview analysis', exact: true });
    await done.check();
    await expect(done).toBeChecked();
    await page.reload();
    await expect(hours).toHaveValue('5');
    const saved = await (
      await context.request.get(`/api/databases/${database.id}/records/${record.pageId}`)
    ).json();
    expect(saved.record.values).toEqual({ hours: 5, done: true });
    await page.getByRole('button', { name: database.title, exact: true }).first().click();
    await expect(hours).toHaveValue('5');
    await hours.fill('7');
    await hours.press('Enter');
    await page.getByRole('tab', { name: 'Interview analysis', exact: true }).click();
    await expect(hours).toHaveValue('7');
    await page.setViewportSize({ width: 360, height: 844 });
    expect((await done.boundingBox())!.width).toBeLessThanOrEqual(24);
  } finally {
    await context.request.delete(`/api/pages/${database.id}`, { headers }).catch(() => {});
    await context.close();
  }
});
