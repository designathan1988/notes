// One full-resolution capture of a page by title, in headless Chrome, signed in as the demo user.
// Usage: node scripts/shot-page.mjs "<title>" <out.png> [light|dark] [view]
import { chromium } from '@playwright/test';
const base = process.env.UI_ORIGIN ?? 'http://127.0.0.1:5173';
const [title, out, scheme = 'light', view = ''] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: scheme,
  locale: 'pt-BR',
});
await context.request.post(`${base}/api/auth/sign-in/email`, {
  data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
  headers: { origin: base },
});
const session = await (await context.request.get(`${base}/api/session`)).json();
const raw = await (
  await context.request.get(`${base}/api/workspaces/${session.workspaces[0].id}/pages`)
).json();
const list = Array.isArray(raw) ? raw : (raw.items ?? raw.pages ?? []);
const target = list.find((page) => page.title === title);
if (!target) throw new Error(`No page titled ${title}`);
const page = await context.newPage();
const problems = [];
page.on('pageerror', (error) => problems.push(error.message));
await page.goto(`${base}/#${target.id}${view ? '/' + view : ''}`);
await page.locator('.workspace-content').waitFor({ timeout: 15000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
console.log('kind', target.kind, 'errors', problems.length ? problems : 'none');
await browser.close();
