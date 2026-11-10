// Prints the shell's element outline (classes and boxes) of a page in headless Chrome, signed in
// as the local demo user. Usage: node scripts/dom-outline.mjs [hash] [selector] [depth]
import { chromium } from '@playwright/test';
const base = process.env.UI_ORIGIN ?? 'http://127.0.0.1:5173';
const [hash = '', root = '.app-shell', depthArg = '4'] = process.argv.slice(2);
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
await page.goto(`${base}/${hash ? '#' + hash : ''}`);
await page.locator(root).first().waitFor({ timeout: 15000 });
await page.waitForTimeout(800);
const lines = await page.evaluate(
  ([selector, depth]) => {
    const out = [];
    const walk = (el, level) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const cls = typeof el.className === 'string' ? el.className.trim().replace(/\s+/g, '.') : '';
      out.push(
        `${'  '.repeat(level)}${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} [${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}]`,
      );
      if (level < depth) for (const child of el.children) walk(child, level + 1);
    };
    walk(document.querySelector(selector), 0);
    return out;
  },
  [root, Number(depthArg)],
);
console.log(lines.join('\n'));
await browser.close();
