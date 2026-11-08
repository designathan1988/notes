import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

test('saved canvas history and templates preserve spatial content with local read-only navigation', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  const headers = { 'x-note-request': '1' };
  await context.request.post('/api/auth/sign-in/email', {
    headers: { origin: 'http://127.0.0.1:5173' },
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
  });
  const session = await (await context.request.get('/api/session')).json();
  const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
  const content = {
    type: 'doc',
    content: [
      {
        type: 'canvasRoot',
        content: [
          {
            type: 'canvasGroup',
            attrs: { id: 'group', x: -30, y: -30, width: 1150, height: 610 },
            content: [{ type: 'text', text: 'Evidence and conclusions' }],
          },
          {
            type: 'canvasCard',
            attrs: { id: 'evidence', x: 20, y: 30, width: 330, height: 260, groupId: 'group' },
            content: [
              {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: 'Original evidence' }],
              },
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'Keep this exact source.', marks: [{ type: 'bold' }] },
                ],
              },
              {
                type: 'taskList',
                content: [
                  {
                    type: 'taskItem',
                    attrs: { checked: true },
                    content: [paragraph('Reviewed source')],
                  },
                ],
              },
              ...Array.from({ length: 12 }, (_, i) => paragraph(`Retained observation ${i + 1}`)),
            ],
          },
          {
            type: 'canvasCard',
            attrs: {
              id: 'conclusion',
              x: 750,
              y: 250,
              width: 320,
              height: 210,
              groupId: 'group',
              color: '#8a7558',
            },
            content: [paragraph('An independently positioned conclusion.')],
          },
          {
            type: 'canvasEdge',
            attrs: {
              id: 'supports',
              fromNode: 'evidence',
              toNode: 'conclusion',
              fromSide: 'right',
              toSide: 'left',
              fromEnd: 'arrow',
              toEnd: 'arrow',
              color: '#8a7558',
            },
            content: [{ type: 'text', text: 'Supports' }],
          },
        ],
      },
    ],
  };
  const created = await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    headers,
    data: {
      title: 'Spatial snapshot verification',
      kind: 'canvas',
      visibility: 'private',
      requestId: crypto.randomUUID(),
      content,
    },
  });
  expect(created.ok()).toBe(true);
  const source = await created.json(),
    roots = [source.id];
  const page = await context.newPage(),
    errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(`/#${source.id}/canvas`);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Page actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Version history', exact: true }).click();
    await page.getByRole('textbox', { name: 'Version name', exact: true }).fill('Spatial evidence');
    await page.getByRole('button', { name: 'Save version', exact: true }).click();
    await expect(page.getByRole('button', { name: /Spatial evidence/ })).toBeVisible();
    const live = page
      .locator('[data-canvas-card="conclusion"]')
      .getByRole('textbox', { name: 'Note content', exact: true });
    await live.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' New live work.');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.getByRole('button', { name: /Spatial evidence/ }).click();
    const preview = page.getByRole('region', { name: 'Version preview', exact: true });
    await expect(
      preview.getByRole('application', { name: 'Saved canvas', exact: true }),
    ).toBeVisible();
    await expect(preview.locator('[contenteditable="true"]')).toHaveCount(0);
    await expect(preview).not.toContainText('New live work.');
    await preview.getByRole('button', { name: 'Expand canvas preview', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Canvas preview', exact: true });
    const stage = dialog.getByRole('application', { name: 'Saved canvas', exact: true });
    await expect(stage).toBeVisible();
    const first = dialog.locator('[data-canvas-card="evidence"]'),
      second = dialog.locator('[data-canvas-card="conclusion"]');
    await expect(first.locator('strong')).toHaveText('Keep this exact source.');
    await expect(first.getByRole('checkbox')).toBeDisabled();
    await expect(dialog.locator('[data-canvas-group="group"]')).toContainText(
      'Evidence and conclusions',
    );
    const a = await first.boundingBox(),
      b = await second.boundingBox();
    expect(b!.x - a!.x).toBeGreaterThan(200);
    expect(b!.y - a!.y).toBeGreaterThan(50);
    const edge = dialog.locator('[data-canvas-connection="supports"]');
    await expect(edge).toHaveAttribute('marker-start', /url\(#.+-start\)/);
    await expect(edge).toHaveAttribute('marker-end', /url\(#.+-end\)/);
    expect(await edge.evaluate((element) => getComputedStyle(element).color)).toBe(
      'rgb(138, 117, 88)',
    );
    await expect(dialog.locator('[data-canvas-edge="supports"]')).toHaveText('Supports');
    const zoom = dialog.getByLabel('Saved canvas zoom');
    const initial = await zoom.innerText();
    await stage.focus();
    await stage.press('+');
    await expect(zoom).not.toHaveText(initial);
    const transform = await dialog.locator('.canvas-world').getAttribute('style');
    await stage.press('ArrowRight');
    expect(await dialog.locator('.canvas-world').getAttribute('style')).not.toBe(transform);
    await stage.press('Home');
    await expect(zoom).toHaveText(initial);
    if (process.env.NOTE_QA_OUTPUT) {
      await mkdir(process.env.NOTE_QA_OUTPUT, { recursive: true });
      await page.screenshot({
        path: resolve(process.env.NOTE_QA_OUTPUT, 'canvas-snapshot-desktop.png'),
      });
    }
    const rich = first.locator('[data-canvas-rich]');
    await rich.hover();
    await page.mouse.wheel(0, 120);
    await expect.poll(() => rich.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(zoom).toHaveText(initial);
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await dialog.getByRole('button', { name: 'Fit saved canvas', exact: true }).click();
      const bounds = await stage.boundingBox();
      expect(bounds!.width).toBeLessThanOrEqual(width);
      expect(bounds!.height).toBeGreaterThan(300);
      expect((await first.boundingBox())!.width).toBeGreaterThan(bounds!.width / 5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      if (process.env.NOTE_QA_OUTPUT)
        await page.screenshot({
          path: resolve(process.env.NOTE_QA_OUTPUT, `canvas-snapshot-mobile-${width}.png`),
        });
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(
      preview.getByRole('button', { name: 'Expand canvas preview', exact: true }),
    ).toBeFocused();
    await expect(live).toContainText('New live work.');
    await page.reload();
    await expect(live).toContainText('New live work.');
    await page.setViewportSize({ width: 1487, height: 1058 });
    await page.getByRole('button', { name: 'Page actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Save as template', exact: true }).click();
    const save = page.getByRole('dialog', { name: 'Save as template', exact: true });
    await save
      .getByRole('textbox', { name: 'Template name', exact: true })
      .fill('Spatial evidence template');
    await save.getByRole('button', { name: 'Save template', exact: true }).click();
    await expect(save).toBeHidden();
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    await page
      .getByRole('button', { name: 'Preview Spatial evidence template', exact: true })
      .click();
    const template = page.getByRole('region', { name: 'Template preview', exact: true });
    await expect(
      template.getByRole('application', { name: 'Saved canvas', exact: true }),
    ).toBeVisible();
    await expect(template.locator('[data-canvas-card]')).toHaveCount(2);
    await expect(template).toContainText('New live work.');
    const definition = await (
      await context.request.get(`/api/workspaces/${session.workspaces[0].id}/templates`)
    ).json();
    const entry = definition.items.find(
      (item: { title: string }) => item.title === 'Spatial evidence template',
    );
    expect(entry).toBeTruthy();
    roots.push(entry.id);
    await template.getByRole('button', { name: 'Use template', exact: true }).click();
    const title = page.getByRole('textbox', { name: 'Page title', exact: true });
    await expect(title).toBeFocused();
    roots.push((await page.evaluate(() => location.hash)).slice(1).split('/')[0]);
    await title.fill('Independent spatial evidence');
    await title.press('Enter');
    await expect(page.locator('[data-canvas-card]')).toHaveCount(2);
    await expect(page.locator('[data-canvas-group]')).toHaveCount(1);
    await expect(page.locator('[data-canvas-connection]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Add note', exact: true })).toBeEnabled();
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.reload();
    await expect(page.locator('[data-canvas-card]')).toHaveCount(2);
    expect(errors).toEqual([]);
  } finally {
    for (const id of roots)
      await context.request.delete(`/api/pages/${id}`, { headers }).catch(() => {});
    await context.close();
  }
});
