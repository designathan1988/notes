// Renders a Design canvas artboard (.dc.html) locally in headless Chrome so it can be inspected
// before it is shown. Usage: node scripts/render-dc.mjs <file.dc.html> <out.png> <w> <h> [theme]
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const [file, out, w = '1440', h = '900', theme = 'light'] = process.argv.slice(2);
let html = readFileSync(file, 'utf8');
const helmet = /<helmet>([\s\S]*?)<\/helmet>/.exec(html)?.[1] ?? '';
html = html
  .replace(/<script src="\.\/support\.js"><\/script>/, helmet)
  .replace(/<helmet>[\s\S]*?<\/helmet>/, '')
  .replace(/<\/?x-dc>/g, '')
  .replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/, '')
  .replaceAll('{{theme}}', theme);
const local = file.replace(/\.dc\.html$/, `.render.html`);
writeFileSync(local, html);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(pathToFileURL(local).href);
await page.waitForLoadState('networkidle');
await page.evaluate(() => document.fonts.ready);
const overflow = await page.evaluate(() =>
  [...document.querySelectorAll('.app *')]
    .filter(
      (e) =>
        e.scrollWidth > e.clientWidth + 1 &&
        getComputedStyle(e).overflowX === 'visible' &&
        e.clientWidth > 0,
    )
    .slice(0, 8)
    .map((e) => `${e.tagName}.${e.className} ${e.scrollWidth}>${e.clientWidth}`),
);
await page.screenshot({ path: out });
await browser.close();
console.log('rendered', out, { overflow, errors });
