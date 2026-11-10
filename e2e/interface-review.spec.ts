import { APP_ORIGIN } from './origin.js';
import { expect, test, type Browser } from './test.js';

// Regressions found by using the app in real Chrome and reading the screenshots.
async function open(browser: Browser, options: Parameters<Browser['newContext']>[0] = {}) {
  const context = await browser.newContext({ baseURL: APP_ORIGIN, ...options });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json();
  const workspace = session.workspaces[0].id as string;
  const create = async (title: string) =>
    (
      await context.request.post(`/api/workspaces/${workspace}/pages`, {
        data: { title },
        headers: { 'x-note-request': '1' },
      })
    ).json() as Promise<{ id: string }>;
  return { context, create, page: await context.newPage() };
}
const outline = (element: Element) => getComputedStyle(element).outlineStyle;

test('writing surfaces and text fields never draw a focus frame, buttons still do', async ({
  browser,
}) => {
  const { context, create, page } = await open(browser);
  const note = await create(`Focus frame ${Date.now()}`);
  await page.goto(`/#${note.id}/document`);
  const editor = page.getByRole('textbox', { name: 'Page content', exact: true });
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await editor.click();
  await expect(editor).toBeFocused();
  expect(await editor.evaluate(outline)).toBe('none');
  await page.keyboard.type('/');
  const search = page.getByRole('textbox', { name: 'Find block type' });
  await expect(search).toBeFocused();
  expect(await search.evaluate(outline)).toBe('none');
  await page.keyboard.press('Escape');
  // Keyboard focus on a control keeps its visible ring.
  const details = page.getByRole('button', { name: 'Open page details', exact: true });
  await details.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(details).toBeFocused();
  expect(await details.evaluate(outline)).toBe('solid');
  await context.close();
});

test('the block menu keeps filtering after arrow navigation, ignores accents and shows an empty state', async ({
  browser,
}) => {
  const { context, create, page } = await open(browser);
  const note = await create(`Block menu ${Date.now()}`);
  await page.goto(`/#${note.id}/document`);
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await page.evaluate(() => localStorage.setItem('mosaic:locale', 'pt-BR'));
  await page.reload();
  const localized = page.getByRole('textbox', { name: 'Conteúdo da página', exact: true });
  await expect(page.locator('.save-status')).toHaveText('Salvo');
  await localized.click();
  await page.keyboard.type('/');
  const menu = page.getByRole('menu', { name: 'Adicionar um bloco', exact: true });
  const search = menu.getByRole('textbox');
  await expect(search).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(search).not.toBeFocused();
  // No accent typed: "titulo" still finds "Título 1…3".
  await page.keyboard.type('titulo');
  await expect(search).toHaveValue('titulo');
  await expect(menu.getByRole('menuitem')).toHaveText([/Título 1/, /Título 2/, /Título 3/]);
  await page.keyboard.type('zzz');
  await expect(menu.getByRole('menuitem')).toHaveCount(0);
  await expect(menu).toContainText('Nenhum bloco encontrado.');
  await search.fill('tabela');
  await page.keyboard.press('Enter');
  await expect(localized.locator('table')).toBeVisible();
  await context.close();
});

test('graph counts read as words and a phone page fills the screen', async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.goto('/#/graph');
  await expect(page.locator('.bar-hint')).toHaveText(/^\d+ pages? · \d+ connections?/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/home');
  await expect(page.locator('.workspace-main')).toBeVisible();
  // On a phone the page fills the screen: no sidebar-colored backdrop around the document.
  const main = page.locator('.workspace-main');
  const colors = await main.evaluate((element) => [
    getComputedStyle(element).backgroundColor,
    getComputedStyle(document.querySelector('.sidebar-panel')!).backgroundColor,
  ]);
  expect(colors[0]).not.toBe('rgba(0, 0, 0, 0)');
  expect(colors[0]).not.toBe(colors[1]);
  await context.close();
});

