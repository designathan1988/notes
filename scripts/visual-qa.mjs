import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve(process.argv[2] ?? '.runtime/visual-qa');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1536, height: 1024 },
    reducedMotion: 'reduce',
  });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  const session = await (await context.request.get('/api/session')).json();
  const pages = await (
    await context.request.get(`/api/workspaces/${session.workspaces[0].id}/pages`)
  ).json();
  const primary = pages.find((page) => page.title === 'Product direction');
  if (!primary) throw new Error('The local QA fixture is missing.');
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.text());
  });
  await page.goto(`/#${primary.id}/document`);
  await page.locator('.save-status.saved').waitFor();
  await page.getByRole('table', { name: 'Related notes' }).getByRole('button').first().waitFor();
  await page.screenshot({ path: resolve(output, 'workspace-desktop.png') });
  const typography = await page.locator('.note-editor').evaluate((element) => {
    const style = getComputedStyle(element);
    return { font: style.fontFamily, size: style.fontSize, lineHeight: style.lineHeight };
  });
  await page.locator('.note-editor > p').first().click();
  await page.getByRole('button', { name: 'Block actions', exact: true }).click();
  await page.getByRole('menu', { name: 'Block actions', exact: true }).waitFor();
  await page.screenshot({ path: resolve(output, 'workspace-block-menu.png') });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.save-status').click();
  await page.screenshot({ path: resolve(output, 'workspace-mobile-390.png') });
  const overflow390 = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: resolve(output, 'workspace-mobile-360.png') });
  const overflow360 = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.getByRole('button', { name: 'Databases', exact: true }).click();
  await page
    .getByRole('region', { name: 'Databases', exact: true })
    .getByRole('button', { name: 'Research database', exact: true })
    .click();
  await page.getByRole('table', { name: 'Database records' }).getByRole('row').nth(1).waitFor();
  await page.screenshot({ path: resolve(output, 'workspace-database.png') });
  await page.getByRole('combobox', { name: 'Layout', exact: true }).selectOption('board');
  await page.getByRole('combobox', { name: 'Group by', exact: true }).selectOption('status');
  await page.locator('.board-record').first().waitFor();
  await page.screenshot({ path: resolve(output, 'workspace-board-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(output, 'workspace-board-mobile.png') });
  const boardOverflow390 = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await page.setViewportSize({ width: 1536, height: 1024 });
  const report = {
    title: await page.title(),
    url: page.url(),
    frameworkOverlay: await page.locator('vite-error-overlay').count(),
    viewports: [
      [1536, 1024],
      [390, 844],
      [360, 800],
    ],
    overflow390,
    overflow360,
    boardOverflow390,
    typography,
    errors,
  };
  await writeFile(resolve(output, 'verification.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ output, ...report }, null, 2) + '\n');
  if (overflow390 || overflow360 || boardOverflow390 || errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
