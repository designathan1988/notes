// Measures tabs and page rows before and during hover, in headless Chrome as the demo user.
// Usage: node scripts/probe-tabs.mjs [out.png]
import { chromium } from '@playwright/test';
const base = process.env.UI_ORIGIN ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'pt-BR',
});
await context.request.post(`${base}/api/auth/sign-in/email`, {
  data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
  headers: { origin: base },
});
const page = await context.newPage();
await page.goto(base);
await page.locator('.workbench-tab').first().waitFor({ timeout: 15000 });
// open a second and third tab so inactive tabs exist
for (const title of ['Research', 'Design principles']) {
  await page.locator('.workbench-tab.active [role=tab]').dblclick();
  await page.locator('.sidebar-panel .tree-page', { hasText: title }).first().click();
  await page.waitForTimeout(500);
}
await page.waitForTimeout(600);
const box = (el) =>
  el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    const svg = node.querySelector('[role=tab] svg, [role=tab] .page-reference-icon');
    const s = svg ? getComputedStyle(svg) : null;
    return {
      x: Math.round(r.x),
      y: Math.round(r.y * 10) / 10,
      w: Math.round(r.width * 10) / 10,
      h: Math.round(r.height * 10) / 10,
      icon: svg ? `${svg.getBoundingClientRect().width}px ${s.color} ${s.display}` : 'none',
      bg: getComputedStyle(node).backgroundColor,
    };
  });
const tabs = page.locator('.workbench-tab');
const count = await tabs.count();
for (let i = 0; i < count; i++)
  console.log('tab', i, 'rest ', JSON.stringify(await box(tabs.nth(i))));
const inactive = page.locator('.workbench-tab:not(.active)').first();
await inactive.hover();
await page.waitForTimeout(400);
console.log('inactive hover', JSON.stringify(await box(inactive)));
const row = page.locator('.sidebar-panel .tree-row:not(.selected)').nth(2);
console.log('row rest ', await row.evaluate((n) => getComputedStyle(n).backgroundColor));
await row.hover();
await page.waitForTimeout(400);
console.log('row hover', await row.evaluate((n) => getComputedStyle(n).backgroundColor));
if (process.argv[2])
  await page.screenshot({ path: process.argv[2], clip: { x: 0, y: 0, width: 1440, height: 420 } });
await browser.close();
