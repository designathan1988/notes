// Captures interface states that need a click first (details panel, hovers), in headless Chrome
// as the demo user, and prints the outline of the work area. Usage: node scripts/shot-states.mjs <outDir> [width]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const base = process.env.UI_ORIGIN ?? 'http://127.0.0.1:5173';
const out = process.argv[2] ?? '.runtime-audit/states';
const width = Number(process.argv[3] ?? 1440);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: scheme,
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
  await page.getByRole('button', { name: /detalhes da página/i }).click();
  await page.locator('.context-panel').waitFor();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${scheme}-details.png` });
  if (scheme === 'light') {
    const outline = await page.evaluate(() => {
      const lines = [];
      const walk = (el, level) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const cls =
          typeof el.className === 'string' ? el.className.trim().replace(/\s+/g, '.') : '';
        const cs = getComputedStyle(el);
        lines.push(
          `${'  '.repeat(level)}${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} [${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}] fs=${cs.fontSize} fw=${cs.fontWeight}`,
        );
        if (level < 5) for (const child of el.children) walk(child, level + 1);
      };
      walk(document.querySelector('.workspace-content'), 0);
      return lines.filter((l) => !/ (svg|path|line|circle|rect)/.test(l)).slice(0, 120);
    });
    console.log(outline.join('\n'));
  }
  await context.close();
}
await browser.close();
