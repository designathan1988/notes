import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

test('canvas groups accept and release dropped notes, resize without clipping members, and retain the result', async ({
  page,
}) => {
  const headers = { 'x-note-request': '1' };
  await page.request.post('/api/auth/sign-in/email', {
    headers: { origin: 'http://127.0.0.1:5173' },
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
  });
  const session = await (await page.request.get('/api/session')).json();
  const response = await page.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    headers,
    data: {
      title: 'Group containment verification',
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
                type: 'canvasGroup',
                attrs: { id: 'group', x: 100, y: 100, width: 500, height: 400 },
                content: [{ type: 'text', text: 'Evidence' }],
              },
              {
                type: 'canvasCard',
                attrs: { id: 'note', x: 800, y: 160, width: 220, height: 160 },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Keep this independent source.' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  });
  expect(response.ok()).toBe(true);
  const source = await response.json();
  try {
    await page.goto(`/#${source.id}/canvas`);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    const group = page.locator('[data-canvas-group="group"]'),
      note = page.locator('[data-canvas-card="note"]');
    const move = async (handle: ReturnType<typeof page.getByRole>, dx: number, dy: number) => {
      const box = (await handle.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 });
      await page.mouse.up();
    };
    const zoom =
      Number.parseInt(await page.getByLabel('Canvas zoom', { exact: true }).innerText()) / 100;
    await group.getByRole('button', { name: 'Move group', exact: true }).click();
    await expect(group.getByRole('button', { name: 'Resize group', exact: true })).toBeVisible();
    await move(
      note.getByRole('button', { name: 'Move note', exact: true }),
      -630 * zoom,
      10 * zoom,
    );
    const joined = (await note.boundingBox())!;
    await move(group.getByRole('button', { name: 'Move group', exact: true }), 65, 40);
    expect((await note.boundingBox())!.x - joined.x).toBeCloseTo(65, 0);
    expect((await note.boundingBox())!.y - joined.y).toBeCloseTo(40, 0);
    const before = (await group.boundingBox())!;
    await move(group.getByRole('button', { name: 'Resize group', exact: true }), 100, 80);
    expect((await group.boundingBox())!.width).toBeGreaterThan(before.width + 90);
    await group.getByRole('button', { name: 'Resize group', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    expect((await group.boundingBox())!.width).toBeGreaterThan(before.width + 100);
    const stable = (await group.boundingBox())!.width;
    const grip = (await group
      .getByRole('button', { name: 'Resize group', exact: true })
      .boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 + 60, grip.y + grip.height / 2 + 40, {
      steps: 5,
    });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect((await group.boundingBox())!.width).toBeCloseTo(stable, 0);
    await note.getByRole('button', { name: 'Move note', exact: true }).click();
    await note.getByRole('button', { name: 'Resize note', exact: true }).focus();
    for (let i = 0; i < 7; i++) await page.keyboard.press('Shift+ArrowRight');
    const expanded = (await group.boundingBox())!,
      child = (await note.boundingBox())!;
    expect(expanded.x + expanded.width).toBeGreaterThan(child.x + child.width);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.reload();
    await expect(note).toContainText('Keep this independent source.');
    const persisted = (await group.boundingBox())!,
      retained = (await note.boundingBox())!;
    expect(persisted.x + persisted.width).toBeGreaterThan(retained.x + retained.width);
    await move(note.getByRole('button', { name: 'Move note', exact: true }), 0, 450);
    const released = (await note.boundingBox())!;
    await move(group.getByRole('button', { name: 'Move group', exact: true }), -40, 0);
    expect((await note.boundingBox())!.x).toBeCloseTo(released.x, 0);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    if (process.env.NOTE_QA_OUTPUT) {
      await mkdir(process.env.NOTE_QA_OUTPUT, { recursive: true });
      await group.getByRole('button', { name: 'Move group', exact: true }).click();
      await page.screenshot({
        path: resolve(process.env.NOTE_QA_OUTPUT, 'canvas-group-desktop.png'),
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Fit canvas', exact: true }).click();
      await page.screenshot({
        path: resolve(process.env.NOTE_QA_OUTPUT, 'canvas-group-mobile.png'),
      });
    }
  } finally {
    await page.request.delete(`/api/pages/${source.id}`, { headers }).catch(() => {});
  }
});
