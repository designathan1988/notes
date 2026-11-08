import { expect, test, type BrowserContext } from '@playwright/test';

const headers = { 'x-note-request': '1' };
async function createWritingPage(context: BrowserContext) {
  const signIn = await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  expect(signIn.ok()).toBe(true);
  const session = await (await context.request.get('/api/session')).json();
  const response = await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    headers,
    data: {
      title: 'A focused writing space',
      description: 'Keep the work in view.',
      visibility: 'private',
      requestId: crypto.randomUUID(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Writing starts with the content.' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Useful tools stay within reach.' }],
          },
        ],
      },
    },
  });
  expect(response.ok()).toBe(true);
  return response.json();
}

test('mobile reading prioritizes content while editing, customization and working tabs remain usable', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const source = await createWritingPage(context),
    page = await context.newPage();
  try {
    await page.goto(`/#${source.id}/document`);
    const body = page.getByRole('textbox', { name: 'Page content', exact: true });
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await expect(body).toContainText('Writing starts with the content.');
    const first = await body.locator('p').first().boundingBox();
    expect(first, 'The first paragraph is rendered').not.toBeNull();
    expect(first!.y, 'Reading begins near the title, without an empty metadata form').toBeLessThan(
      280,
    );
    await expect(
      page.getByRole('toolbar', { name: 'Document formatting', exact: true }),
    ).toBeHidden();

    const tabs = page.getByRole('button', { name: 'Open tabs', exact: true });
    await expect(tabs).toBeVisible();
    const target = await tabs.boundingBox();
    expect(target!.width).toBeGreaterThanOrEqual(44);
    expect(target!.height).toBeGreaterThanOrEqual(44);
    await tabs.click();
    await expect(page.getByRole('tablist', { name: 'Open pages', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: source.title, exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('Escape');
    await expect(tabs).toBeFocused();

    await body.locator('p').first().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' A useful continuation.');
    await expect(body).toContainText('Writing starts with the content. A useful continuation.');
    await expect(
      page.getByRole('toolbar', { name: 'Document formatting', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.save-status')).toHaveText('Saved');

    await page.getByRole('button', { name: 'Customize page', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Add icon', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Compass', exact: true }).click();
    await expect(page.locator('.page-icon')).toHaveText('🧭');
    const properties = page.getByRole('button', { name: 'Page properties', exact: true });
    await page.getByRole('button', { name: 'Customize page', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Page properties', exact: true }).click();
    await expect(properties).toHaveAttribute('aria-expanded', 'true');
    await expect(
      page.getByRole('button', { name: 'Add page property', exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator('.page-icon')).toHaveText('🧭');
    await expect(body).toContainText('Writing starts with the content. A useful continuation.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  } finally {
    await context.request.delete(`/api/pages/${source.id}`, { headers }).catch(() => {});
    await context.close();
  }
});

test('desktop tools have their own compact navigation without displacing the page tree', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1487, height: 1058 },
  });
  const source = await createWritingPage(context),
    page = await context.newPage();
  try {
    await page.goto(`/#${source.id}/document`);
    await expect(page.getByRole('textbox', { name: 'Page content', exact: true })).toBeVisible();
    const tools = page.getByRole('navigation', { name: 'Workspace tools', exact: true });
    await expect(tools).toBeVisible();
    expect((await tools.boundingBox())!.width).toBeLessThan(270);
    expect((await page.locator('.topbar').boundingBox())!.height).toBeLessThanOrEqual(50);
    expect((await page.locator('.document-scroll').boundingBox())!.width).toBeGreaterThan(1200);
    expect((await page.locator('.sidebar-scroll').boundingBox())!.height).toBeGreaterThan(400);
    for (const name of ['Databases', 'Templates', 'Canvases', 'All pages']) {
      await tools.getByRole('button', { name, exact: true }).click();
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
      await expect(tools.getByRole('button', { name, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
  } finally {
    await context.request.delete(`/api/pages/${source.id}`, { headers }).catch(() => {});
    await context.close();
  }
});
