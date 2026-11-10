import { APP_ORIGIN } from './origin.js';
import { test, expect, type Browser } from './test.js';
async function setup(browser: Browser) {
  const context = await browser.newContext({
      baseURL: APP_ORIGIN,
      permissions: ['clipboard-read', 'clipboard-write'],
    }),
    headers = { 'x-note-request': '1' };
  await context.request.post('/api/auth/sign-in/email', {
    headers: { origin: APP_ORIGIN },
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
  });
  const session = await (await context.request.get('/api/session')).json();
  const content = {
    type: 'doc',
    content: [
      {
        type: 'canvasRoot',
        content: [
          {
            type: 'canvasCard',
            attrs: { id: 'existing' },
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Keep this existing note.' }] },
            ],
          },
        ],
      },
    ],
  };
  const response = await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    headers,
    data: {
      title: 'Canvas capture verification',
      kind: 'canvas',
      visibility: 'private',
      requestId: crypto.randomUUID(),
      content,
    },
  });
  expect(response.ok()).toBe(true);
  const canvas = await response.json(),
    page = await context.newPage();
  return { context, canvas, page, headers };
}

test('native stage paste and file drop create independent rich notes without changing the selected note', async ({
  browser,
}) => {
  const { context, canvas, page, headers } = await setup(browser);
  try {
    await page.goto(`/#${canvas.id}/canvas`);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page
      .locator('[data-canvas-card="existing"]')
      .getByRole('textbox', { name: 'Note content', exact: true })
      .click();
    await page.locator('.canvas-stage').click({ position: { x: 30, y: 30 } });
    await page.evaluate(async () =>
      navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob(
            ['<h2>Captured research</h2><p>A <strong>structured</strong> idea.</p>'],
            { type: 'text/html' },
          ),
          'text/plain': new Blob(['Captured research\nA structured idea.'], { type: 'text/plain' }),
        }),
      ]),
    );
    await page.keyboard.press('Control+v');
    await expect(page.locator('[data-canvas-card]')).toHaveCount(2);
    await expect(page.locator('[data-canvas-card="existing"]')).toContainText(
      'Keep this existing note.',
    );
    await expect(
      page.getByRole('heading', { name: 'Captured research', exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-canvas-card] strong')).toHaveText('structured');
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    await page.evaluate((value) => {
      const data = new DataTransfer();
      data.items.add(
        new File(
          [Uint8Array.from(atob(value), (ch) => ch.charCodeAt(0))],
          'Dropped reference.png',
          { type: 'image/png' },
        ),
      );
      const stage = document.querySelector('.canvas-stage')!,
        box = stage.getBoundingClientRect();
      stage.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: data,
          clientX: box.left + 60,
          clientY: box.top + 80,
        }),
      );
    }, png);
    await expect(page.locator('[data-canvas-card]')).toHaveCount(3);
    const image = page.getByRole('img', { name: 'Dropped reference.png', exact: true });
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((image) => (image as HTMLImageElement).naturalWidth))
      .toBe(1);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.reload();
    await expect(page.locator('[data-canvas-card]')).toHaveCount(3);
    await expect(image).toBeVisible();
    await expect(page.locator('[data-canvas-card="existing"]')).toContainText(
      'Keep this existing note.',
    );
  } finally {
    await context.request.delete(`/api/pages/${canvas.id}`, { headers }).catch(() => {});
    await context.close();
  }
});

for (const removeTarget of [false, true])
  test(
    removeTarget
      ? 'deleting a pending capture retains its original and offers an actual retry'
      : 'a delayed embedded image stays in its captured note while typing continues elsewhere',
    async ({ browser }) => {
      const { context, canvas, page, headers } = await setup(browser);
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let waiting = false;
      await page.route('**/api/attachments/*/content', async (route) => {
        if (!waiting && route.request().method() === 'PUT') {
          waiting = true;
          await held;
        }
        await route.continue();
      });
      try {
        await page.goto(`/#${canvas.id}/canvas`);
        await expect(page.locator('.save-status')).toHaveText('Saved');
        await page.locator('.canvas-stage').click({ position: { x: 30, y: 30 } });
        const html =
          '<h2>Async capture</h2><p>Keep the captured image.</p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=">';
        await page.evaluate(
          async (html) =>
            navigator.clipboard.write([
              new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) }),
            ]),
          html,
        );
        await page.keyboard.press('Control+v');
        await expect.poll(() => waiting).toBe(true);
        await expect(page.locator('[data-canvas-card]')).toHaveCount(2);
        const existing = page
          .locator('[data-canvas-card="existing"]')
          .getByRole('textbox', { name: 'Note content', exact: true });
        if (removeTarget) {
          await page
            .locator('[data-canvas-card]:not([data-canvas-card="existing"])')
            .getByRole('button', { name: 'Move note', exact: true })
            .click();
          await page
            .getByRole('complementary', { name: 'Canvas selection', exact: true })
            .getByRole('button', { name: 'Delete', exact: true })
            .click();
          release();
          await expect(page.locator('.upload-failure')).toContainText(
            'Could not insert: Captured source.html',
          );
          await expect(
            page.getByRole('link', { name: 'Save original', exact: true }),
          ).toHaveAttribute('href', /^blob:/);
          await expect(existing).toHaveText('Keep this existing note.');
          await page.getByRole('button', { name: 'Retry', exact: true }).click();
          await expect(page.locator('.upload-failure')).toHaveCount(0);
          await expect(
            page.getByRole('link', { name: 'Captured source.html', exact: true }),
          ).toBeVisible();
        } else {
          await existing.click();
          await page.keyboard.press('Control+End');
          await page.keyboard.type(' Still typing here.');
          await expect(existing).toHaveText('Keep this existing note. Still typing here.');
          release();
          await expect(
            page.getByRole('heading', { name: 'Async capture', exact: true }),
          ).toBeVisible();
          await expect(existing).toHaveText('Keep this existing note. Still typing here.');
          await expect(
            page.locator('[data-canvas-card]:not([data-canvas-card="existing"]) img'),
          ).toHaveCount(1);
          expect(
            await existing.evaluate((element) =>
              element.contains(window.getSelection()?.anchorNode ?? null),
            ),
          ).toBe(true);
        }
        await expect(page.locator('.save-status')).toHaveText('Saved');
        await page.reload();
        await expect(page.locator('[data-canvas-card]')).toHaveCount(2);
      } finally {
        release();
        await context.request.delete(`/api/pages/${canvas.id}`, { headers }).catch(() => {});
        await context.close();
      }
    },
  );
