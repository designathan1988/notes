import { APP_ORIGIN } from './origin.js';
import { test, expect } from './test.js';

const headers = { 'x-note-request': '1' };

// On a desktop nothing floats over the text: the + and ⋮⋮ handle sits in the margin beside the
// line being edited, and opening its menus must not move the caret anywhere else.
test('the block handle sits beside the edited line and its menus give the caret back', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: APP_ORIGIN,
    viewport: { width: 1440, height: 900 },
  });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json();
  const note = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Block handle ${Date.now()}` },
      headers,
    })
  ).json();
  try {
    const page = await context.newPage();
    await page.goto(`/#${note.id}/document`);
    const content = page.getByRole('textbox', { name: 'Page content', exact: true });
    await content.click();
    for (const line of ['First line', 'Second line', 'Third line', 'Fourth line'])
      await page.keyboard.type(`${line}\n`);
    await page.keyboard.type('Edited line');
    await expect(
      page.getByRole('toolbar', { name: 'Document formatting', exact: true }),
    ).toBeHidden();

    const gutter = page.locator('.block-gutter');
    const edited = content.locator('p').nth(4);
    const handle = (await gutter.boundingBox())!,
      line = (await edited.boundingBox())!;
    // Beside the edited line, in the margin: it covers no text.
    expect(Math.abs(handle.y + handle.height / 2 - (line.y + line.height / 2))).toBeLessThan(8);
    expect(handle.x + handle.width).toBeLessThanOrEqual(line.x + 1);

    await gutter.getByRole('button', { name: 'Drag or open block actions', exact: true }).click();
    await expect(page.getByRole('menu', { name: 'Block actions' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(content).toBeFocused();
    // The caret came back to the end of the edited line, not to the start of the page.
    await page.keyboard.type('!');
    await expect(edited).toHaveText('Edited line!');
    await expect(content.locator('p').first()).toHaveText('First line');

    await gutter.getByRole('button', { name: 'Insert block here', exact: true }).click();
    await expect(page.getByRole('menu', { name: 'Add a block' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(content).toBeFocused();
    await page.keyboard.type('Next');
    await expect(content.locator('p').nth(5)).toHaveText('Next');
    await expect(edited).toHaveText('Edited line!');
  } finally {
    await context.request.delete(`/api/pages/${note.id}`, { headers }).catch(() => {});
    await context.close();
  }
});
