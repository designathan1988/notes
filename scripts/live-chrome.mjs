// Opens the real Chrome (Playwright, channel 'chrome') headless with a CDP port so each test step can
// drive the same session live (see scripts/pw.mjs). Keeps running until stopped.
// Usage: node scripts/live-chrome.mjs <origin> [port]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const origin = process.argv[2] ?? 'http://127.0.0.1:5193';
const port = Number(process.argv[3] ?? 9333);
const profile = '.runtime-audit/chrome-profile';
mkdirSync(profile, { recursive: true });
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chrome',
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: [`--remote-debugging-port=${port}`],
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(origin);
console.log(`live chrome ready on CDP port ${port} at ${origin}`);
context.on('close', () => process.exit(0));
