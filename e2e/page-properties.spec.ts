import { test, expect, type BrowserContext } from '@playwright/test';
const headers = { 'x-note-request': '1' };
async function signIn(context: BrowserContext, email = 'jonathan@note.test') {
  await context.request.post('/api/auth/sign-in/email', {
    data: { email, password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
}
test('a pending property write retains its draft when a newer navigation reply arrives before rejection', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' }),
    colleague = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await signIn(context);
  await signIn(colleague, 'amelia@note.test');
  const session = await (await context.request.get('/api/session')).json(),
    topicField = { id: 'topic', name: 'Topic', type: 'text' },
    hoursField = { id: 'hours', name: 'Hours', type: 'number' };
  let note = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      headers,
      data: { title: `Pending property draft ${Date.now()}` },
    })
  ).json();
  note = await (
    await context.request.patch(`/api/pages/${note.id}`, {
      headers,
      data: { revision: note.revision, fields: [topicField, hoursField] },
    })
  ).json();
  for (const [field, value] of [
    [topicField, 'Original choice'],
    [hoursField, 1],
  ] as const)
    note = await (
      await context.request.patch(`/api/pages/${note.id}`, {
        headers,
        data: {
          revision: note.revision,
          property: { id: field.id, value, expectedValue: null, expectedField: field },
        },
      })
    ).json();
  const page = await context.newPage();
  let releaseNavigation!: () => void,
    releaseRejection!: () => void,
    latestReady!: () => void,
    rejectedReady!: () => void;
  const navigationGate = new Promise<void>((resolve) => {
      releaseNavigation = resolve;
    }),
    rejectionGate = new Promise<void>((resolve) => {
      releaseRejection = resolve;
    }),
    latest = new Promise<void>((resolve) => {
      latestReady = resolve;
    }),
    rejected = new Promise<void>((resolve) => {
      rejectedReady = resolve;
    });
  try {
    await page.goto(`/#${note.id}/document`);
    const topic = page.getByRole('textbox', { name: `Topic for ${note.title}`, exact: true }),
      hours = page.getByRole('spinbutton', { name: `Hours for ${note.title}`, exact: true });
    await expect(hours).toHaveValue('1');
    await topic.fill('Local draft kept');
    await page.route('**/api/workspaces/*/navigation', async (route) => {
      const response = await route.fetch(),
        snapshot = await response.json(),
        current = snapshot.pages?.find((item: { id: string }) => item.id === note.id);
      if (current?.properties?.values.topic === 'Remote choice') {
        if (current.properties.values.hours === 2) latestReady();
        await navigationGate;
      }
      await route.fulfill({ response });
    });
    await page.route(`**/api/pages/${note.id}`, async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      expect(response.status()).toBe(409);
      rejectedReady();
      await rejectionGate;
      await route.fulfill({ response });
    });
    const remote = await (
      await colleague.request.patch(`/api/pages/${note.id}`, {
        headers,
        data: {
          revision: note.revision,
          property: {
            id: 'topic',
            value: 'Remote choice',
            expectedValue: 'Original choice',
            expectedField: topicField,
          },
        },
      })
    ).json();
    expect(
      (
        await colleague.request.patch(`/api/pages/${note.id}`, {
          headers,
          data: {
            revision: remote.revision,
            property: { id: 'hours', value: 2, expectedValue: 1, expectedField: hoursField },
          },
        })
      ).ok(),
    ).toBe(true);
    await latest;
    await topic.press('Enter');
    await rejected;
    releaseNavigation();
    await expect(hours).toHaveValue('2');
    await expect(topic).toHaveValue('Local draft kept');
    releaseRejection();
    await expect(page.getByRole('alert')).toContainText('Not saved:');
    await expect(topic).toHaveValue('Local draft kept');
    expect(
      (await (await context.request.get(`/api/pages/${note.id}`)).json()).properties.values.topic,
    ).toBe('Remote choice');
  } finally {
    releaseNavigation();
    releaseRejection();
    await context.request.delete(`/api/pages/${note.id}`, { headers }).catch(() => {});
    await context.close().catch(() => {});
    await colleague.close().catch(() => {});
  }
});
test('opening a property editor waits for this page’s own pending value write', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await signIn(context);
  const session = await (await context.request.get('/api/session')).json(),
    field = { id: 'hours', name: 'Hours', type: 'number' };
  let note = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      headers,
      data: { title: `Queued property editor ${Date.now()}` },
    })
  ).json();
  note = await (
    await context.request.patch(`/api/pages/${note.id}`, {
      headers,
      data: { revision: note.revision, fields: [field] },
    })
  ).json();
  note = await (
    await context.request.patch(`/api/pages/${note.id}`, {
      headers,
      data: {
        revision: note.revision,
        property: { id: field.id, value: 1, expectedValue: null, expectedField: field },
      },
    })
  ).json();
  const page = await context.newPage();
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    pending = new Promise<void>((resolve) => {
      started = resolve;
    });
  try {
    await page.goto(`/#${note.id}/document`);
    const hours = page.getByRole('spinbutton', { name: `Hours for ${note.title}`, exact: true });
    await expect(hours).toHaveValue('1');
    await page.route(`**/api/pages/${note.id}`, async (route) => {
      if (
        route.request().method() === 'PATCH' &&
        route.request().postDataJSON().property?.id === 'hours'
      ) {
        started();
        await gate;
      }
      await route.continue();
    });
    await hours.fill('2');
    await hours.press('Enter');
    await pending;
    const add = page.getByRole('button', { name: 'Add page property', exact: true });
    await add.click();
    await expect(add).toBeDisabled();
    const dialog = page.getByRole('dialog', { name: 'Add a property', exact: true });
    await expect(dialog).toBeHidden();
    release();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Cost');
    await dialog.getByRole('combobox', { name: 'Type', exact: true }).selectOption('formula');
    await dialog.getByRole('textbox', { name: 'Formula', exact: true }).fill('prop("Hours") * 15');
    await dialog.getByRole('button', { name: 'Add property', exact: true }).click();
    await expect(page.getByLabel(`Cost for ${note.title}`, { exact: true })).toHaveText('30');
    await page.reload();
    await expect(hours).toHaveValue('2');
    await expect(page.getByLabel(`Cost for ${note.title}`, { exact: true })).toHaveText('30');
  } finally {
    release();
    await context.request.delete(`/api/pages/${note.id}`, { headers }).catch(() => {});
    await context.close().catch(() => {});
  }
});

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
    await first.getByRole('button', { name: 'Customize page', exact: true }).click();

    await first.getByRole('menuitem', { name: 'Page properties', exact: true }).click();
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
    const conflict = first.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/pages/${note.id}`) && response.request().method() === 'PATCH',
    );
    await topic.press('Enter');
    const rejected = await conflict;
    expect(rejected.status()).toBe(409);
    expect((await rejected.json()).code).toBe('CONFLICT');
    // Receiving navigation data does not mean React has applied its revision yet.
    // Either revision or value comparison must reject the stale draft and retain it.
    await expect(first.getByRole('alert')).toContainText(
      /Not saved: (This property changed while you were editing|The page changed)/,
    );
    await expect(topic).toHaveValue('Unsubmitted local edit');
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
      /The properties changed while you were editing|The page changed/,
    );
    await expect(manager.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Effort');
    const preservedSchema = await (await firstContext.request.get(`/api/pages/${note.id}`)).json();
    expect(
      preservedSchema.properties.fields.find((field: { id: string }) => field.id === hoursId).name,
    ).toBe('Hours');
    expect(preservedSchema.properties.values[hoursId]).toBe(6);
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
    // A checked value is optimistic; wait for its owning save to settle before reload.
    await expect(done).toBeEnabled();
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