test('a Portuguese browser opens the app in Portuguese until a language is chosen', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN, locale: 'pt-BR' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boas-vindas de volta' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await page.getByRole('combobox', { name: 'Idioma', exact: true }).click();
  await page.getByRole('option', { name: 'English (US)', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await context.close();
});

test('the link picker takes the first match with Enter and an unlabeled connection stays unmasked', async ({
  browser,
}) => {
  const { context, page } = await open(browser);
  const session = await (await context.request.get('/api/session')).json();
  const canvas = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Link picker ${Date.now()}`, kind: 'canvas' },
      headers: { 'x-note-request': '1' },
    })
  ).json();
  await page.goto(`/#${canvas.id}/canvas`);
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await page.getByRole('button', { name: 'Link page', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Connect an idea' });
  await picker.getByRole('textbox').fill('Reading room');
  await expect(picker.getByRole('button', { name: 'Reading room', exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(picker).toBeHidden();
  await expect(page.locator('[data-canvas-card]').filter({ hasText: 'Reading room' })).toHaveCount(
    1,
  );
  await page.getByRole('button', { name: 'Link page', exact: true }).click();
  await picker.getByRole('textbox').fill('no page has this title 91827');
  await expect(picker).toContainText('No matching pages.');
  await context.close();
});

test('an invitation link explains the sign-in step', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  const page = await context.newPage();
  await page.goto('/?invite=00000000-0000-4000-8000-000000000000');
  await expect(
    page.getByText('Sign in or create an account to accept your invitation.'),
  ).toBeVisible();
  await context.close();
});

test('a collaborator change arriving right after a caret move keeps the caret where it was moved', async ({
  browser,
}) => {
  const { context, create, page } = await open(browser);
  const note = await create(`Caret race ${Date.now()}`);
  await page.goto(`/#${note.id}/document`);
  await expect(page.locator('.save-status')).toHaveText('Saved');
  const editor = page.getByRole('textbox', { name: 'Page content', exact: true });
  await editor.click();
  await page.keyboard.type('first');
  await page.keyboard.press('Enter');
  await page.keyboard.type('second');
  await page.keyboard.press('Control+Home');
  await expect(page.locator('.save-status')).toHaveText('Saved');
  const paragraph = await editor.evaluate((root) => {
    type Collaboration = { name: string; options: { document: import('yjs').Doc } };
    const tiptap = (
      root as HTMLElement & {
        editor: { extensionManager: { extensions: Collaboration[] } };
      }
    ).editor;
    const doc = tiptap.extensionManager.extensions.find((e) => e.name === 'collaboration')!.options
      .document;
    const paragraphs = [...root.querySelectorAll('p')];
    // The browser moves the caret first (a click or an arrow key)...
    const range = document.createRange();
    range.setStart(paragraphs[1].firstChild!, 2);
    range.collapse(true);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    // ...and a collaborator's edit lands before the editor reads it.
    doc.transact(() => {
      const first = doc.getXmlFragment('default').get(0) as import('yjs').XmlElement;
      (first.get(0) as import('yjs').XmlText).insert(0, 'Z');
    }, 'collaborator');
    const node = getSelection()!.anchorNode;
    const element = node instanceof Element ? node : node?.parentElement;
    return paragraphs.indexOf(element!.closest('p')!);
  });
  expect(paragraph).toBe(1);
  await page.keyboard.type('!');
  await expect(editor.locator('p').nth(1)).toHaveText('se!cond');
  await context.close();
});

test('media inserted into a website goes inside the body of its entry page', async ({
  browser,
}) => {
  const { context, page } = await open(browser);
  const session = await (await context.request.get('/api/session')).json();
  const html = '<!doctype html>\n<html>\n<body>\n  <h1>Media</h1>\n</body>\n</html>\n';
  const site = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      headers: { 'x-note-request': '1' },
      data: {
        title: `Media placement ${Date.now()}`,
        requestId: crypto.randomUUID(),
        content: {
          type: 'doc',
          content: [
            {
              type: 'webPage',
              attrs: { version: 1, entry: 'index.html' },
              content: [
                {
                  type: 'webFile',
                  attrs: { path: 'index.html', id: crypto.randomUUID() },
                  content: [{ type: 'text', text: html }],
                },
              ],
            },
          ],
        },
      },
    })
  ).json();
  await page.goto(`/#${site.id}/document`);
  const authoring = page.locator('.web-authoring-page');
  const source = authoring.getByRole('textbox', { name: 'index.html source', exact: true });
  await expect(source).toBeVisible();
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  );
  await authoring
    .locator('input[type=file]')
    .setInputFiles({ name: 'picture.png', mimeType: 'image/png', buffer: png });
  await expect(source).toContainText('<img src=');
  const text = await source.innerText();
  expect(text.indexOf('<img src=')).toBeLessThan(text.indexOf('</body>'));
  expect(text.indexOf('<img src=')).toBeGreaterThan(text.indexOf('<h1>'));
  await context.close();
});

test('a database header never shows the page chips left over from the previous document', async ({
  browser,
}) => {
  const { context, page } = await open(browser);
  await page.goto('/#/all');
  await page.getByRole('button', { name: 'Product direction', exact: true }).first().click();
  await expect(page.locator('.page-meta')).toContainText(/\d+backlinks?/);
  await page.locator('.sidebar').getByText('Research', { exact: true }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Research' }).or(page.locator('.page-title')),
  ).toBeVisible();
  await expect(page.locator('.page-meta')).not.toContainText('backlink');
  await context.close();
});

test('home cards stay readable beside a side panel and settings tabs fit a phone', async ({
  browser,
}) => {
  const { context, page } = await open(browser);
  await page.goto('/#/home');
  await expect(page.locator('.home')).toBeVisible();
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Appearance', exact: true }).click();
  await expect(page.locator('.appearance-panel, [aria-label="Appearance"]').first()).toBeVisible();
  const widths = await page
    .locator('.home-continue > li')
    .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().width));
  if (widths.length) expect(Math.min(...widths)).toBeGreaterThanOrEqual(180);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/home');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  const dialog = (await page.getByRole('dialog').boundingBox())!;
  for (const control of [
    page.getByRole('button', { name: /Appearance/ }),
    page.getByRole('tab', { name: 'Account', exact: true }),
  ]) {
    const box = (await control.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(dialog.x + dialog.width);
  }
  await context.close();
});

