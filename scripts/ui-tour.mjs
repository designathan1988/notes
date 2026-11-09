// Uses the app end to end in real Chrome and photographs every interaction state for review.
// Usage: node scripts/ui-tour.mjs <origin> <outDir> [light|dark] [oldCssFile]
// Run against an isolated NOTE_RUNTIME instance: the tour creates and edits content.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const [base, out, scheme = 'dark', oldCss] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: scheme,
});
const page = await context.newPage();
page.setDefaultTimeout(8000);
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/status of 40[13]/.test(m.text()))
    problems.push(`console: ${m.text().slice(0, 200)}`);
});
const applyOldCss = async () => {
  if (!oldCss) return;
  const css = readFileSync(oldCss, 'utf8');
  await page.evaluate((text) => {
    for (const s of document.querySelectorAll('style[data-vite-dev-id]')) s.textContent = '';
    const tag = document.createElement('style');
    tag.textContent = text;
    document.head.append(tag);
  }, css);
};
let n = 0;
const shot = async (name) => {
  await applyOldCss();
  await page.waitForTimeout(400);
  const file = `${out}/${String(++n).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: file });
  console.log('shot', file);
};
const step = async (name, fn) => {
  try {
    await fn();
    await shot(name);
  } catch (error) {
    problems.push(`step ${name}: ${String(error).split('\n')[0]}`);
    console.log('fail', name, String(error).split('\n')[0]);
  }
};
const go = async (hash) => {
  await page.goto(`${base}/?t=${Date.now()}#${hash}`);
  await page.locator('.workspace-content').waitFor({ timeout: 20000 });
  await page.waitForTimeout(900);
};

await page.goto(base);
await page.getByRole('button', { name: 'Open demo workspace' }).click();
await page.locator('.app-shell').waitFor({ timeout: 20000 });
const ws = (await (await page.request.get(`${base}/api/session`)).json()).workspaces[0].id;
const raw = await (await page.request.get(`${base}/api/workspaces/${ws}/pages`)).json();
const list = Array.isArray(raw) ? raw : (raw.items ?? raw.pages ?? []);
const id = (t) => list.find((p) => p.title === t)?.id;
const editor = () => page.getByRole('textbox', { name: 'Page content' }).first();

// --- documents ---
await step('doc-reading', () => go(`${id('Getting started')}/document`));
await step('doc-editing-caret', async () => {
  await editor().click();
  await page.keyboard.press('Control+End');
});
await step('doc-block-hover', async () => {
  await page.locator('.note-editor .content-block').nth(1).hover();
});
await step('doc-slash-menu', async () => {
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/');
});
await step('doc-slash-filtered', async () => {
  await page.keyboard.type('head');
});
await step('doc-heading-inserted', async () => {
  await page.keyboard.press('Enter');
  await page.keyboard.type('A new section heading');
});
await step('doc-selection-toolbar', async () => {
  await page.keyboard.press('Shift+Home');
});
await step('doc-block-actions', async () => {
  await page.keyboard.press('End');
  const handle = page.getByRole('button', { name: 'Block actions' }).first();
  await page.locator('.note-editor .content-block').last().hover();
  await handle.click();
});
await step('doc-rich-content', async () => {
  await page.keyboard.press('Escape');
  await go(`${id('Product direction')}/document`);
});
await step('doc-rich-scrolled', async () => {
  await page.locator('.document-scroll').evaluate((e) => (e.scrollTop = 650));
});
await step('doc-details-panel', async () => {
  await page.getByRole('button', { name: 'Open page details' }).click();
});
await step('doc-page-actions', async () => {
  await page
    .getByRole('button', { name: 'Open page details' })
    .or(page.getByRole('button', { name: 'Close page details' }))
    .first()
    .click();
  await page.getByRole('button', { name: 'Page actions' }).click();
});
await step('doc-comments', async () => {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open comments' }).click();
});

// --- databases ---
await step('db-table', () => go(`${id('Research')}/database`));
await step('db-cell-editing', async () => {
  await page.getByLabel('Name for User interviews', { exact: true }).click();
});
await step('db-select-open', async () => {
  await page.keyboard.press('Escape');
  await page.locator('.status-label').first().focus();
});
await step('db-filter', async () => {
  await page
    .getByRole('button', { name: /Filter/ })
    .first()
    .click();
});
await step('db-record-panel', async () => {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Inspect User interviews' }).first().click();
});
await step('db-board', async () => {
  await page.keyboard.press('Escape');
  await go(`${id('Research')}/database`);
  await page.getByRole('combobox', { name: 'Layout', exact: true }).click();
  await page.getByRole('option', { name: 'Board', exact: true }).click();
});

// --- workspace surfaces ---
await step('home', () => go('/home'));
await step('all-pages', () => go('/all'));
await step('templates', () => go('/templates'));
await step('graph', () => go('/graph'));
await step('canvas-index', () => go('/canvas'));
await step('canvas-open', async () => {
  const canvas = list.find((p) => p.kind === 'canvas');
  if (canvas) await go(`${canvas.id}/canvas`);
});
await step('search-results', async () => {
  await go('/home');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('prod');
  await page.waitForTimeout(800);
});
await step('new-page-dialog', async () => {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New page options' }).click();
});
await step('settings-appearance', async () => {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
});
await step('settings-data', async () => {
  await page.getByRole('tab', { name: 'Data' }).click();
});
await step('invite', async () => {
  await page.keyboard.press('Escape');
  await go(`${id('Product direction')}/document`);
  await page.getByRole('button', { name: 'Share' }).click();
});
await step('appearance-panel', async () => {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Appearance' }).click();
});

writeFileSync(`${out}/problems.txt`, problems.join('\n'));
console.log('problems:', problems.length);
await browser.close();
