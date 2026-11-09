// Runs one step in the live Chrome opened by scripts/live-chrome.mjs and photographs the result.
// Usage: node scripts/pw.mjs "<async body using page>" [shotPath]
//   e.g. node scripts/pw.mjs "await page.getByRole('button', { name: 'Filter' }).click()" out.png
// The body runs with `page` (the active tab); its return value is printed as JSON.
import { chromium } from '@playwright/test';
const [body = '', shot, port = '9333'] = process.argv.slice(2);
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const context = browser.contexts()[0];
const page = context.pages().at(-1);
page.setDefaultTimeout(6000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  const run = new Function('page', `return (async () => { ${body} })();`);
  const result = await run(page);
  if (result !== undefined) console.log(JSON.stringify(result, null, 1));
} catch (error) {
  console.log('STEP FAILED:', String(error).split('\n')[0]);
}
// Let the UI settle so the photo shows the state after the step, not mid-transition.
await page.waitForTimeout(700);
if (shot) {
  await page.screenshot({ path: shot });
  console.log('shot', shot);
}
if (errors.length) console.log('page errors:', errors);
process.exit(0);
