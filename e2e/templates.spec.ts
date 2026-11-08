import { expect, test, type BrowserContext, type Page } from '@playwright/test';
async function useDefinition(page: Page, name: string) {
  await page.getByRole('button', { name: 'Use template', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Template definition', exact: true })).toBeHidden();
  const title = page.getByRole('textbox', { name: 'Page title', exact: true });
  await expect(title).toBeFocused();
  await title.fill(name);
  await title.press('Enter');
}
const headers = { 'x-note-request': '1' };
async function signIn(context: BrowserContext, email = 'jonathan@note.test') {
  const response = await context.request.post('/api/auth/sign-in/email', {
    data: { email, password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  expect(response.ok()).toBe(true);
  return (await (await context.request.get('/api/session')).json()).workspaces[0].id as string;
}
const body = (text: string) => ({
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Start with the evidence' }],
    },
    { type: 'paragraph', content: [{ type: 'text', text }] },
    {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Keep evidence close to its original context.' }],
        },
      ],
    },
    ...['bulletList', 'orderedList'].map((type) => ({
      type,
      content: ['Keep the source linked.', 'Review the open questions.'].map((text) => ({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
      })),
    })),
  ],
});
test('saves and edits reusable page trees, captures the last typed content and creates independent instances', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' }),
    workspace = await signIn(context),
    roots: string[] = [];
  const create = async (title: string, parentId?: string) => {
    const response = await context.request.post(`/api/workspaces/${workspace}/pages`, {
      headers,
      data: {
        title,
        parentId,
        visibility: 'private',
        purpose: 'copy',
        requestId: crypto.randomUUID(),
        content: body('Gather observations and record what remains uncertain.'),
      },
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  const source = await create(`Template source ${Date.now()}`);
  roots.push(source.id);
  await create('Evidence and references', source.id);
  const page = await context.newPage(),
    title = `Research template ${Date.now()}`,
    errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(`/#${source.id}/document`);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Customize page', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Add cover', exact: true }).click();
    await page.getByLabel('Upload cover image').setInputFiles({
      name: 'cover.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await expect(page.getByRole('img', { name: 'Page cover', exact: true })).toBeVisible();
    const content = page.getByRole('textbox', { name: 'Page content', exact: true });
    await content.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Last-second source text');
    await page.getByRole('button', { name: 'Page actions', exact: true }).click();
    await expect(
      page.getByRole('menuitem', { name: 'Save as template', exact: true }),
    ).toBeVisible();
    await page.getByRole('menuitem', { name: 'Save as template', exact: true }).click();
    const save = page.getByRole('dialog', { name: 'Save as template', exact: true });
    await save.getByRole('textbox', { name: 'Template name', exact: true }).fill(title);
    await save.getByRole('button', { name: 'Save template', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Template definition', exact: true }),
    ).toBeVisible();
    await expect(content).toContainText('Last-second source text');
    const templateId = page.url().split('#')[1].split('/')[0];
    roots.push(templateId);
    const template = await (await context.request.get(`/api/pages/${templateId}`)).json();
    expect(template.templateRootId).toBe(templateId);
    const children = await (
      await context.request.get(`/api/workspaces/${workspace}/children?parent=${templateId}`)
    ).json();
    expect(children.pages.map((child: { title: string }) => child.title)).toContain(
      'Evidence and references',
    );
    const sourceDetails = await (await context.request.get(`/api/pages/${source.id}`)).json();
    expect(template.cover.attachmentId).not.toBe(sourceDetails.cover.attachmentId);
    await content.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Only the reusable definition');
    await useDefinition(page, 'Independent research instance');
    await expect(page.getByRole('textbox', { name: 'Page title', exact: true })).toHaveValue(
      'Independent research instance',
    );
    await expect(content).toContainText('Only the reusable definition');
    const instanceId = page.url().split('#')[1].split('/')[0];
    roots.push(instanceId);
    const instance = await (await context.request.get(`/api/pages/${instanceId}`)).json();
    expect(instance.templateRootId).toBeNull();
    expect(instance.cover.attachmentId).not.toBe(template.cover.attachmentId);
    const originalBytes = await (
      await context.request.get(`/api/attachments/${sourceDetails.cover.attachmentId}/content`)
    ).body();
    expect(
      await (
        await context.request.get(`/api/attachments/${template.cover.attachmentId}/content`)
      ).body(),
    ).toEqual(originalBytes);
    expect(
      await (
        await context.request.get(`/api/attachments/${instance.cover.attachmentId}/content`)
      ).body(),
    ).toEqual(originalBytes);
    await content.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Only this instance');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search templates', exact: true }).fill(title);
    await page.getByRole('button', { name: `Preview ${title}`, exact: true }).click();
    const preview = page.getByRole('region', { name: 'Template preview', exact: true });
    await expect(preview).toContainText('Only the reusable definition');
    await expect(preview).not.toContainText('Only this instance');
    for (const width of [1536, 360]) {
      await page.setViewportSize({ width, height: 844 });
      for (const kind of ['ul', 'ol']) {
        const markerSpace = await preview
          .locator(`.note-editor > ${kind} > li`)
          .first()
          .evaluate((item) => {
            const range = document.createRange();
            range.selectNodeContents(item.firstElementChild ?? item);
            const text = range.getBoundingClientRect(),
              list = item.parentElement!.getBoundingClientRect(),
              pane = item.closest('.version-document')!.getBoundingClientRect();
            return text.left - Math.max(list.left, pane.left);
          });
        expect(markerSpace).toBeGreaterThanOrEqual(16);
      }
      const quoteSpace = await preview
        .locator('.note-editor > blockquote > p')
        .evaluate(
          (paragraph) =>
            paragraph.getBoundingClientRect().left -
            paragraph.parentElement!.getBoundingClientRect().left,
        );
      expect(quoteSpace).toBeGreaterThanOrEqual(12);
    }
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page.getByRole('button', { name: 'Edit template', exact: true }).click();
    await expect(content).toContainText('Only the reusable definition');
    await expect(content).not.toContainText('Only this instance');
    await page.reload();
    await expect(content).toContainText('Only the reusable definition');
    await page.setViewportSize({ width: 360, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    expect(errors).toEqual([]);
  } finally {
    for (const id of roots)
      await context.request.delete(`/api/pages/${id}`, { headers }).catch(() => {});
    await context.close().catch(() => {});
  }
});
test('record templates keep independent defaults, create canonical records and require review after schema changes', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' }),
    workspace = await signIn(context),
    roots: string[] = [];
  const database = await (
    await context.request.post(`/api/workspaces/${workspace}/pages`, {
      headers,
      data: {
        title: `Template record database ${Date.now()}`,
        kind: 'database',
        visibility: 'private',
      },
    })
  ).json();
  roots.push(database.id);
  const fields = [
    { id: 'hours', name: 'Hours', type: 'number' },
    { id: 'phase', name: 'Phase', type: 'select', options: ['Draft', 'Ready'] },
    { id: 'related', name: 'Related', type: 'relation' },
  ];
  expect(
    (
      await context.request.put(`/api/databases/${database.id}/fields`, {
        headers,
        data: { revision: 1, fields },
      })
    ).ok(),
  ).toBe(true);
  const source = await (
    await context.request.post(`/api/databases/${database.id}/records`, {
      headers,
      data: { title: 'Original interview', values: { hours: 2, phase: 'Draft' } },
    })
  ).json();
  expect(
    (
      await context.request.patch(`/api/databases/${database.id}/records/${source.pageId}`, {
        headers,
        data: { revision: source.revision, values: { related: source.pageId } },
      })
    ).ok(),
  ).toBe(true);
  const page = await context.newPage(),
    title = `Interview template ${Date.now()}`;
  try {
    await page.goto(`/#${source.pageId}/document`);
    const content = page.getByRole('textbox', { name: 'Page content', exact: true });
    await expect(content).toBeVisible();
    await content.pressSequentially('Reusable interview notes');
    await page.getByRole('button', { name: 'Page actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Save as template', exact: true }).click();
    const save = page.getByRole('dialog', { name: 'Save as template', exact: true });
    await save.getByRole('textbox', { name: 'Template name', exact: true }).fill(title);
    await save.getByRole('button', { name: 'Save template', exact: true }).click();
    const defaults = page.getByRole('region', { name: 'Record template defaults', exact: true });
    await expect(
      defaults.getByRole('spinbutton', { name: 'Default Hours', exact: true }),
    ).toHaveValue('2');
    await expect(
      defaults.getByRole('button', { name: 'Default Related', exact: true }),
    ).toContainText('New record (self)');
    const templateId = page.url().split('#')[1].split('/')[0];
    roots.push(templateId);
    expect((await (await context.request.get(`/api/databases/${database.id}`)).json()).total).toBe(
      1,
    );
    await defaults.getByRole('spinbutton', { name: 'Default Hours', exact: true }).fill('5');
    await defaults.getByRole('spinbutton', { name: 'Default Hours', exact: true }).press('Enter');
    await expect
      .poll(
        async () =>
          (await (await context.request.get(`/api/pages/${templateId}`)).json()).templateValues
            .hours,
      )
      .toBe(5);
    await useDefinition(page, 'Template-created interview');
    await expect(
      page.getByRole('spinbutton', { name: 'Hours for Template-created interview', exact: true }),
    ).toHaveValue('5');
    await expect(content).toContainText('Reusable interview notes');
    const instanceId = page.url().split('#')[1].split('/')[0],
      snapshot = await (await context.request.get(`/api/databases/${database.id}`)).json();
    expect(snapshot.total).toBe(2);
    expect(
      snapshot.records.find((record: { pageId: string }) => record.pageId === instanceId).values
        .related,
    ).toBe(instanceId);
    expect(
      snapshot.records.find((record: { pageId: string }) => record.pageId === source.pageId).values
        .hours,
    ).toBe(2);
    expect(
      (
        await context.request.put(`/api/databases/${database.id}/fields`, {
          headers,
          data: {
            revision: snapshot.fieldsRevision,
            fields: fields.map((field) =>
              field.id === 'phase' ? { ...field, archived: true } : field,
            ),
          },
        })
      ).ok(),
    ).toBe(true);
    await page.goto(`/#${templateId}/document`);
    await expect(defaults.getByRole('alert')).toContainText('Some saved defaults need review');
    await expect(page.getByRole('button', { name: 'Use template', exact: true })).toBeDisabled();
    await defaults.getByRole('button', { name: 'Reset invalid defaults', exact: true }).click();
    await expect(
      defaults.getByText('Some saved defaults need review', { exact: true }),
    ).toBeHidden();
    expect(
      (await (await context.request.get(`/api/pages/${templateId}`)).json()).templateValues.phase,
    ).toBeUndefined();
    await expect(page.getByRole('button', { name: 'Use template', exact: true })).toBeEnabled();
    await page.goto(`/#${database.id}/database`);
    await page
      .locator('.table-actions')
      .getByRole('button', { name: 'Record templates', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `Preview ${title}`, exact: true })).toBeVisible();
  } finally {
    for (const id of roots)
      await context.request.delete(`/api/pages/${id}`, { headers }).catch(() => {});
    await context.close().catch(() => {});
  }
});
test('an unknown save result survives reload, stays account-scoped and retries without another template', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' }),
    workspace = await signIn(context);
  const source = await (
    await context.request.post(`/api/workspaces/${workspace}/pages`, {
      headers,
      data: { title: `Unknown template source ${Date.now()}`, visibility: 'private' },
    })
  ).json();
  const page = await context.newPage(),
    title = `Private pending template ${Date.now()}`,
    requests: string[] = [];
  let first = true,
    templateId = '';
  await page.route(`**/api/pages/${source.id}/templates`, async (route) => {
    requests.push(route.request().postDataJSON().requestId);
    const response = await route.fetch();
    if (first) {
      first = false;
      templateId = (await response.json()).id;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'UNAVAILABLE',
          message: 'The copy result could not be confirmed. Retry the same command.',
        }),
      });
    } else await route.fulfill({ response });
  });
  try {
    await page.goto(`/#${source.id}/document`);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Page actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Save as template', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Save as template', exact: true });
    await dialog.getByRole('textbox', { name: 'Template name', exact: true }).fill(title);
    await dialog.getByRole('button', { name: 'Save template', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('could not be confirmed');
    await page.goto('/#/templates');
    await expect(
      page.getByRole('region', { name: 'Unconfirmed copies', exact: true }),
    ).toContainText(title);
    await signIn(context, 'amelia@note.test');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: 'Unconfirmed copies', exact: true }),
    ).toBeHidden();
    await signIn(context);
    await page.reload();
    await page
      .getByRole('region', { name: 'Unconfirmed copies', exact: true })
      .getByRole('button', { name: 'Retry', exact: true })
      .click();
    await expect(page.getByRole('textbox', { name: 'Page title', exact: true })).toHaveValue(title);
    expect(requests).toHaveLength(2);
    expect(requests[0]).toBe(requests[1]);
    const library = await (
      await context.request.get(
        `/api/workspaces/${workspace}/templates?q=${encodeURIComponent(title)}`,
      )
    ).json();
    expect(library.items.filter((item: { title: string }) => item.title === title)).toHaveLength(1);
  } finally {
    await context.request.delete(`/api/pages/${source.id}`, { headers }).catch(() => {});
    if (templateId)
      await context.request.delete(`/api/pages/${templateId}`, { headers }).catch(() => {});
    await context.close().catch(() => {});
  }
});
test('blank templates open directly for writing and duplicate as independent definitions', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await signIn(context);
  const page = await context.newPage(),
    roots: string[] = [],
    name = `Blank reusable template ${Date.now()}`;
  try {
    await page.goto('/#/templates');
    await page.getByRole('button', { name: 'New template', exact: true }).click();
    const title = page.getByRole('textbox', { name: 'Page title', exact: true });
    await expect(title).toBeFocused();
    await title.fill(name);
    await title.press('Enter');
    await page
      .getByRole('textbox', { name: 'Page content', exact: true })
      .pressSequentially('A fresh starting point.');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    const first = page.url().split('#')[1].split('/')[0];
    roots.push(first);
    await page.getByRole('button', { name: 'Page actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Duplicate template', exact: true }).click();
    await expect(title).toHaveValue(`${name} (copy)`);
    const second = page.url().split('#')[1].split('/')[0];
    roots.push(second);
    expect(second).not.toBe(first);
    const definition = await (await context.request.get(`/api/pages/${second}`)).json();
    expect(definition.templateRootId).toBe(second);
    await expect(page.getByRole('textbox', { name: 'Page content', exact: true })).toContainText(
      'A fresh starting point.',
    );
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search templates', exact: true }).fill(name);
    await expect(page.getByRole('button', { name: `Preview ${name}`, exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: `Preview ${name} (copy)`, exact: true }),
    ).toBeVisible();
  } finally {
    for (const id of roots)
      await context.request.delete(`/api/pages/${id}`, { headers }).catch(() => {});
    await context.close().catch(() => {});
  }
});
test('copying a closed page cannot silently omit its unsynchronized local draft', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' }),
    workspace = await signIn(context),
    roots: string[] = [];
  const source = await (
    await context.request.post(`/api/workspaces/${workspace}/pages`, {
      headers,
      data: { title: `Retained template source ${Date.now()}`, visibility: 'private' },
    })
  ).json();
  roots.push(source.id);
  const page = await context.newPage(),
    title = `Synchronized template ${Date.now()}`,
    posts: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith(`/api/pages/${source.id}/templates`) && request.method() === 'POST')
      posts.push(request.url());
  });
  try {
    await page.goto(`/#${source.id}/document`);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await context.setOffline(true);
    await page
      .getByRole('textbox', { name: 'Page content', exact: true })
      .pressSequentially('Important text written without a connection');
    await expect(page.locator('.save-status')).toHaveText('Saved locally');
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reload view', exact: true })).toBeVisible();
    await context.setOffline(false);
    await page.getByRole('button', { name: 'Reload view', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible();
    await page.getByRole('button', { name: `Actions for ${source.title}`, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Save as template', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Save as template', exact: true });
    await dialog.getByRole('textbox', { name: 'Template name', exact: true }).fill(title);
    await dialog.getByRole('button', { name: 'Save template', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('synchronize its local draft');
    expect(posts).toEqual([]);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: source.title, exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Page content', exact: true })).toContainText(
      'Important text written without a connection',
    );
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Page actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Save as template', exact: true }).click();
    await dialog.getByRole('textbox', { name: 'Template name', exact: true }).fill(title);
    await dialog.getByRole('button', { name: 'Save template', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Template definition', exact: true }),
    ).toBeVisible();
    roots.push(page.url().split('#')[1].split('/')[0]);
    await expect(page.getByRole('textbox', { name: 'Page content', exact: true })).toContainText(
      'Important text written without a connection',
    );
    expect(posts).toHaveLength(1);
  } finally {
    await context.setOffline(false).catch(() => {});
    for (const id of roots)
      await context.request.delete(`/api/pages/${id}`, { headers }).catch(() => {});
    await context.close().catch(() => {});
  }
});
test('database templates edit their owned record relations and instantiate a separate working database', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' }),
    workspace = await signIn(context),
    roots: string[] = [];
  const source = await (
    await context.request.post(`/api/workspaces/${workspace}/pages`, {
      headers,
      data: {
        title: `Source project tracker ${Date.now()}`,
        kind: 'database',
        visibility: 'private',
      },
    })
  ).json();
  roots.push(source.id);
  expect(
    (
      await context.request.put(`/api/databases/${source.id}/fields`, {
        headers,
        data: {
          revision: 1,
          fields: [
            { id: 'phase', name: 'Phase', type: 'select', options: ['Draft', 'Ready'] },
            { id: 'related', name: 'Related', type: 'relation' },
          ],
        },
      })
    ).ok(),
  ).toBe(true);
  for (const title of ['First project', 'Second project'])
    expect(
      (
        await context.request.post(`/api/databases/${source.id}/records`, {
          headers,
          data: { title, values: { phase: 'Draft' } },
        })
      ).ok(),
    ).toBe(true);
  const page = await context.newPage(),
    name = `Reusable project tracker ${Date.now()}`;
  try {
    await page.goto(`/#${source.id}/database`);
    await expect(
      page.getByRole('combobox', { name: 'Phase for First project', exact: true }),
    ).toHaveValue('Draft');
    await page.getByRole('button', { name: 'Page actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Save as template', exact: true }).click();
    const save = page.getByRole('dialog', { name: 'Save as template', exact: true });
    await save.getByRole('textbox', { name: 'Template name', exact: true }).fill(name);
    await save.getByRole('button', { name: 'Save template', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Template definition', exact: true }),
    ).toBeVisible();
    const templateId = page.url().split('#')[1].split('/')[0];
    roots.push(templateId);
    await page.getByRole('button', { name: 'Related for First project', exact: true }).click();
    const relation = page.getByRole('dialog', { name: 'Link a record', exact: true });
    await relation
      .getByRole('textbox', { name: 'Find a record', exact: true })
      .fill('Second project');
    await relation
      .getByRole('button', { name: 'Second project', exact: true })
      .filter({ hasText: name })
      .click();
    const definition = await (await context.request.get(`/api/databases/${templateId}`)).json(),
      second = definition.records.find(
        (record: { title: string }) => record.title === 'Second project',
      );
    await expect
      .poll(async () => {
        const result = await (await context.request.get(`/api/databases/${templateId}`)).json();
        return result.records.find((record: { title: string }) => record.title === 'First project')
          .values.related;
      })
      .toBe(second.pageId);
    await useDefinition(page, 'Working project tracker');
    await expect(page.getByRole('textbox', { name: 'Page title', exact: true })).toHaveValue(
      'Working project tracker',
    );
    const instanceId = page.url().split('#')[1].split('/')[0];
    roots.push(instanceId);
    const phase = page.getByRole('combobox', { name: 'Phase for First project', exact: true });
    await phase.selectOption('Ready');
    await expect
      .poll(async () => {
        const result = await (await context.request.get(`/api/databases/${instanceId}`)).json();
        return result.records.find((record: { title: string }) => record.title === 'First project')
          .values.phase;
      })
      .toBe('Ready');
    const instance = await (await context.request.get(`/api/databases/${instanceId}`)).json(),
      original = await (await context.request.get(`/api/databases/${source.id}`)).json();
    expect(
      instance.records.find((record: { title: string }) => record.title === 'First project').values
        .related,
    ).toBe(
      instance.records.find((record: { title: string }) => record.title === 'Second project')
        .pageId,
    );
    expect(
      original.records.find((record: { title: string }) => record.title === 'First project').values,
    ).toEqual({ phase: 'Draft' });
    expect(
      (await (await context.request.get(`/api/databases/${templateId}`)).json()).records.find(
        (record: { title: string }) => record.title === 'First project',
      ).values.phase,
    ).toBe('Draft');
  } finally {
    for (const id of roots)
      await context.request.delete(`/api/pages/${id}`, { headers }).catch(() => {});
    await context.close().catch(() => {});
  }
});
