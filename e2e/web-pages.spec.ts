import { APP_ORIGIN } from './origin.js';
import { test, expect } from './test.js';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { unzipSync, strFromU8 } from 'fflate';
const headers = { 'x-note-request': '1' };
const file = (path: string, text: string) => ({
  type: 'webFile',
  attrs: { path, id: crypto.randomUUID() },
  content: text ? [{ type: 'text', text }] : [],
});

test('creates a web page directly from commands and inserts a website component without replacing note content', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json(),
    page = await context.newPage();
  let created: string | undefined, noteId: string | undefined;
  try {
    await page.goto('/#ea293f81-c7fa-4551-9da5-58b8af0510a9/document');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.keyboard.press('Control+Shift+p');
    await page.getByRole('combobox', { name: 'Search commands', exact: true }).fill('New document');
    await page.keyboard.press('Enter');
    await expect(page.locator('.web-authoring-page')).toBeVisible();
    created = page.url().split('#')[1].split('/')[0];
    expect(created).not.toBe('ea293f81-c7fa-4551-9da5-58b8af0510a9');
    const site = page.locator('.web-authoring-page');
    // A new Document opens in the visual editor, with no code, split or preview switch.
    await expect(site.getByLabel('Document canvas')).toBeVisible();
    await expect(site.locator('.vb-page h1')).toBeVisible();
    await expect(site.getByRole('button', { name: 'Code', exact: true })).toHaveCount(0);
    const title = site.getByRole('textbox', { name: 'Page title', exact: true });
    await title.fill('My own website');
    await title.press('Tab');
    const note = await (
      await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
        headers,
        data: {
          title: 'A note with a website',
          requestId: crypto.randomUUID(),
          content: {
            type: 'doc',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Keep this original note.' }] },
            ],
          },
        },
      })
    ).json();
    noteId = note.id;
    await page.goto(`/#${note.id}/document`);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Add a block', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Web component', exact: true }).click();
    const component = page.locator('.web-authoring-component');
    await expect(component).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Page content', exact: true })).toContainText(
      'Keep this original note.',
    );
    await component.getByRole('button', { name: 'Code', exact: true }).click();
    const source = component.getByRole('textbox', { name: 'index.html source', exact: true });
    await expect(source).toBeVisible();
    await source.press('Control+End');
    await page.keyboard.insertText('\n<h2>My interactive corner</h2>');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await component.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(
      component
        .frameLocator('iframe')
        .getByRole('heading', { name: 'My interactive corner', exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Page content', exact: true })).toContainText(
      'Keep this original note.',
    );
    await expect(component).toBeVisible();
  } finally {
    for (const id of [created, noteId].filter(Boolean))
      await context.request.delete(`/api/pages/${id}`, { headers });
    await context.close();
  }
});
test('a real website edits canonical files, runs modules and interactions, stays isolated, and reloads durably', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  expect(
    (
      await context.request.post('/api/auth/sign-in/email', {
        data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
        headers: { origin: APP_ORIGIN },
      })
    ).ok(),
  ).toBe(true);
  const session = await (await context.request.get('/api/session')).json();
  const html =
    '<!doctype html><html lang="en"><head><link rel="stylesheet" href="./styles.css"><script type="module" src="./main.js"></script></head><body><h1>Website proof</h1><button>Count a thought</button><output id="count">0</output><p id="isolation"></p></body></html>';
  const script =
    'import { next } from "./lib/helpers.js";\nconst literal = "</script>";\ndocument.querySelector("button").onclick = () => document.querySelector("#count").textContent = next(Number(document.querySelector("#count").textContent));\ntry { parent.document.body; document.querySelector("#isolation").textContent="Unprotected"; } catch { document.querySelector("#isolation").textContent="Parent access blocked"; }';
  const response = await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    headers,
    data: {
      title: 'A live website',
      requestId: crypto.randomUUID(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'webPage',
            attrs: { version: 1, entry: 'index.html' },
            content: [
              file('index.html', html),
              file(
                'styles.css',
                'body { background: #172b3a; color: white; padding: 30px; font: 18px Arial; }',
              ),
              file('main.js', script),
              file('lib/helpers.js', 'export const next = n => n + 1;'),
            ],
          },
        ],
      },
    },
  });
  expect(response.ok()).toBe(true);
  const note = await response.json(),
    page = await context.newPage();
  try {
    await page.goto(`/#${note.id}/document`);
    const workspace = page.locator('.web-authoring-page'),
      frame = page.frameLocator('iframe[title="Rendered document"]');
    await expect(workspace).toBeVisible();
    const source = workspace.getByRole('textbox', { name: 'index.html source', exact: true });
    await expect(source).toContainText('Website proof');
    await expect(frame.getByRole('heading', { name: 'Website proof', exact: true })).toBeVisible();
    await expect(frame.locator('#isolation')).toHaveText('Parent access blocked');
    await frame.getByRole('button', { name: 'Count a thought', exact: true }).click();
    await expect(frame.locator('#count')).toHaveText('1');
    await workspace.getByRole('button', { name: 'Code', exact: true }).click();
    await source.press('Control+End');
    await page.keyboard.insertText('\n<p id="durable">A new durable section.</p>');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await workspace.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(frame.locator('#durable')).toHaveText('A new durable section.');
    await workspace.getByRole('button', { name: 'Stop document', exact: true }).click();
    await expect(page.locator('iframe[title="Rendered document"]')).toHaveCount(0);
    await workspace.getByRole('button', { name: 'Add source file', exact: true }).click();
    await workspace.getByRole('textbox', { name: 'File path', exact: true }).fill('data.json');
    await workspace.getByRole('button', { name: 'Add file', exact: true }).click();
    const json = workspace.getByRole('textbox', { name: 'data.json source', exact: true });
    await expect(json).toBeVisible();
    await json.pressSequentially('{"message":"Exact source"}');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.reload();
    await workspace.getByRole('tab', { name: 'data.json', exact: true }).click();
    await expect(
      workspace.getByRole('textbox', { name: 'data.json source', exact: true }),
    ).toContainText('Exact source');
    await workspace.getByRole('tab', { name: 'index.html', exact: true }).click();
    await expect(
      workspace.getByRole('textbox', { name: 'index.html source', exact: true }),
    ).toContainText('A new durable section.');
    await page.setViewportSize({ width: 390, height: 844 });
    await workspace.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(frame.locator('#durable')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  } finally {
    await context.request.delete(`/api/pages/${note.id}`, { headers });
    await context.close();
  }
});

