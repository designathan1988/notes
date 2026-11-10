import { selectOption } from './select.js';
import { APP_ORIGIN } from './origin.js';
import { expect, test, type BrowserContext } from '@playwright/test';

const headers = { 'x-note-request': '1' };
async function createWritingPage(context: BrowserContext) {
  const signIn = await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
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
    baseURL: APP_ORIGIN,
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
    // Header controls must have separate hit areas, even with a page title and save state.
    const headerItems = [
      page.getByRole('button', { name: 'Open navigation', exact: true }),
      page.locator('.topbar > .breadcrumb'),
      tabs,
      page.getByRole('button', { name: 'Page actions', exact: true }),
    ];
    const boxes = await Promise.all(headerItems.map((item) => item.boundingBox()));
    for (let index = 1; index < boxes.length; index++) {
      expect(boxes[index - 1]).not.toBeNull();
      expect(boxes[index]).not.toBeNull();
      expect(boxes[index - 1]!.x + boxes[index - 1]!.width).toBeLessThanOrEqual(
        boxes[index]!.x + 1,
      );
    }
    await expect(page.locator('.mobile-save-label')).toHaveText('Saved');
    await expect(page.locator('.save-status')).toBeHidden();
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
    baseURL: APP_ORIGIN,
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

test('the page explorer filters and sorts real pages with compact readable locations on desktop and mobile', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  const parent = await createWritingPage(context),
    suffix = crypto.randomUUID();
  const children = [];
  for (const name of ['Alpha', 'Zulu']) {
    const response = await context.request.post(`/api/workspaces/${parent.workspaceId}/pages`, {
      headers,
      data: { title: `${name} ${suffix}`, parentId: parent.id },
    });
    expect(response.ok()).toBe(true);
    children.push(await response.json());
  }
  const page = await context.newPage();
  try {
    await page.goto(`/#${parent.id}/document`);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'All pages', exact: true }).click();
    for (const width of [1487, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const catalog = page.getByRole('region', { name: 'All pages', exact: true });
      await catalog.getByRole('textbox', { name: 'Search pages', exact: true }).fill(suffix);
      await selectOption(
        catalog.getByRole('combobox', { name: 'Sort pages', exact: true }),
        'title:asc',
      );
      const rows = catalog.locator('.page-index-list > button');
      await expect(rows).toHaveCount(2);
      await expect(rows.first()).toContainText('Alpha');
      await expect(rows.first().locator('.explorer-location')).toHaveText(parent.title);
      const icon = await catalog.locator('.explorer-search svg').boundingBox(),
        input = await catalog
          .getByRole('textbox', { name: 'Search pages', exact: true })
          .boundingBox();
      expect(Math.abs(icon!.y + icon!.height / 2 - input!.y - input!.height / 2)).toBeLessThan(5);
      if (width === 390) {
        const name = await rows.first().locator('.explorer-name').boundingBox(),
          location = await rows.first().locator('.explorer-location').boundingBox();
        expect(Math.abs(name!.x - location!.x)).toBeLessThan(2);
      }
      await selectOption(
        catalog.getByRole('combobox', { name: 'Sort pages', exact: true }),
        'title:desc',
      );
      await expect(rows.first()).toContainText('Zulu');
    }
    await page.getByRole('button', { name: `${children[0].title} page`, exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Page title', exact: true })).toHaveValue(
      children[0].title,
    );
  } finally {
    await context.request.delete(`/api/pages/${parent.id}`, { headers });
    await context.close();
  }
});
