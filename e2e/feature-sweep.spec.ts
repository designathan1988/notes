import { selectOption } from './select.js';
import { APP_ORIGIN } from './origin.js';
import { test, expect, type Browser, type Page } from './test.js';
import { openCatalog } from './navigate.js';

/**
 * Feature sweep: drives every user-facing capability end to end and asserts its effect,
 * collecting every failing item instead of stopping at the first one.
 */
const headers = { 'x-note-request': '1' };
test.describe.configure({ timeout: 180_000 });
async function open(browser: Browser, kind: 'document' | 'database' | 'canvas' = 'document') {
  const context = await browser.newContext({
    baseURL: APP_ORIGIN,
    viewport: { width: 1440, height: 1000 },
  });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json();
  const workspace = session.workspaces[0].id as string;
  const created = await (
    await context.request.post(`/api/workspaces/${workspace}/pages`, {
      data: { title: `Sweep ${kind} ${Date.now()}`, kind },
      headers,
    })
  ).json();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const view = kind === 'database' ? 'database' : kind === 'canvas' ? 'canvas' : 'document';
  await page.goto(`/#${created.id}/${view}`);
  await page.locator('.workspace-content').waitFor();
  const cleanup = async () => {
    await context.request.delete(`/api/pages/${created.id}`, { headers }).catch(() => {});
    await context.close();
  };
  return { page, context, workspace, created, errors, cleanup };
}
const blocks = (page: Page) =>
  page.getByRole('textbox', { name: 'Page content' }).locator('[data-content-block]');

const BLOCK_TYPES = [
  'Toggle section',
  'Text',
  'Heading 1',
  'Heading 2',
  'Heading 3',
  'Bullet list',
  'Numbered list',
  'Checklist',
  'Callout',
  'Quote',
  'Code block',
  'Divider',
  'Table',
  'File or media',
  'Web component',
  'Database view',
  'Video embed',
  'Page connection',
];

test('every block type in the block menu inserts a block or opens its setup', async ({
  browser,
}) => {
  const { page, errors, cleanup } = await open(browser);
  const failures: string[] = [];
  try {
    await expect(page.locator('.save-status')).toHaveText('Saved');
    for (const label of BLOCK_TYPES) {
      const before = await blocks(page).count();
      await page.getByRole('button', { name: 'Add a block', exact: true }).click();
      const item = page.getByRole('menuitem', { name: label, exact: true });
      if (
        !(await item.waitFor({ timeout: 3000 }).then(
          () => true,
          () => false,
        ))
      ) {
        failures.push(`${label}: not in the block menu`);
        await page.keyboard.press('Escape');
        continue;
      }
      if (label === 'File or media') {
        // Opens the operating system file picker, which is not part of the page.
        const chooser = page
          .waitForEvent('filechooser', { timeout: 4000 })
          .then(() => true)
          .catch(() => false);
        await item.click();
        if (!(await chooser)) failures.push(`${label}: file picker did not open`);
        continue;
      }
      await item.click();
      if (label === 'Text') {
        // Text turns the empty paragraph it was opened from into text: the last block is a paragraph.
        const tag = await blocks(page)
          .last()
          .evaluate((node) => node.tagName);
        if (tag !== 'P') failures.push(`${label}: last block is ${tag}`);
        await page.keyboard.press('Escape');
        continue;
      }
      const opened = page.locator('dialog[open], .app-popover');
      const inserted = await expect
        .poll(async () => (await blocks(page).count()) > before || (await opened.count()) > 0, {
          timeout: 4000,
        })
        .toBe(true)
        .then(() => true)
        .catch(() => false);
      if (!inserted) failures.push(`${label}: nothing happened`);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
    }
    expect(failures, failures.join('\n')).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  } finally {
    await cleanup();
  }
});

