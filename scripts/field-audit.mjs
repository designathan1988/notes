// Finds every visible text field, select or textarea that draws a frame (border, outline or shadow),
// at rest and while focused, across the app's interactive states. Exit code 1 when any frame remains.
// Usage: node scripts/field-audit.mjs <origin>   (run against an isolated NOTE_RUNTIME instance)
import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://127.0.0.1:5193';
const headers = { 'x-note-request': '1' };
const browser = await chromium.launch({ channel: 'chrome' });
const findings = new Map();
for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({
    baseURL: base,
    viewport: { width: 1440, height: 900 },
    colorScheme: scheme,
  });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: base },
  });
  const session = await (await context.request.get('/api/session')).json();
  const ws = session.workspaces[0].id;
  const make = async (kind) =>
    (
      await context.request.post(`/api/workspaces/${ws}/pages`, {
        data: { title: `Audit ${kind} ${Date.now()}`, kind },
        headers,
      })
    ).json();
  const doc = await make('document'),
    db = await make('database');
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const go = async (hash) => {
    await page.goto(`/?t=${Date.now()}#${hash}`);
    await page.locator('.workspace-content').waitFor({ timeout: 20000 });
    await page.waitForTimeout(500);
  };
  // Every field on screen is inspected at rest and focused.
  const scan = async (state) => {
    const count = await page.evaluate(() => {
      const fields = [
        ...document.querySelectorAll(
          'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=hidden]):not([type=file]), select, textarea',
        ),
      ].filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
      fields.forEach((el, i) => (el.dataset.auditField = String(i)));
      return fields.length;
    });
    for (let i = 0; i < count; i++) {
      const field = page.locator(`[data-audit-field="${i}"]`);
      const read = () =>
        field.evaluate((el) => {
          const s = getComputedStyle(el);
          const sides = ['Top', 'Right', 'Bottom', 'Left'].filter(
            (side) =>
              parseFloat(s[`border${side}Width`]) > 0 &&
              s[`border${side}Style`] !== 'none' &&
              !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(s[`border${side}Color`]),
          );
          const name =
            el.getAttribute('aria-label') ||
            el.getAttribute('placeholder') ||
            el.getAttribute('name') ||
            el.closest('label')?.textContent?.trim().slice(0, 30) ||
            el.tagName.toLowerCase();
          return {
            name: `${el.tagName.toLowerCase()} "${name}" in .${(el.parentElement?.className || '').toString().split(' ')[0]}`,
            border: sides.length
              ? `${sides.join('/')} ${s.borderTopWidth} ${s.borderTopColor}`
              : '',
            outline:
              s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0
                ? `${s.outlineWidth} ${s.outlineColor}`
                : '',
            shadow: s.boxShadow !== 'none' ? s.boxShadow : '',
          };
        });
      const rest = await read().catch(() => null);
      if (!rest) continue;
      await field.focus().catch(() => {});
      const focused = await read().catch(() => rest);
      await field.blur().catch(() => {});
      for (const [when, info] of [
        ['rest', rest],
        ['focus', focused],
      ]) {
        const frame = [
          info.border && `border ${info.border}`,
          info.outline && `outline ${info.outline}`,
          info.shadow && `shadow ${info.shadow}`,
        ]
          .filter(Boolean)
          .join('; ');
        if (frame) findings.set(`${info.name} [${when}]`, `${frame}  — ${scheme}/${state}`);
      }
    }
  };
  const step = async (state, run) => {
    try {
      await run();
      await page.waitForTimeout(300);
      await scan(state);
    } catch (error) {
      console.log(`skip ${state}: ${String(error).split('\n')[0]}`);
    }
    await page.keyboard.press('Escape').catch(() => {});
  };
  await step('document', () => go(`${doc.id}/document`));
  await step('find in page', async () => {
    await page.getByRole('textbox', { name: 'Page content' }).click();
    await page.keyboard.press('Control+f');
  });
  await step('block menu', async () => {
    await page.getByRole('textbox', { name: 'Page content' }).click();
    await page.keyboard.type('/');
  });
  await step('link picker', async () => {
    await page.getByRole('textbox', { name: 'Page content' }).click();
    await page.keyboard.press('Control+k').catch(() => {});
    await page.getByRole('button', { name: 'Insert link' }).first().click();
  });
  await step('templates', async () => {
    await page.getByRole('button', { name: 'Insert template' }).click();
  });
  await step('page details', async () => {
    await page.getByRole('button', { name: 'Open page details' }).click();
  });
  await step('comments', async () => {
    await page.getByRole('button', { name: 'Open comments' }).click();
  });
  await step('share', async () => {
    await page.getByRole('button', { name: 'Share' }).click();
  });
  await step('database', () => go(`${db.id}/database`));
  await step('new record', async () => {
    await page
      .locator('.table-actions')
      .getByRole('button', { name: 'New record', exact: true })
      .click();
  });
  await step('add property', async () => {
    await page
      .locator('.table-actions')
      .getByRole('button', { name: 'Add property', exact: true })
      .click();
  });
  await step('filter', async () => {
    await page
      .getByRole('button', { name: /Filter/ })
      .first()
      .click();
  });
  await step('record panel', async () => {
    await context.request.post(`/api/databases/${db.id}/records`, {
      data: { title: 'Row', values: {} },
      headers,
    });
    await go(`${db.id}/database`);
    await page.getByRole('button', { name: 'Inspect Row' }).first().click();
  });
  await step('search', async () => {
    await go('/home');
    await page.keyboard.press('Control+k');
  });
  await step('commands', async () => {
    await page.keyboard.press('Control+Shift+p');
  });
  await step('new page', async () => {
    await page.getByRole('button', { name: 'New page options' }).click();
  });
  for (const tab of ['Members', 'Data', 'Trash', 'Account']) {
    await step(`settings ${tab}`, async () => {
      await page.getByRole('button', { name: 'Account menu' }).click();
      await page.getByRole('menuitem', { name: 'Settings' }).click();
      await page.getByRole('tab', { name: tab }).click();
    });
  }
  await step('all pages', () => go('/all'));
  await step('templates library', () => go('/templates'));
  await step('graph', () => go('/graph'));
  await context.request.delete(`/api/pages/${doc.id}`, { headers });
  await context.request.delete(`/api/pages/${db.id}`, { headers });
  await context.close();
}
await browser.close();
for (const [field, frame] of [...findings].sort()) console.log(`${field}: ${frame}`);
console.log(`${findings.size} framed field states`);
process.exitCode = findings.size ? 1 : 0;
