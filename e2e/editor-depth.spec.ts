import { APP_ORIGIN } from './origin.js';
import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

test('structured editing, contextual marks, literal find and templates survive reload', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json();
  const note = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Editor depth ${Date.now()}` },
      headers: { 'x-note-request': '1' },
    })
  ).json();
  const page = await context.newPage();
  await page.goto(`/#${note.id}/document`);
  const editor = page.getByRole('textbox', { name: 'Page content', exact: true });
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await editor.click();
  await page.keyboard.type('/');
  await page.getByRole('textbox', { name: 'Find block type' }).fill('Toggle');
  await page.keyboard.press('Enter');
  await expect(editor.locator('[data-toggle-title]')).toBeVisible();
  await page.keyboard.type('Open questions');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Alpha beta [a+b] alpha beta');
  await page.keyboard.press('Home');
  await page.keyboard.press('Control+Shift+ArrowRight');
  const contextual = page.getByRole('toolbar', { name: 'Selection formatting' });
  await expect(contextual).toBeVisible();
  await contextual.getByRole('button', { name: 'Highlight', exact: true }).click();
  await expect(editor.locator('mark')).toContainText('Alpha');
  await contextual.getByRole('button', { name: 'Link selected text', exact: true }).click();
  await page.getByPlaceholder('Search pages or https://…').fill('https://example.com/evidence');
  await page
    .getByRole('button', { name: 'Link to https://example.com/evidence', exact: true })
    .click();
  await expect(editor.locator('a[href="https://example.com/evidence"]')).toContainText('Alpha');
  await page.getByRole('button', { name: 'Collapse section', exact: true }).click();
  await expect(editor.locator('[data-toggle-content]')).toBeHidden();
  await page.getByRole('button', { name: 'Find in page', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find text', exact: true }).fill('[a+b]');
  await expect(page.getByRole('status', { name: 'Find results' })).toHaveText('1 of 1');
  await expect(editor.locator('.text-search-match.is-current')).toHaveText('[a+b]');
  await expect(editor.locator('[data-toggle-content]')).toBeVisible();
  await page.getByRole('textbox', { name: 'Replace with', exact: true }).fill('evidence');
  await page.getByRole('button', { name: 'Replace match', exact: true }).click();
  await page.getByRole('button', { name: 'Close find', exact: true }).click();
  await expect(editor.locator('[data-toggle-content]')).toBeHidden();
  await page.getByRole('button', { name: 'Expand section', exact: true }).click();
  await expect(editor).toContainText('Alpha beta evidence alpha beta');
  await page.getByRole('button', { name: 'Insert template', exact: true }).click();
  await page.getByRole('menuitem', { name: /Meeting notes/ }).click();
  await expect(editor).toContainText('Next steps');
  expect(
    await editor
      .getByRole('heading', { name: 'Context', exact: true })
      .evaluate((element) => element.previousElementSibling?.outerHTML),
  ).toContain('data-toggle-block');
  await expect(editor).toContainText('Alpha beta evidence alpha beta');
  await expect(page.getByRole('status', { name: 'Document statistics' })).toContainText('words');
  await page.getByRole('button', { name: 'Enter focus mode', exact: true }).click();
  await expect(page.locator('.app-shell')).toHaveClass(/focus-mode/);
  await page.getByRole('button', { name: 'Leave focus mode', exact: true }).click();
  await expect(page.locator('.app-shell')).not.toHaveClass(/focus-mode/);
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await page.reload();
  await expect(editor).toContainText('Alpha beta evidence alpha beta');
  await expect(editor).toContainText('Next steps');
  await expect(editor.locator('mark')).toContainText('Alpha');
  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('button', { name: 'Find in page', exact: true }).click();
    await page.getByRole('textbox', { name: 'Find text', exact: true }).fill('evidence');
    await expect(page.getByRole('status', { name: 'Find results' })).toHaveText('1 of 1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    if (process.env.NOTE_QA_OUTPUT) {
      await mkdir(process.env.NOTE_QA_OUTPUT, { recursive: true });
      await page.screenshot({
        path: resolve(process.env.NOTE_QA_OUTPUT, `editor-mobile-${width}.png`),
      });
    }
    await page.getByRole('button', { name: 'Close find', exact: true }).click();
  }
  await page.setViewportSize({ width: 1536, height: 1024 });
  if (process.env.NOTE_QA_OUTPUT)
    await page.screenshot({ path: resolve(process.env.NOTE_QA_OUTPUT, 'editor-desktop.png') });
  await context.request.delete(`/api/pages/${note.id}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});

test('pasting structured sections preserves their content and highlight without an extra original file', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json();
  const note = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Editor paste ${Date.now()}` },
      headers: { 'x-note-request': '1' },
    })
  ).json();
  const page = await context.newPage();
  await page.goto(`/#${note.id}/document`);
  const editor = page.getByRole('textbox', { name: 'Page content', exact: true });
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await editor.click();
  await editor.evaluate((element) => {
    const data = new DataTransfer();
    data.setData(
      'text/html',
      '<section data-toggle-block data-collapsed="false"><div data-toggle-title>Evidence</div><div data-toggle-content><p>Alpha <strong>beta</strong> <mark>highlighted</mark> alpha beta</p></div></section>',
    );
    data.setData('text/plain', 'Evidence\nAlpha beta highlighted alpha beta');
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });
  await expect(editor.locator('[data-toggle-title]')).toHaveText('Evidence');
  await expect(editor.locator('mark')).toHaveText('highlighted');
  await expect(editor.locator('figure[data-attachment]')).toHaveCount(0);
  await page.keyboard.press('Control+Alt+f');
  await page.getByRole('textbox', { name: 'Find text', exact: true }).fill('alpha beta');
  await expect(page.getByRole('status', { name: 'Find results' })).toHaveText('1 of 2');
  await page.getByRole('textbox', { name: 'Replace with', exact: true }).fill('<literal>');
  await page.getByRole('button', { name: 'Replace all matches', exact: true }).click();
  await expect(editor).toContainText('<literal> highlighted <literal>');
  await page.getByRole('button', { name: 'Close find', exact: true }).click();
  await editor.click();
  await page.keyboard.press('Control+z');
  await expect(editor).toContainText('Alpha beta highlighted alpha beta');
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await page.reload();
  await expect(editor.locator('mark')).toHaveText('highlighted');
  await expect(editor.locator('[data-toggle-title]')).toHaveText('Evidence');
  await context.request.delete(`/api/pages/${note.id}`, { headers: { 'x-note-request': '1' } });
  await context.close();
});
