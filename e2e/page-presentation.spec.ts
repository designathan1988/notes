import { APP_ORIGIN } from './origin.js';
import { test, expect } from './test.js';

test('page icons, uploaded covers, repositioning and tags persist and drive search', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json(),
    workspace = session.workspaces[0].id;
  const note = await (
    await context.request.post(`/api/workspaces/${workspace}/pages`, {
      data: { title: `Page identity ${Date.now()}` },
      headers: { 'x-note-request': '1' },
    })
  ).json();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  try {
    await page.goto(`/#${note.id}/document`);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Customize page', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Add icon', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Compass', exact: true }).click();
    await expect(page.locator('.page-icon')).toHaveText('🧭');
    await page.getByRole('button', { name: 'Customize page', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Add cover', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Sand', exact: true }).click();
    await expect(page.locator('.page-cover')).toBeVisible();
    await page.getByRole('button', { name: 'Change cover', exact: true }).click();
    await page.getByLabel('Upload cover image').setInputFiles({
      name: 'cover.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await expect(page.getByRole('img', { name: 'Page cover' })).toBeVisible();
    await page.getByRole('button', { name: 'Reposition cover', exact: true }).click();
    const cover = await page.locator('.page-cover').boundingBox();
    if (!cover) throw new Error('Cover was not rendered');
    await page.mouse.move(cover.x + cover.width / 2, cover.y + cover.height / 2);
    await page.mouse.down();
    await page.mouse.move(cover.x + cover.width / 2, cover.y + cover.height / 2 - 35, { steps: 8 });
    await page.mouse.up();
    await page.getByRole('button', { name: 'Save cover position', exact: true }).click();
    const persisted = await (await context.request.get(`/api/pages/${note.id}`)).json();
    expect(persisted.cover.positionY).not.toBe(50);
    await page.getByRole('button', { name: 'Customize page', exact: true }).click();

    await page.getByRole('menuitem', { name: 'Page properties', exact: true }).click();
    await page.getByRole('button', { name: 'Add tag', exact: true }).click();
    await page.getByRole('textbox', { name: 'New tag' }).fill('Field Research');
    await page.getByRole('textbox', { name: 'New tag' }).press('Enter');
    await expect(
      page.getByRole('button', { name: 'Search tag field research', exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator('.page-icon')).toHaveText('🧭');
    await expect(page.getByRole('img', { name: 'Page cover' })).toBeVisible();
    await page.getByRole('button', { name: 'Search tag field research', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Tag filter' })).toHaveValue('field research');
    await expect(page.getByRole('option').filter({ hasText: note.title })).toBeVisible();
    await page.getByRole('textbox', { name: 'Tag filter' }).fill('absent-exact-tag');
    await expect(page.getByRole('option').filter({ hasText: note.title })).toBeHidden();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Close dialog', exact: true })
      .click();
    await page.setViewportSize({ width: 360, height: 844 });
    const icon = await page.locator('.page-icon').boundingBox(),
      title = await page.getByRole('textbox', { name: 'Page title', exact: true }).boundingBox();
    expect(icon!.x + icon!.width).toBeLessThan(title!.x);
    expect(icon!.width).toBeGreaterThanOrEqual(
      await page
        .locator('.page-icon')
        .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
    );
    await page.getByRole('button', { name: 'Customize page', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Change icon', exact: true }).click();
    const menu = page.getByRole('menu', { name: 'Choose page icon' }),
      box = await menu.boundingBox();
    for (const button of await menu.locator('button,input').all()) {
      const item = await button.boundingBox();
      expect(item!.x + item!.width).toBeLessThanOrEqual(box!.x + box!.width);
    }
    expect(errors).toEqual([]);
  } finally {
    await context.request
      .delete(`/api/pages/${note.id}`, { headers: { 'x-note-request': '1' } })
      .catch(() => {});
    await context.close();
  }
});
