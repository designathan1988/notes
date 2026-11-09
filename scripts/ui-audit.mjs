// Clicks every visible button on each screen in real Chrome and reports dead or erroring ones.
// Usage: node scripts/ui-audit.mjs <origin> <report.json>  (run against an isolated NOTE_RUNTIME instance: it clicks everything)
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const base = process.argv[2];
const outFile = process.argv[3];
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(4000);
let errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.split('\n')[0]}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/status of 40[13]/.test(m.text()))
    errors.push(`console: ${m.text().split('\n')[0].slice(0, 160)}`);
});
let requests = 0;
page.on('request', (r) => {
  if (!r.url().includes('/@') && !r.url().includes('node_modules')) requests++;
});
await page.goto(base);
await page.getByRole('button', { name: 'Open demo workspace' }).click();
await page.locator('.app-shell').waitFor({ timeout: 20000 });
const ws = (await (await page.request.get(`${base}/api/session`)).json()).workspaces[0].id;
const raw = await (await page.request.get(`${base}/api/workspaces/${ws}/pages`)).json();
const list = Array.isArray(raw) ? raw : (raw.items ?? raw.pages ?? []);
const id = (t) => list.find((p) => p.title === t)?.id;
const screens = [
  ['home', '/home'],
  ['document', `${id('Product direction')}/document`],
  ['database', `${id('Research')}/database`],
  ['all pages', '/all'],
  ['graph', '/graph'],
  ['templates', '/templates'],
];
const report = [];
const open = async (hash) => {
  await page.goto(`${base}/?a=${Date.now()}#${hash}`);
  await page.locator('.workspace-content').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
};
for (const [screen, hash] of screens) {
  await open(hash);
  // Collect a stable description of each visible, enabled button on this screen.
  const targets = await page.evaluate(() => {
    const seen = new Set();
    return [
      ...document.querySelectorAll('button, [role=button], [role=tab], [role=menuitem], a[href]'),
    ]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return (
          r.width > 0 &&
          r.height > 0 &&
          style.visibility !== 'hidden' &&
          !el.disabled &&
          !el.closest('[data-tree-page]')
        );
      })
      .map((el) => {
        const name = (
          el.getAttribute('aria-label') ||
          el.textContent ||
          el.getAttribute('title') ||
          ''
        )
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 60);
        return { name, tag: el.tagName.toLowerCase(), role: el.getAttribute('role') };
      })
      .filter((t) => t.name && !seen.has(t.name) && seen.add(t.name))
      .filter((t) => !/^(Sign out|Delete|Move to trash|Delete permanently)/i.test(t.name));
  });
  for (const target of targets) {
    await open(hash);
    const locator = page
      .locator('button, [role=button], [role=tab], [role=menuitem], a[href]')
      .filter({ hasNot: page.locator('[data-tree-page]') })
      .filter({ visible: true });
    const handle = await locator.evaluateAll((els, name) => {
      const index = els.findIndex(
        (el) =>
          (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 60) === name,
      );
      return index;
    }, target.name);
    if (handle < 0) {
      report.push({ screen, name: target.name, result: 'not-found-after-reload' });
      continue;
    }
    await page.evaluate(() => {
      window.__mutations = 0;
      window.__observer?.disconnect();
      window.__observer = new MutationObserver((m) => (window.__mutations += m.length));
      window.__observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    });
    const url = page.url();
    errors = [];
    requests = 0;
    let result = 'ok';
    try {
      await locator.nth(handle).click({ timeout: 3000 });
      await page.waitForTimeout(700);
      const mutations = await page.evaluate(() => window.__mutations).catch(() => 1);
      const changed = mutations > 0 || page.url() !== url || requests > 0;
      if (errors.length) result = 'ERROR';
      else if (!changed) result = 'DEAD';
    } catch (error) {
      result = 'CLICK-FAILED';
      errors.push(String(error).split('\n')[0].slice(0, 140));
    }
    report.push({ screen, name: target.name, result, errors: [...new Set(errors)] });
    console.log(
      result.padEnd(13),
      screen.padEnd(10),
      target.name,
      errors.length ? '→ ' + errors[0] : '',
    );
  }
}
await browser.close();
writeFileSync(outFile, JSON.stringify(report, null, 2));
const bad = report.filter((r) => r.result !== 'ok');
console.log(`\n${report.length} controls, ${bad.length} problems`);
