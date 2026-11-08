import { test, expect, type BrowserContext } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';
test.beforeEach(async ({ request }) => {
  await expect
    .poll(
      async () => {
        try {
          return (await request.get('/api/health')).status();
        } catch {
          return 0;
        }
      },
      { timeout: 20000 },
    )
    .toBe(200);
});
async function signIn(context: BrowserContext, email = 'jonathan@note.test') {
  const response = await context.request.post('/api/auth/sign-in/email', {
    data: { email, password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  expect(response.ok()).toBeTruthy();
}
test('two independent identities edit, persist, and reopen one shared document', async ({
  browser,
}) => {
  const first = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  const second = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await signIn(first);
  await signIn(second, 'amelia@note.test');
  const session = await (await first.request.get('/api/session')).json();
  const response = await first.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    data: { title: `Collaboration check ${Date.now()}` },
    headers: { 'x-note-request': '1' },
  });
  expect(response.ok()).toBeTruthy();
  const page = await response.json();
  const a = await first.newPage();
  const b = await second.newPage();
  try {
    await Promise.all([a.goto(`/#${page.id}/document`), b.goto(`/#${page.id}/document`)]);
    await expect(a.locator('.save-status')).toHaveText('Saved');
    await expect(b.locator('.save-status')).toHaveText('Saved');
    const one = a.getByRole('textbox', { name: 'Page content' });
    const two = b.getByRole('textbox', { name: 'Page content' });
    await one.click();
    await one.press('Control+End');
    await one.press('Enter');
    await expect(two.locator('p')).toHaveCount(2);
    await one.click();
    await a.keyboard.press('Control+Home');
    await two.click();
    await b.keyboard.press('Control+End');
    // Keep each explicitly positioned caret: typing through the root locator can
    // refocus a background contenteditable and reset it to the first paragraph.
    const caretParagraph = (root: Element) => {
      const anchor = window.getSelection()?.anchorNode;
      const element = anchor instanceof Element ? anchor : anchor?.parentElement;
      return [...root.querySelectorAll('p')].indexOf(element?.closest('p') as HTMLParagraphElement);
    };
    expect(await one.evaluate(caretParagraph)).toBe(0);
    expect(await two.evaluate(caretParagraph)).toBe(1);
    await Promise.all([a.keyboard.type('Alpha '), b.keyboard.type('Beta ')]);
    await expect(one).toContainText('Alpha');
    await expect(one).toContainText('Beta');
    await expect(two).toContainText('Alpha');
    await expect(two).toContainText('Beta');
    await expect(a.locator('.save-status')).toHaveText('Saved');
    await expect(b.locator('.save-status')).toHaveText('Saved');
    await a.reload();
    await expect(a.getByRole('textbox', { name: 'Page content' })).toContainText('Alpha');
    await expect(a.getByRole('textbox', { name: 'Page content' })).toContainText('Beta');
  } finally {
    await first.request
      .delete(`/api/pages/${page.id}`, { headers: { 'x-note-request': '1' } })
      .catch(() => {});
    await first.close().catch(() => {});
    await second.close().catch(() => {});
  }
});
test('pastes rich content safely and persists original source and uploaded image bytes', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await signIn(context);
  const session = await (await context.request.get('/api/session')).json();
  const created = await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    data: { title: `Capture check ${Date.now()}` },
    headers: { 'x-note-request': '1' },
  });
  const note = await created.json();
  const page = await context.newPage();
  await page.goto(`/#${note.id}/document`);
  await expect(page.locator('.save-status')).toHaveText('Saved');
  const original =
    '<h2>Captured heading</h2><p><strong>Keep this formatting</strong></p><button onclick="window.pastedScriptExecuted=true">Interactive source</button>';
  await page.getByRole('textbox', { name: 'Page content' }).evaluate((element, html) => {
    const data = new DataTransfer();
    data.setData('text/html', html);
    data.setData('text/plain', 'Captured heading');
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, original);
  await expect(page.getByRole('textbox', { name: 'Page content' })).toContainText(
    'Keep this formatting',
  );
  await expect(page.locator('.attachment-block a')).toHaveText('Original pasted content.html');
  expect(await page.evaluate(() => 'pastedScriptExecuted' in window)).toBe(false);
  const originalUrl = await page.locator('.attachment-block a').getAttribute('href');
  const download = await context.request.get(originalUrl!);
  expect(await download.text()).toBe(original);
  expect(download.headers()['content-disposition']).toContain('attachment');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  );
  let uploadAttempts = 0;
  let attachmentReservations = 0;
  context.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith(`/pages/${note.id}/attachments`))
      attachmentReservations++;
  });
  await context.route('**/api/attachments/*/content', async (route) => {
    if (route.request().method() === 'PUT' && uploadAttempts++ === 0)
      await route.fulfill({ status: 503, json: { message: 'Temporary upload interruption' } });
    else await route.continue();
  });
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.upload-failure')).toContainText('sample.png');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.attachment-block img')).toBeVisible();
  expect(attachmentReservations).toBe(1);
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await page.reload();
  await expect(page.locator('.attachment-block img')).toBeVisible();
  const imageUrl = await page.locator('.attachment-block img').getAttribute('src');
  expect((await (await context.request.get(imageUrl!)).body()).equals(png)).toBe(true);
  await context.unroute('**/api/attachments/*/content');
  let interrupted = false;
  await context.route('**/api/attachments/*/content', async (route) => {
    if (route.request().method() === 'PUT' && !interrupted) {
      interrupted = true;
      await route.fulfill({ status: 503, json: { message: 'Interrupted first clipboard file' } });
    } else await route.continue();
  });
  await page.getByRole('textbox', { name: 'Page content' }).evaluate((element) => {
    const data = new DataTransfer();
    data.items.add(new File(['first'], 'clipboard-first.txt', { type: 'text/plain' }));
    data.items.add(new File(['second'], 'clipboard-second.txt', { type: 'text/plain' }));
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });
  await expect(page.locator('.upload-failure')).toContainText('clipboard-first.txt');
  await expect(
    page.locator('.attachment-block a').filter({ hasText: 'clipboard-second.txt' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(
    page.locator('.attachment-block a').filter({ hasText: 'clipboard-first.txt' }),
  ).toBeVisible();
  await context.request.delete(`/api/pages/${note.id}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
test('creates and edits a structured record, finds its body, and follows its graph connection', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await signIn(context);
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Databases', exact: true }).click();
  await page
    .getByRole('region', { name: 'Databases', exact: true })
    .getByRole('button', { name: 'Research database', exact: true })
    .click();
  await expect(page.getByRole('table', { name: 'Database records' })).toBeVisible();
  await page.locator('.table-actions').getByRole('button', { name: 'New record' }).click();
  const title = `Discovery check ${Date.now()}`;
  await page.getByLabel('New record name', { exact: true }).fill(title);
  await page.getByLabel('New record name', { exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Close record', exact: true }).click();
  await page.getByLabel(`Status for ${title}`, { exact: true }).selectOption('Active');
  await expect(page.getByLabel(`Status for ${title}`, { exact: true })).toHaveValue('Active');
  await page.getByRole('button', { name: `Open ${title}`, exact: true }).click();
  await expect(page.getByLabel('Page title', { exact: true })).toHaveValue(title);
  await expect(page.locator('.save-status')).toHaveText('Saved');
  const id = page.url().split('#')[1].split('/')[0];
  await page
    .getByRole('textbox', { name: 'Page content' })
    .pressSequentially('uniquediscoveryphrase ');
  await page.getByRole('button', { name: 'Insert link', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Product direction');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Product direction', exact: true })
    .click();
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await page.getByRole('button', { name: 'Search anything Ctrl K' }).click();
  await page.getByLabel('Search query', { exact: true }).fill('uniquediscoveryphrase');
  await expect(page.getByRole('option').filter({ hasText: title })).toBeVisible();
  await page.getByRole('option').filter({ hasText: title }).click();
  const session = await (await context.request.get('/api/session')).json();
  await expect
    .poll(async () => {
      const graph = await (
        await context.request.get(`/api/workspaces/${session.workspaces[0].id}/graph`)
      ).json();
      return graph.edges.some((edge: { source: string }) => edge.source === id);
    })
    .toBe(true);
  await page.getByRole('button', { name: 'Knowledge graph', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Workspace knowledge graph' })).toBeVisible();
  await page.getByRole('link', { name: 'Open Product direction', exact: true }).click();
  await expect(page.getByLabel('Page title', { exact: true })).toHaveValue('Product direction');
  await context.request.delete(`/api/pages/${id}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
test('imports a versioned workspace ZIP through settings and downloads an export', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await signIn(context);
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  const title = `Imported fixture ${Date.now()}`;
  const bytes = zipSync({
    'manifest.json': strToU8(
      JSON.stringify({
        schemaVersion: 1,
        workspace: { name: 'Fixture' },
        pages: [
          {
            id: 'fixture-page',
            parentId: null,
            title,
            description: 'A portable document',
            kind: 'document',
            visibility: 'workspace',
            content: {
              type: 'doc',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Portable fixture body' }] },
              ],
            },
          },
        ],
        databases: [],
        records: [],
        views: [],
        attachments: [],
      }),
    ),
  });
  await page.getByLabel('Choose workspace archive', { exact: true }).setInputFiles({
    name: 'fixture.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(bytes),
  });
  await expect(page.getByText('Import complete', { exact: true })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export workspace ZIP', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('note-workspace.zip');
  expect(await download.failure()).toBe(null);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.locator('.page-tree').getByRole('button', { name: title, exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Page content' })).toContainText(
    'Portable fixture body',
  );
  const id = page.url().split('#')[1].split('/')[0];
  await context.request.delete(`/api/pages/${id}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
test('recipient verifies an invitation and loses access when membership is revoked', async ({
  browser,
}) => {
  const owner = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await signIn(owner);
  const session = await (await owner.request.get('/api/session')).json();
  const workspace = session.workspaces[0].id;
  const email = `invite-${Date.now()}@note.test`;
  const response = await owner.request.post(`/api/workspaces/${workspace}/invitations`, {
    headers: { 'x-note-request': '1' },
    data: { email, role: 'viewer' },
  });
  expect(response.ok()).toBeTruthy();
  const invitation = await response.json();
  const recipient = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  const signup = await recipient.request.post('/api/auth/sign-up/email', {
    headers: { origin: 'http://127.0.0.1:5173' },
    data: { name: 'Invitation fixture', email, password: 'Note-local-demo-2026' },
  });
  expect(signup.ok()).toBeTruthy();
  const identity = (await signup.json()).user.id;
  const page = await recipient.newPage();
  await page.goto(`/?invite=${invitation.id}`);
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await page.getByRole('link', { name: 'Verify your email for Note', exact: true }).click();
  await page.getByRole('button', { name: 'Accept invitation', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Read only');
  await expect(page.getByRole('textbox', { name: 'Page content' })).toHaveAttribute(
    'contenteditable',
    'false',
  );
  const removed = await owner.request.patch(`/api/workspaces/${workspace}/members/${identity}`, {
    headers: { 'x-note-request': '1' },
    data: { role: null },
  });
  expect(removed.ok()).toBeTruthy();
  await expect(page.getByRole('textbox', { name: 'Page content' })).toHaveCount(0);
  await recipient.close();
  await owner.close();
});
test('keeps disconnected edits in local recovery and synchronizes them after reconnect', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await signIn(context);
  const session = await (await context.request.get('/api/session')).json();
  const created = await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    headers: { 'x-note-request': '1' },
    data: { title: `Recovery check ${Date.now()}` },
  });
  const note = await created.json();
  const page = await context.newPage();
  await page.goto(`/#${note.id}/document`);
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await context.setOffline(true);
  await page
    .getByRole('textbox', { name: 'Page content' })
    .pressSequentially('Recovered while disconnected');
  await expect(page.locator('.save-status')).toHaveText('Saved locally');
  await context.setOffline(false);
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Page content' })).toContainText(
    'Recovered while disconnected',
  );
  await context.request.delete(`/api/pages/${note.id}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
