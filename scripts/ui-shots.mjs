// Full-resolution UI captures in real Chrome. Usage: node scripts/ui-shots.mjs <outDir> [light|dark|both] [filter]; UI_ORIGIN selects the server.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2];
const schemes = (process.argv[3] ?? 'both') === 'both' ? ['light', 'dark'] : [process.argv[3]];
const filter = process.argv[4];
mkdirSync(out, { recursive: true });
const base = process.env.UI_ORIGIN ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'chrome' });
const problems = [];
for (const scheme of schemes) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: scheme,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => problems.push(`[${scheme}] pageerror: ${e.message}`));
  page.on(
    'console',
    (m) => m.type() === 'error' && problems.push(`[${scheme}] console: ${m.text().slice(0, 200)}`),
  );
  const go = async (hash) => {
    await page.goto(`${base}/?v=${Date.now()}#${hash}`);
  };
  const shot = async (name, fn) => {
    if (filter && !name.includes(filter)) return;
    try {
      await fn();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${out}/${scheme}-${name}.png` });
      console.log('ok', scheme, name);
    } catch (error) {
      console.log('fail', scheme, name, String(error).split('\n')[0].slice(0, 160));
    }
  };
  await page.goto(base);
  await shot('signin', () => page.getByRole('button', { name: 'Open demo workspace' }).waitFor());
  await page.getByRole('button', { name: 'Open demo workspace' }).click();
  await page.locator('.app-shell').waitFor();
  const ws = (await (await page.request.get(`${base}/api/session`)).json()).workspaces[0].id;
  const raw = await (await page.request.get(`${base}/api/workspaces/${ws}/pages`)).json();
  const list = Array.isArray(raw) ? raw : (raw.items ?? raw.pages ?? []);
  const doc = list.find((p) => p.title === 'Product direction');
  const db = list.find((p) => p.title === 'Research');
  await shot('home', async () => {
    await go('/home');
    await page.locator('.home').waitFor();
  });
  await shot('document', async () => {
    await go(`${doc.id}/document`);
    await page.locator('.note-editor').first().waitFor();
  });
  await shot('document-scrolled', async () => {
    await go(`${doc.id}/document`);
    await page.locator('.note-editor').first().waitFor();
    await page.locator('.document-scroll').evaluate((e) => (e.scrollTop = 700));
  });
  await shot('details', async () => {
    await go(`${doc.id}/document`);
    await page.locator('.note-editor').first().waitFor();
    await page.getByRole('button', { name: 'Open page details' }).click();
  });
  await shot('database', async () => {
    await go(`${db.id}/database`);
    await page.locator('table').first().waitFor();
  });
  await shot('allpages', async () => {
    await go('/all');
    await page.getByRole('heading', { name: 'All pages' }).waitFor();
  });
  await shot('graph', async () => {
    await go('/graph');
    await page.locator('.graph-canvas').waitFor();
    await page.waitForTimeout(1500);
  });
  await shot('templates', async () => {
    await go('/templates');
    await page.locator('.templates-screen').waitFor();
  });
  await shot('search', async () => {
    await go('/home');
    await page.locator('.home').waitFor();
    await page.keyboard.press('Control+k');
    await page.locator('dialog[open]').waitFor();
  });
  await shot('commands', async () => {
    await go('/home');
    await page.locator('.home').waitFor();
    await page.keyboard.press('Control+Shift+p');
    await page.locator('dialog[open]').waitFor();
  });
  await shot('settings', async () => {
    await go('/home');
    await page.locator('.home').waitFor();
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Settings' }).click();
    await page.locator('dialog[open]').waitFor();
  });
  await context.close();
}
await browser.close();
writeFileSync(`${out}/problems.txt`, problems.join('\n'));
console.log('problems:', problems.length);
