import { test, expect } from '@playwright/test';

test('edits, transforms, reorders and duplicates real blocks with durable reload and mobile controls', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1000 },
  });
  await expect
    .poll(async () => {
      try {
        return (await context.request.get('/api/health')).status();
      } catch {
        return 0;
      }
    })
    .toBe(200);
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  const session = await (await context.request.get('/api/session')).json();
  const note = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Block workflow ${Date.now()}` },
      headers: { 'x-note-request': '1' },
    })
  ).json();
  const page = await context.newPage();
  await page.goto(`/#${note.id}/document`);
  await expect(page.locator('.save-status')).toHaveText('Saved');
  const content = page.getByRole('textbox', { name: 'Page content' });
  await content.pressSequentially('First block');
  await content.press('Enter');
  await content.pressSequentially('Second block');
  await expect(content.locator('[data-content-block]')).toHaveCount(2);
  const firstBounds = await content.locator('[data-content-block]').nth(0).boundingBox();
  const secondBounds = await content.locator('[data-content-block]').nth(1).boundingBox();
  expect(secondBounds!.y - (firstBounds!.y + firstBounds!.height)).toBeLessThanOrEqual(2);
  expect(
    await content
      .locator('[data-content-block]')
      .first()
      .evaluate((element) => getComputedStyle(element).borderTopWidth),
  ).toBe('0px');
  await content.locator('[data-content-block]').nth(1).click();
  await page.getByRole('button', { name: 'Block actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Move up', exact: true }).click();
  await expect(content.locator('[data-content-block]').first()).toHaveText('Second block');
  await page.getByRole('button', { name: 'Block actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Duplicate', exact: true }).click();
  await expect(content.locator('[data-content-block]')).toHaveCount(3);
  await page.getByRole('button', { name: 'Block actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Heading 2', exact: true }).click();
  await expect(content.locator('h2')).toHaveText('Second block');
  await page.getByRole('button', { name: 'Add a block', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Callout', exact: true }).click();
  await expect(content.locator('[data-callout]')).toHaveCount(1);
  await page.keyboard.type('A structured callout');
  await expect(content.locator('[data-callout]')).toContainText('A structured callout');
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await page.reload();
  await expect(content.locator('[data-callout]')).toContainText('A structured callout');
  await expect(content.locator('h2')).toHaveText('Second block');
  await content.locator('p.content-block').filter({ hasText: 'First block' }).hover();
  await page
    .getByRole('button', { name: 'Drag or open block actions', exact: true })
    .dragTo(content.locator('[data-content-block]').first(), { targetPosition: { x: 40, y: 1 } });
  await expect(content.locator('[data-content-block]').first()).toHaveText('First block');
  await page.setViewportSize({ width: 390, height: 844 });
  await content.locator('h2').click();
  await expect(page.getByRole('button', { name: 'Block actions', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.request.delete(`/api/pages/${note.id}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