test('the page rail stays a labelled list to the right of the text at every width, also on hover', async ({
  browser,
}) => {
  const { context, page } = await open(browser);
  // The seeded "Product direction" has headings and pages that cite it.
  const session = await (await context.request.get('/api/session')).json();
  const listed = await (
    await context.request.get(`/api/workspaces/${session.workspaces[0].id}/pages`)
  ).json();
  const direction = (Array.isArray(listed) ? listed : listed.pages).find(
    (item: { title: string }) => item.title === 'Product direction',
  );
  await page.goto(`/#${direction.id}`);
  await expect(page.locator('.connection-thread .thread-tick').first()).toBeAttached();
  for (const width of [1440, 1280, 1180, 1024]) {
    await page.setViewportSize({ width, height: 860 });
    const rail = page.locator('.connection-thread');
    const column = (await page.locator('.document-canvas').boundingBox())!;
    // A collapsed, zero-width thread also counts as invisible to isVisible(), so ask for display.
    if ((await rail.evaluate((element) => getComputedStyle(element).display)) === 'none') {
      // Without room the rail steps aside entirely; it never becomes a bare thread.
      continue;
    }
    await expect(rail.getByRole('heading', { name: 'On this page' })).toBeVisible();
    const labels = rail.locator('.thread-label');
    for (const label of await labels.all()) {
      const box = (await label.boundingBox())!;
      expect(box.width, `label visible at ${width}`).toBeGreaterThan(20);
      expect(
        await label.evaluate((element) => Number(getComputedStyle(element).opacity)),
        `label readable without hover at ${width}`,
      ).toBe(1);
      expect(box.x, `label right of the text at ${width}`).toBeGreaterThanOrEqual(
        column.x + column.width + 24,
      );
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    const knot = rail.locator(':is(.thread-tick, .thread-knot)').first();
    const before = (await knot.locator('.thread-label').boundingBox())!;
    await knot.hover();
    const after = (await knot.locator('.thread-label').boundingBox())!;
    expect(after.x, `hover keeps the label in place at ${width}`).toBeCloseTo(before.x, 0);
  }
  await context.close();
});

test('moving between pages never flashes a loading message, a connecting status or a wrong count', async ({
  browser,
}) => {
  const { context, page } = await open(browser);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/home');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Let the idle preloading finish, as it has for anyone who has used the app for a second.
  await page.waitForTimeout(1500);
  const record = () =>
    page.evaluate(() => {
      const shown = (element: Element) => Number(getComputedStyle(element).opacity) > 0.05;
      const seen = new Set<string>();
      const chips = new Map<string, Set<string>>();
      const w = window as unknown as { __stop: () => string[] };
      let run = true;
      const loop = () => {
        for (const element of document.querySelectorAll('.loading-note, .save-status.connecting'))
          if (shown(element)) seen.add(element.textContent?.trim() ?? '');
        const rail = document.querySelector('.connection-thread'),
          column = document.querySelector('.document-canvas');
        if (rail && column && shown(rail)) {
          const railBox = rail.getBoundingClientRect();
          if (railBox.width && railBox.left < column.getBoundingClientRect().right)
            seen.add(`rail over the text at x${Math.round(railBox.left)}`);
        }
        const title = (document.querySelector('.page-title') as HTMLTextAreaElement | null)?.value;
        const links = [...document.querySelectorAll('.page-meta > span')]
          .map((element) => element.textContent ?? '')
          .find((text) => /backlink/.test(text));
        if (title && links) chips.set(title, (chips.get(title) ?? new Set()).add(links));
        if (run) requestAnimationFrame(loop);
      };
      loop();
      w.__stop = () => {
        run = false;
        return [
          ...seen,
          ...[...chips]
            .filter(([, values]) => values.size > 1)
            .map(([title]) => `count of ${title}`),
        ];
      };
    });
  const tree = page.getByRole('complementary', { name: 'Workspace navigation' });
  for (const title of ['Product direction', 'Meeting notes', 'Getting started']) {
    await record();
    await tree.getByRole('button', { name: title, exact: true }).first().click();
    await expect(page.getByRole('textbox', { name: 'Page title' })).toHaveValue(title);
    await expect(page.locator('.note-editor[role="textbox"]')).not.toBeEmpty();
    await page.waitForTimeout(400);
    const flashes = await page.evaluate(() =>
      (window as unknown as { __stop: () => string[] }).__stop(),
    );
    expect(flashes, `opening ${title}`).toEqual([]);
  }
  await context.close();
});
