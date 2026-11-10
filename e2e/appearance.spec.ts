import { APP_ORIGIN } from './origin.js';
import { test, expect, type BrowserContext } from './test.js';
const headers = { 'x-note-request': '1' };
async function login(context: BrowserContext, email = 'jonathan@note.test') {
  expect(
    (
      await context.request.post('/api/auth/sign-in/email', {
        data: { email, password: 'Note-local-demo-2026' },
        headers: { origin: APP_ORIGIN },
      })
    ).ok(),
  ).toBe(true);
}
test('personal and page appearance preview, persist, recover a failed write, and reset independently', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await login(context);
  const original = await (await context.request.get('/api/preferences/appearance')).json();
  expect(
    (
      await context.request.patch('/api/preferences/appearance', {
        headers,
        data: { revision: original.revision, overrides: {} },
      })
    ).ok(),
  ).toBe(true);
  const session = await (await context.request.get('/api/session')).json();
  const note = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      headers,
      data: {
        title: 'Appearance behavior',
        requestId: crypto.randomUUID(),
        content: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'The content owns the stage.' }] },
          ],
        },
      },
    })
  ).json();
  expect(note.id).toBeTruthy();
  const page = await context.newPage();
  try {
    await page.goto(`/#${note.id}/document`);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Account menu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Appearance', exact: true }).click();
    const panel = page.getByRole('complementary', { name: 'Appearance', exact: true });
    await panel.getByLabel('Interface font', { exact: true }).fill('Verdana');
    await panel.getByLabel('Body font', { exact: true }).fill('Georgia');
    await panel.getByLabel('Headings font', { exact: true }).fill('Arial');
    await panel.getByLabel('Code font', { exact: true }).fill('Courier New');
    await panel.getByLabel('Background color', { exact: true }).fill('#fafafa');
    await panel.getByLabel('Text color', { exact: true }).fill('#303030');
    await panel.getByLabel('Body size', { exact: true }).fill('19');
    await expect(panel.locator('footer')).toHaveText('Changes save automatically.');
    await expect(page.getByRole('textbox', { name: 'Page content', exact: true })).toHaveCSS(
      'font-family',
      /Georgia/,
    );
    await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCSS(
      'font-family',
      /Verdana/,
    );
    await expect(page.getByRole('textbox', { name: 'Page content', exact: true })).toHaveCSS(
      'font-size',
      '19px',
    );
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Page content', exact: true })).toHaveCSS(
      'font-family',
      /Georgia/,
    );

    await page.getByRole('button', { name: 'Customize page', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Fonts and style', exact: true }).click();
    await panel.getByLabel('Body font', { exact: true }).fill('Tahoma');
    await panel.getByText('Custom CSS', { exact: true }).click();
    await panel
      .getByRole('textbox', { name: 'Page custom CSS', exact: true })
      .fill('.page-title { font-style: italic; }');
    await expect(panel.locator('footer')).toHaveText('Changes save automatically.');
    await expect(page.getByLabel('Page title', { exact: true })).toHaveCSS('font-style', 'italic');
    await expect(page.getByRole('textbox', { name: 'Page content', exact: true })).toHaveCSS(
      'font-family',
      /Tahoma/,
    );
    await panel.getByRole('button', { name: 'App', exact: true }).click();
    await page.route('**/api/preferences/appearance', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Appearance test connection failure' }),
          })
        : route.continue(),
    );
    await panel.getByLabel('Accent color', { exact: true }).fill('#6b4c9a');
    await expect(panel.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
    await page.unroute('**/api/preferences/appearance');
    await panel.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(panel.locator('footer')).toHaveText('Changes save automatically.');
    expect(
      (await (await context.request.get('/api/preferences/appearance')).json()).overrides.accent,
    ).toBe('#6b4c9a');
    // Reset can be invoked even when custom CSS hides the entire interface.
    await expect(panel.getByLabel('App custom CSS', { exact: true })).toBeVisible();
    await panel
      .getByLabel('App custom CSS', { exact: true })
      .fill('.app-shell { visibility: hidden; }');
    await expect(page.locator('.app-shell')).toBeHidden();
    await page.keyboard.press('Control+Alt+Shift+Backspace');
    await expect(page.locator('.app-shell')).toBeVisible();
    await expect(panel.locator('footer')).toHaveText('Changes save automatically.');
    expect(
      (await (await context.request.get('/api/preferences/appearance')).json()).overrides,
    ).toEqual({});
    await expect(page.getByRole('textbox', { name: 'Page content', exact: true })).toHaveCSS(
      'font-family',
      /Tahoma/,
    );
    await panel.getByRole('button', { name: 'This page', exact: true }).click();
    await panel.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(panel.locator('footer')).toHaveText('Changes save automatically.');
    await expect(page.getByLabel('Page title', { exact: true })).toHaveCSS('font-style', 'normal');
  } finally {
    const current = await (await context.request.get('/api/preferences/appearance')).json();
    await context.request.patch('/api/preferences/appearance', {
      headers,
      data: { revision: current.revision, overrides: original.overrides },
    });
    await context.request.delete(`/api/pages/${note.id}`, { headers });
    await context.close();
  }
});

test('opening a quote-first document does not create an invalid initial text selection or change its body', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await login(context);
  const session = await (await context.request.get('/api/session')).json();
  const note = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      headers,
      data: {
        title: 'Quote-first document',
        requestId: crypto.randomUUID(),
        content: {
          type: 'doc',
          content: [
            {
              type: 'blockquote',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'One original quote.' }] },
              ],
            },
            { type: 'paragraph', content: [{ type: 'text', text: 'One original paragraph.' }] },
          ],
        },
      },
    })
  ).json();
  expect(note.id).toBeTruthy();
  const page = await context.newPage(),
    warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
  });
  try {
    await page.goto(`/#${note.id}/document`);
    const body = page.getByRole('textbox', { name: 'Page content', exact: true });
    await expect(body.locator('blockquote')).toHaveCount(1);
    await expect(body.locator('p')).toHaveCount(2);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    expect(warnings.filter((message) => message.includes('TextSelection endpoint'))).toEqual([]);
    await body.locator('p').last().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' A durable edit.');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.reload();
    await expect(body).toContainText('One original paragraph. A durable edit.');
    await expect(body.locator('blockquote')).toHaveCount(1);
    await expect(body.locator('p')).toHaveCount(2);
  } finally {
    await context.request.delete(`/api/pages/${note.id}`, { headers });
    await context.close();
  }
});