test('two source editors merge an offline draft and retain independent undo while live viewer access is enforced', async ({
  browser,
}) => {
  const alice = await browser.newContext({ baseURL: APP_ORIGIN }),
    bob = await browser.newContext({ baseURL: APP_ORIGIN });
  for (const [context, email] of [
    [alice, 'jonathan@note.test'],
    [bob, 'amelia@note.test'],
  ] as const) {
    expect(
      (
        await context.request.post('/api/auth/sign-in/email', {
          data: { email, password: 'Note-local-demo-2026' },
          headers: { origin: APP_ORIGIN },
        })
      ).ok(),
    ).toBe(true);
  }
  const session = await (await alice.request.get('/api/session')).json(),
    workspaceId = session.workspaces[0].id;
  const members = await (await alice.request.get(`/api/workspaces/${workspaceId}/members`)).json(),
    amelia = members.find((member: { email: string }) => member.email === 'amelia@note.test');
  const role = async (value: string) =>
    expect(
      (
        await alice.request.patch(`/api/workspaces/${workspaceId}/members/${amelia.id}`, {
          headers,
          data: { role: value },
        })
      ).ok(),
    ).toBe(true);
  await role('editor');
  const note = await (
    await alice.request.post(`/api/workspaces/${workspaceId}/pages`, {
      headers,
      data: {
        title: 'Collaborative website source',
        requestId: crypto.randomUUID(),
        content: {
          type: 'doc',
          content: [
            {
              type: 'webPage',
              attrs: { version: 1, entry: 'index.html' },
              content: [file('index.html', '<!doctype html><h1>Shared source</h1>')],
            },
          ],
        },
      },
    })
  ).json();
  let first = await alice.newPage();
  const second = await bob.newPage();
  try {
    await first.goto(`/#${note.id}/document`);
    await second.goto(`/#${note.id}/document`);
    const sourceA = () => first.getByRole('textbox', { name: 'index.html source', exact: true }),
      sourceB = second.getByRole('textbox', { name: 'index.html source', exact: true });
    await expect(sourceA()).toBeVisible();
    await expect(sourceB).toBeVisible();
    await expect(first.locator('.save-status')).toHaveText('Saved');
    await expect(second.locator('.save-status')).toHaveText('Saved');
    await alice.setOffline(true);
    await first.evaluate(() => window.dispatchEvent(new Event('offline')));
    await sourceA().press('Control+End');
    await first.keyboard.insertText('\n<!-- Alice offline -->');
    await expect(first.locator('.save-status')).toHaveText('Saved locally');
    await sourceB.press('Control+End');
    await second.keyboard.insertText('\n<!-- Amelia online -->');
    await expect(second.locator('.save-status')).toHaveText('Saved');
    await first.close();
    await alice.setOffline(false);
    first = await alice.newPage();
    await first.goto(`/#${note.id}/document`);
    await expect(sourceA()).toContainText('Alice offline');
    await expect(sourceA()).toContainText('Amelia online');
    await expect(sourceB).toContainText('Alice offline');
    await expect(first.locator('.save-status')).toHaveText('Saved');
    await sourceA().press('Control+End');
    await first.keyboard.insertText('\n<!-- Alice local undo -->');
    await expect(first.locator('.save-status')).toHaveText('Saved');
    await sourceB.press('Control+End');
    await second.keyboard.insertText('\n<!-- Keep Amelia edit -->');
    await expect(sourceA()).toContainText('Keep Amelia edit');
    await sourceA().press('Control+z');
    await expect(sourceA()).not.toContainText('Alice local undo');
    await expect(sourceA()).toContainText('Keep Amelia edit');
    await expect(sourceB).not.toContainText('Alice local undo');
    await role('viewer');
    await expect(sourceB).toHaveAttribute('aria-readonly', 'true');
    const before = await sourceB.innerText();
    await sourceB.pressSequentially('Do not persist this');
    await expect.poll(() => sourceB.innerText()).toBe(before);
    await role('editor');
    await expect(sourceB).toHaveAttribute('aria-readonly', 'false');
    await sourceB.press('Control+End');
    await second.keyboard.insertText('\n<!-- Editing restored -->');
    await expect(sourceA()).toContainText('Editing restored');
    await expect(second.locator('.save-status')).toHaveText('Saved');
  } finally {
    await role(amelia.role);
    await alice.request.delete(`/api/pages/${note.id}`, { headers });
    await Promise.all([alice.close(), bob.close()]);
  }
});