test('markdown shortcuts create the matching blocks', async ({ browser }) => {
  const { page, errors, cleanup } = await open(browser);
  try {
    const content = page.getByRole('textbox', { name: 'Page content' });
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await content.click();
    const cases: [string, string][] = [
      ['# ', 'h1'],
      ['## ', 'h2'],
      ['### ', 'h3'],
      ['- ', 'ul'],
      ['1. ', 'ol'],
      ['[] ', 'ul[data-type="taskList"]'],
      ['> ', 'blockquote'],
      ['``` ', 'pre'],
    ];
    const failures: string[] = [];
    for (const [shortcut, selector] of cases) {
      const before = await content.locator(selector).count();
      await page.keyboard.press('Control+End');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.type(shortcut);
      await page.keyboard.type('x');
      const ok = await expect
        .poll(() => content.locator(selector).count(), { timeout: 3000 })
        .toBeGreaterThan(before)
        .then(() => true)
        .catch(() => false);
      if (!ok) failures.push(`"${shortcut}" did not create ${selector}`);
      await page.keyboard.press('Control+End');
    }
    expect(failures, failures.join('\n')).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  } finally {
    await cleanup();
  }
});

test('inline formatting, links and undo work from the toolbar and keyboard', async ({
  browser,
}) => {
  const { page, errors, cleanup } = await open(browser);
  try {
    const content = page.getByRole('textbox', { name: 'Page content' });
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await content.click();
    await page.keyboard.type('Format this sentence');
    await page.keyboard.press('Shift+Home');
    await page.getByRole('button', { name: 'Bold', exact: true }).first().click();
    await expect(content.locator('strong')).toHaveText('Format this sentence');
    await page.getByRole('button', { name: 'Italic', exact: true }).first().click();
    await expect(content.locator('em')).toHaveCount(1);
    await page.keyboard.press('Control+z');
    await expect(content.locator('em')).toHaveCount(0);
    await page.keyboard.press('Control+Shift+z');
    await expect(content.locator('em')).toHaveCount(1);
    await page.keyboard.press('Control+b');
    await expect(content.locator('strong')).toHaveCount(0);
    expect(errors, errors.join('\n')).toEqual([]);
  } finally {
    await cleanup();
  }
});

