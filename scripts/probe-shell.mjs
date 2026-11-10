// Prints boxes, paddings and text start of the rail, the pages pane and the tab bar, in headless
// Chrome as the demo user. Usage: node scripts/probe-shell.mjs
import { chromium } from '@playwright/test';
const base = process.env.UI_ORIGIN ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'pt-BR',
});
await context.request.post(`${base}/api/auth/sign-in/email`, {
  data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
  headers: { origin: base },
});
const page = await context.newPage();
await page.goto(base);
await page.locator('.sidebar-panel .tree-page', { hasText: 'Product direction' }).first().click();
await page.locator('.document-canvas').waitFor();
await page.waitForTimeout(600);
const rows = await page.evaluate(() => {
  const pick = [
    '.sidebar-rail',
    '.rail-brand',
    '.rail-brand svg',
    '.search-trigger',
    '.sidebar-panel',
    '.workspace-identity',
    '.workspace-select',
    '.workspace-names',
    '.sidebar-scroll',
    '.section-label',
    '.favorites',
    '.favorites > button',
    '.page-tree',
    '.tree-row',
    '.tree-row.selected',
    '.tree-row.selected .tree-page',
    '.tree-row .tree-toggle',
    '.topbar',
    '.history-controls',
    '.workbench-tabs',
    '.workbench-tab.active',
    '.workspace-content',
  ];
  return pick.map((selector) => {
    const el = document.querySelector(selector);
    if (!el) return `${selector}: none`;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      ? ` textX=${Math.round(range.getBoundingClientRect().x)}`
      : '';
    return `${selector}: [${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}] pad=${cs.padding} mar=${cs.margin} fs=${cs.fontSize}${text}`;
  });
});
console.log(rows.join('\n'));
await browser.close();