test('website media retains a failed original, retries once and stays readable after an independent page copy', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json();
  const result = await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    headers,
    data: {
      title: 'Website media',
      requestId: crypto.randomUUID(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'webPage',
            attrs: { version: 1, entry: 'index.html' },
            content: [
              file('index.html', '<!doctype html><html><body><h1>Media</h1></body></html>'),
            ],
          },
        ],
      },
    },
  });
  expect(result.ok()).toBe(true);
  const note = await result.json(),
    page = await context.newPage();
  let duplicate: string | undefined;
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  );
  try {
    await page.goto(`/#${note.id}/document`);
    const editor = page.locator('.web-authoring-page');
    await expect(
      editor.getByRole('textbox', { name: 'index.html source', exact: true }),
    ).toBeVisible();
    let rejected = false;
    await page.route('**/api/attachments/*/content', (route) => {
      if (!rejected && route.request().method() === 'PUT') {
        rejected = true;
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'A recoverable media failure' }),
        });
      }
      return route.continue();
    });
    await editor
      .locator('input[type=file]')
      .setInputFiles({ name: 'A meaningful picture.png', mimeType: 'image/png', buffer: png });
    await expect(editor.locator('.upload-failure')).toContainText('A meaningful picture.png');
    await expect(editor.getByRole('link', { name: 'Save original', exact: true })).toHaveAttribute(
      'href',
      /^blob:/,
    );
    await editor.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(editor.locator('.upload-failure')).toHaveCount(0);
    await expect(
      editor.getByRole('textbox', { name: 'index.html source', exact: true }),
    ).toContainText('.note/assets/');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await editor.getByRole('button', { name: 'Run', exact: true }).click();
    const frame = page.frameLocator('iframe[title="Rendered document"]');
    await expect(
      frame.getByRole('img', { name: 'A meaningful picture.png', exact: true }),
    ).toBeVisible();
    expect(
      await frame.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth),
    ).toBe(1);
    const downloaded = page.waitForEvent('download');
    await editor.getByRole('button', { name: 'Export document', exact: true }).click();
    const path = await (await downloaded).path();
    expect(path).toBeTruthy();
    const exported = unzipSync(await readFile(path!));
    expect(strFromU8(exported['index.html'])).toContain('.note/assets/');
    const assetPath = Object.keys(exported).find((name) => name.startsWith('.note/assets/'))!;
    expect(Buffer.from(exported[assetPath])).toEqual(png);
    const server = createServer((request, response) => {
      const name =
        decodeURIComponent(new URL(request.url!, 'http://static.test').pathname).slice(1) ||
        'index.html';
      if (!Object.hasOwn(exported, name)) {
        response.writeHead(404).end();
        return;
      }
      response.setHeader(
        'Content-Type',
        name.endsWith('.html') ? 'text/html' : 'application/octet-stream',
      );
      response.end(exported[name]);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Static test server did not start.');
    const independent = await browser.newContext();
    try {
      const standalone = await independent.newPage();
      await standalone.goto(`http://127.0.0.1:${address.port}/index.html`);
      await expect(
        standalone.getByRole('img', { name: 'A meaningful picture.png', exact: true }),
      ).toBeVisible();
      expect(
        await standalone
          .locator('img')
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      ).toBe(1);
    } finally {
      await independent.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    const copy = await context.request.post(`/api/pages/${note.id}/duplicate`, {
      headers,
      data: { requestId: crypto.randomUUID(), expectedUserId: session.user.id },
    });
    expect(copy.ok()).toBe(true);
    duplicate = (await copy.json()).id;
    await page.goto(`/#${duplicate}/document`);
    await expect(
      frame.getByRole('img', { name: 'A meaningful picture.png', exact: true }),
    ).toBeVisible();
    expect(
      await frame.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth),
    ).toBe(1);
  } finally {
    await context.request.delete(`/api/pages/${note.id}`, { headers });
    if (duplicate) await context.request.delete(`/api/pages/${duplicate}`, { headers });
    await context.close();
  }
});
