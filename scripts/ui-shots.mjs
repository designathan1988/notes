// Full-resolution UI captures in real headless Chrome, independent of the interface language.
// Usage: node scripts/ui-shots.mjs <outDir> [light|dark|both] [filter]; UI_ORIGIN selects the server.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2];
const schemes = (process.argv[3] ?? 'both') === 'both' ? ['light', 'dark'] : [process.argv[3]];
const filter = process.argv[4];
mkdirSync(out, { recursive: true });
const base = process.env.UI_ORIGIN ?? 'http://127.0.0.1:5193';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const problems = [];
for (const scheme of schemes) {
  for (const device of ['desktop', 'mobile']) {
    const context = await browser.newContext({
      viewport: device === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 },
      deviceScaleFactor: 2,
      colorScheme: scheme,
      locale: 'pt-BR',
      hasTouch: device === 'mobile',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const tag = `${scheme}-${device}`;
    page.on('pageerror', (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
    page.on(
      'console',
      (m) => m.type() === 'error' && problems.push(`[${tag}] console: ${m.text().slice(0, 200)}`),
    );
    const go = async (hash) => {
      await page.goto(`${base}/?v=${Date.now()}#${hash}`);
    };
    const shot = async (name, fn) => {
      if (filter && !name.includes(filter)) return;
      try {
        await fn();
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${out}/${tag}-${name}.png` });
        console.log('ok', tag, name);
      } catch (error) {
        console.log('fail', tag, name, String(error).split('\n')[0].slice(0, 160));
        await page.screenshot({ path: `${out}/${tag}-${name}-FAILED.png` }).catch(() => {});
      }
      await page.keyboard.press('Escape').catch(() => {});
    };
    await page.goto(base);
    await shot('signin', () => page.locator('.auth-screen').waitFor());
    await context.request.post(`${base}/api/auth/sign-in/email`, {
      data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
      headers: { origin: base },
    });
    const ws = (await (await context.request.get(`${base}/api/session`)).json()).workspaces[0].id;
    const raw = await (await context.request.get(`${base}/api/workspaces/${ws}/pages`)).json();
    const list = Array.isArray(raw) ? raw : (raw.items ?? raw.pages ?? []);
    const doc = list.find((p) => p.title === 'Product direction');
    const db = list.find((p) => p.title === 'Research');
    const canvas = list.find((p) => p.kind === 'canvas');
    const record = list.find((p) => p.kind === 'record');
    await shot('home', async () => {
      await go('/home');
      await page.locator('.home').waitFor();
    });
    await shot('document', async () => {
      await go(`${doc.id}/document`);
      await page.locator('.note-editor').first().waitFor();
    });
    await shot('document-scrolled', async () => {
      await page.locator('.document-scroll').evaluate((e) => (e.scrollTop = 700));
    });
    await shot('document-slash', async () => {
      await go(`${doc.id}/document`);
      await page.locator('.note-editor').first().waitFor();
      await page.locator('.note-editor p').last().click();
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');
      await page.keyboard.type('/');
    });
    await shot('details', async () => {
      await go(`${doc.id}/document`);
      await page.locator('.note-editor').first().waitFor();
      await page.locator('.topbar-actions button, .topbar button').last().waitFor();
      await page.keyboard.press('Control+.');
    });
    await shot('database', async () => {
      await go(`${db.id}/database`);
      await page.locator('table').first().waitFor();
    });
    await shot('record', async () => {
      await go(`${record.id}/document`);
      await page.locator('.note-editor').first().waitFor();
    });
    if (canvas)
      await shot('canvas', async () => {
        await go(`${canvas.id}/canvas`);
        await page.waitForTimeout(1500);
      });
    await shot('allpages', async () => {
      await go('/all');
      await page.locator('.page-index, .all-pages, main h1').first().waitFor();
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
    await context.close();
  }
}
await browser.close();
writeFileSync(`${out}/problems.txt`, problems.join('\n'));
console.log('problems:', problems.length);