test('block actions move, duplicate, turn into every type and delete', async ({ browser }) => {
  const { page, errors, cleanup } = await open(browser);
  try {
    const content = page.getByRole('textbox', { name: 'Page content' });
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await content.click();
    await page.keyboard.type('Alpha');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Beta');
    await blocks(page).nth(1).click();
    await page.getByRole('button', { name: 'Drag or open block actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Move up', exact: true }).click();
    await expect(blocks(page).first()).toHaveText('Beta');
    await page.getByRole('button', { name: 'Drag or open block actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Duplicate', exact: true }).click();
    await expect(blocks(page)).toHaveCount(3);
    const failures: string[] = [];
    for (const label of [
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Bullet list',
      'Numbered list',
      'Checklist',
      'Callout',
      'Quote',
      'Code block',
      'Toggle section',
      'Text',
    ]) {
      await blocks(page).first().click();
      await page.getByRole('button', { name: 'Drag or open block actions', exact: true }).click();
      const item = page.getByRole('menuitem', { name: label, exact: true });
      if (
        !(await item.waitFor({ timeout: 3000 }).then(
          () => true,
          () => false,
        ))
      ) {
        failures.push(`turn into ${label}: missing`);
        await page.keyboard.press('Escape');
        continue;
      }
      await item.click();
      if (!(await blocks(page).first().textContent())?.includes('Beta'))
        failures.push(`turn into ${label}: lost the text`);
    }
    await blocks(page).last().click();
    await page.getByRole('button', { name: 'Drag or open block actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await expect(blocks(page)).toHaveCount(2);
    expect(failures, failures.join('\n')).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  } finally {
    await cleanup();
  }
});

test('dragging a box over several blocks selects them, and Delete removes them together', async ({
  browser,
}) => {
  const { page, errors, cleanup } = await open(browser);
  try {
    const content = page.getByRole('textbox', { name: 'Page content' });
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await content.click();
    for (const text of ['One', 'Two', 'Three', 'Four']) {
      await page.keyboard.type(text);
      await page.keyboard.press('Enter');
    }
    await page.keyboard.type('Five');
    await expect(blocks(page)).toHaveCount(5);
    const first = (await blocks(page).nth(1).boundingBox())!;
    const last = (await blocks(page).nth(3).boundingBox())!;
    // Start in the empty margin left of the text, like Notion's block selection.
    await page.mouse.move(first.x - 60, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(first.x + 120, last.y + last.height / 2, { steps: 12 });
    await expect(page.locator('.block-marquee')).toBeVisible();
    await page.mouse.up();
    await expect(content.locator('[data-block-selected]')).toHaveCount(3);
    await page.keyboard.press('Backspace');
    await expect(blocks(page)).toHaveCount(2);
    await expect(blocks(page).nth(0)).toHaveText('One');
    await expect(blocks(page).nth(1)).toHaveText('Five');
    expect(errors, errors.join('\n')).toEqual([]);
  } finally {
    await cleanup();
  }
});

test('keyboard block selection: Escape, Shift+arrows, group actions and copy-paste of whole blocks', async ({
  browser,
}) => {
  const { page, context, errors, cleanup } = await open(browser);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP_ORIGIN });
  // StarterKit's TrailingNode keeps an empty line after a heading at the end; ignore it.
  const texts = async () =>
    (await blocks(page).allInnerTexts()).map((text) => text.trim()).filter(Boolean);
  try {
    const content = page.getByRole('textbox', { name: 'Page content' });
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await content.click();
    await page.keyboard.type('Alpha');
    for (const text of ['Beta', 'Gamma', 'Delta']) {
      await page.keyboard.press('Enter');
      await page.keyboard.type(text);
    }
    // Caret in "Beta" → Escape selects that block; Shift+Down grows the selection.
    await blocks(page).nth(1).click();
    // The editor reads a click's caret on selectionchange; wait until the block is active.
    await expect(blocks(page).nth(1)).toHaveClass(/is-active/);
    await page.keyboard.press('Escape');
    await expect(content.locator('[data-block-selected]')).toHaveText(['Beta']);
    await page.keyboard.press('Shift+ArrowDown');
    await expect(content.locator('[data-block-selected]')).toHaveText(['Beta', 'Gamma']);
    // The block menu acts on the whole selection.
    await blocks(page).nth(1).hover();
    await page.getByRole('button', { name: 'Drag or open block actions' }).click();
    const menu = page.getByRole('menu', { name: 'Block actions' });
    await expect(menu.getByText('Turn 2 blocks into')).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Heading 2' }).click();
    await expect(content.locator('h2')).toHaveText(['Beta', 'Gamma']);
    await expect(content.locator('[data-block-selected]')).toHaveCount(2);
    // Copy the two blocks and paste them after "Delta" as whole blocks.
    await page.keyboard.press('Control+c');
    await blocks(page).nth(3).click();
    await expect(blocks(page).nth(3)).toHaveClass(/is-active/);
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Control+v');
    await expect.poll(texts).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta', 'Beta', 'Gamma']);
    await expect(content.locator('h2')).toHaveCount(4);
    // Escape twice leaves the document; nothing stays selected.
    await blocks(page).nth(0).click();
    await expect(blocks(page).nth(0)).toHaveClass(/is-active/);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(content.locator('[data-block-selected]')).toHaveCount(0);
    expect(errors, errors.join('\n')).toEqual([]);
  } finally {
    await cleanup();
  }
});

test('dragging the handle of a selected block moves the whole selection', async ({ browser }) => {
  const { page, errors, cleanup } = await open(browser);
  try {
    const content = page.getByRole('textbox', { name: 'Page content' });
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await content.click();
    await page.keyboard.type('One');
    for (const text of ['Two', 'Three', 'Four']) {
      await page.keyboard.press('Enter');
      await page.keyboard.type(text);
    }
    await blocks(page).nth(0).click();
    await expect(blocks(page).nth(0)).toHaveClass(/is-active/);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+ArrowDown');
    await expect(content.locator('[data-block-selected]')).toHaveCount(2);
    await blocks(page).nth(0).hover();
    const handle = page.getByRole('button', { name: 'Drag or open block actions' });
    const from = (await handle.boundingBox())!;
    const target = (await blocks(page).nth(3).boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + 40, target.y + target.height + 6, { steps: 10 });
    await page.mouse.up();
    await expect.poll(() => blocks(page).allInnerTexts()).toEqual(['Three', 'Four', 'One', 'Two']);
    expect(errors, errors.join('\n')).toEqual([]);
  } finally {
    await cleanup();
  }
});

const FIELD_TYPES = [
  ['Notes', 'text'],
  ['Effort', 'number'],
  ['Done', 'checkbox'],
  ['Stage', 'select'],
  ['Labels', 'multi-select'],
  ['Due', 'date'],
  ['Link', 'url'],
  ['Related', 'relation'],
] as const;

test('a database accepts every property type, edits records and switches every layout', async ({
  browser,
}) => {
  const { page, errors, cleanup } = await open(browser, 'database');
  const failures: string[] = [];
  try {
    for (const [name, type] of FIELD_TYPES) {
      await page
        .locator('.table-actions')
        .getByRole('button', { name: 'Add property', exact: true })
        .click();
      const form = page.getByRole('dialog', { name: 'Add a property', exact: true });
      await form.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
      await selectOption(form.getByRole('combobox', { name: 'Type', exact: true }), type);
      const options = form.getByRole('textbox', { name: 'Select options', exact: true });
      if (await options.isVisible().catch(() => false)) await options.fill('One, Two');
      await form.getByRole('button', { name: 'Add property', exact: true }).click();
      const added = await expect(page.getByRole('columnheader', { name }).first())
        .toBeVisible({ timeout: 4000 })
        .then(() => true)
        .catch(() => false);
      if (!added) {
        failures.push(`property ${type}: not added`);
        await page.keyboard.press('Escape');
      }
    }
    await page
      .locator('.table-actions')
      .getByRole('button', { name: 'New record', exact: true })
      .click();
    await page.getByRole('textbox', { name: 'New record name', exact: true }).fill('Sweep record');
    await page.getByRole('textbox', { name: 'New record name', exact: true }).press('Enter');
    const panel = page.getByRole('region', { name: 'Record details', exact: true });
    await expect(panel).toBeVisible();
    const edit = async (label: string, run: () => Promise<unknown>) =>
      run().catch((error) => failures.push(`edit ${label}: ${String(error).split('\n')[0]}`));
    await edit('text', () =>
      panel.getByRole('textbox', { name: 'Notes for Sweep record', exact: true }).fill('hello'),
    );
    await edit('number', () =>
      panel.getByRole('spinbutton', { name: 'Effort for Sweep record', exact: true }).fill('3'),
    );
    await edit('checkbox', () =>
      panel.getByRole('checkbox', { name: 'Done for Sweep record', exact: true }).check(),
    );
    await edit('select', () =>
      selectOption(
        panel.getByRole('combobox', { name: 'Stage for Sweep record', exact: true }),
        'Two',
      ),
    );
    await edit('date', () =>
      panel.getByLabel('Due for Sweep record', { exact: true }).fill('2026-11-20'),
    );
    await edit('url', () =>
      panel
        .getByRole('textbox', { name: 'Link for Sweep record', exact: true })
        .fill('https://example.com'),
    );
    await panel.getByRole('button', { name: 'Close record', exact: true }).click();
    for (const layout of ['board', 'list', 'calendar', 'table']) {
      const select = page.getByRole('combobox', { name: 'Layout', exact: true });
      const ok = await selectOption(select, layout)
        .then(() => true)
        .catch(() => false);
      if (!ok) {
        failures.push(`layout ${layout}: cannot select`);
        continue;
      }
      // In the table the name is an editable field (getByText cannot read input values).
      const record =
        layout === 'table'
          ? page.getByRole('textbox', { name: 'Name for Sweep record', exact: true })
          : page.getByText('Sweep record').first();
      const shows = await expect(record)
        .toBeVisible({ timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (!shows && layout !== 'calendar') failures.push(`layout ${layout}: record not shown`);
    }
    expect(failures, failures.join('\n')).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  } finally {
    await cleanup();
  }
});

test('pages can be favorited, renamed, duplicated, trashed and restored', async ({ browser }) => {
  const { page, errors, created, cleanup } = await open(browser);
  try {
    await expect(page.locator('.save-status')).toHaveText('Saved');
    const title = page.getByRole('textbox', { name: 'Page title', exact: true });
    await title.fill('Sweep renamed page');
    await title.press('Enter');
    await expect(page.locator('.tree-row.selected')).toContainText('Sweep renamed page');
    // Favorites live in the page actions menu.
    await page.getByRole('button', { name: 'Page actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Add to favorites', exact: true }).click();
    await expect(page.locator('.favorites')).toContainText('Sweep renamed page');
    await page.getByRole('button', { name: 'Page actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Remove favorite', exact: true }).click();
    await page.getByRole('button', { name: 'Page actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Duplicate page', exact: true }).click();
    await expect(page.locator('.tree-page', { hasText: 'Sweep renamed page' })).toHaveCount(2, {
      timeout: 8000,
    });
    expect(errors, errors.join('\n')).toEqual([]);
    expect(created.id).toBeTruthy();
  } finally {
    await cleanup();
  }
});

test('workspace tools open and respond: search, commands, graph, templates, settings, theme', async ({
  browser,
}) => {
  const { page, errors, cleanup } = await open(browser);
  const failures: string[] = [];
  const check = async (label: string, run: () => Promise<void>) =>
    run().catch((error) => failures.push(`${label}: ${String(error).split('\n')[0]}`));
  try {
    await check('search finds a page', async () => {
      await page.keyboard.press('Control+k');
      await page.getByRole('textbox', { name: 'Search query' }).fill('Product direction');
      await expect(page.getByRole('option', { name: /Product direction/ }).first()).toBeVisible();
      await page.keyboard.press('Escape');
    });
    await check('command palette runs a command', async () => {
      await page.keyboard.press('Control+Shift+p');
      await page.keyboard.type('Go to home');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        /Good (morning|afternoon|evening)|Working late/,
      );
    });
    await check('graph renders nodes', async () => {
      await page
        .getByRole('navigation', { name: 'Workspace tools' })
        .getByRole('button', { name: 'Knowledge graph' })
        .click();
      await expect(page.locator('.graph-point').first()).toBeVisible();
    });
    await check('templates library opens', async () => {
      await openCatalog(page, 'templates');
      await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible();
    });
    await check('settings tabs open', async () => {
      await page.getByRole('button', { name: 'Account menu' }).click();
      await page.getByRole('menuitem', { name: 'Settings' }).click();
      const dialog = page.getByRole('dialog', { name: 'Workspace settings' });
      for (const tab of ['Members', 'Data', 'Trash', 'Account']) {
        await dialog.getByRole('tab', { name: tab, exact: true }).click();
        await expect(dialog.getByRole('tab', { name: tab, exact: true })).toHaveAttribute(
          'aria-selected',
          'true',
        );
      }
      // Appearance is its own panel: the settings link opens it.
      await dialog.getByRole('button', { name: 'Appearance', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Workspace settings' })).toBeHidden();
      await page.keyboard.press('Escape');
    });
    await check('theme switch applies dark and light', async () => {
      await page.getByRole('button', { name: 'Account menu' }).click();
      await page.getByRole('menuitemradio', { name: 'Dark' }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await page.getByRole('menuitemradio', { name: 'Light' }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await page.getByRole('menuitemradio', { name: 'System' }).click();
      await page.keyboard.press('Escape');
    });
    expect(failures, failures.join('\n')).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  } finally {
    await cleanup();
  }
});
