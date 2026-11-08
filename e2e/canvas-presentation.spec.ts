import { test, expect } from '@playwright/test';
const headers = { 'x-note-request': '1' };
test('canvas connection sides, endpoint arrows and arbitrary colors remain editable and survive reload', async ({
  page,
}) => {
  await page.request.post('/api/auth/sign-in/email', {
    headers: { origin: 'http://127.0.0.1:5173' },
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
  });
  const session = await (await page.request.get('/api/session')).json();
  const response = await page.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    headers,
    data: {
      title: 'Connection presentation verification',
      kind: 'canvas',
      visibility: 'private',
      requestId: crypto.randomUUID(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'canvasRoot',
            content: [
              {
                type: 'canvasCard',
                attrs: { id: 'source', x: 0, y: 0, width: 300, height: 220 },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Source note' }] }],
              },
              {
                type: 'canvasCard',
                attrs: { id: 'target', x: 420, y: 0, width: 300, height: 220 },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Target note' }] }],
              },
              {
                type: 'canvasEdge',
                attrs: { id: 'connection', fromNode: 'source', toNode: 'target' },
                content: [{ type: 'text', text: 'Supports' }],
              },
            ],
          },
        ],
      },
    },
  });
  expect(response.ok()).toBe(true);
  const canvas = await response.json();
  try {
    await page.goto(`/#${canvas.id}/canvas`);
    const edge = page.locator('[data-canvas-connection="connection"]'),
      label = page.getByRole('textbox', { name: 'Connection label', exact: true });
    await expect(label).toHaveText('Supports');
    await label.click();
    const inspector = page.getByRole('complementary', { name: 'Canvas selection', exact: true });
    await expect(inspector.getByLabel('Start side', { exact: true })).toBeVisible();
    await inspector.getByLabel('Start side', { exact: true }).selectOption('top');
    await inspector.getByLabel('End side', { exact: true }).selectOption('bottom');
    await inspector.getByLabel('Start arrow', { exact: true }).selectOption('arrow');
    await inspector.getByLabel('End arrow', { exact: true }).selectOption('none');
    await inspector.getByLabel('Custom element color', { exact: true }).fill('#b65d96');
    await expect(edge).toHaveAttribute('d', /^M150,0 C.*570,220$/);
    await expect(edge).toHaveAttribute('marker-start', /url\(#.+\)/);
    await expect(edge).not.toHaveAttribute('marker-end');
    await expect(edge).toHaveCSS('stroke', 'rgb(182, 93, 150)');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.reload();
    await expect(edge).toHaveCSS('stroke', 'rgb(182, 93, 150)');
    await expect(edge).toHaveAttribute('d', /^M150,0 C.*570,220$/);
    await page
      .locator('[data-canvas-card="source"]')
      .getByRole('button', { name: 'Move note', exact: true })
      .click();
    await inspector.getByLabel('Custom element color', { exact: true }).fill('#5b72aa');
    await expect(page.locator('[data-canvas-card="source"]')).toHaveCSS(
      '--canvas-item-color',
      '#5b72aa',
    );
    await page
      .locator('[data-canvas-card="source"]')
      .getByRole('textbox', { name: 'Note content', exact: true })
      .click();
    await expect(inspector).toHaveCount(0);
    await expect(
      page.getByRole('textbox', { name: 'Note content', exact: true }).first(),
    ).toHaveText('Source note');
    await page.setViewportSize({ width: 390, height: 844 });
    await label.click();
    await expect(inspector.getByLabel('Start side', { exact: true })).toBeVisible();
    await inspector.getByLabel('End side', { exact: true }).selectOption('left');
    await inspector.getByRole('button', { name: 'Close selection', exact: true }).click();
    await label.click();
    await expect(inspector).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  } finally {
    await page.request.delete(`/api/pages/${canvas.id}`, { headers }).catch(() => {});
  }
});
