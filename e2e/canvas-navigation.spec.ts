import { APP_ORIGIN } from './origin.js';
import { test, expect } from './test.js';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

test('canvas Details navigates to distant headings without document writes and owns metadata and new links', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN }),
    headers = { 'x-note-request': '1' };
  await context.request.post('/api/auth/sign-in/email', {
    headers: { origin: APP_ORIGIN },
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
  });
  const session = await (await context.request.get('/api/session')).json();
  const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
  const response = await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    headers,
    data: {
      title: 'Canvas navigation verification',
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
                attrs: { id: 'near', x: 0, y: 0 },
                content: [
                  {
                    type: 'heading',
                    attrs: { level: 2 },
                    content: [{ type: 'text', text: 'Starting point' }],
                  },
                ],
              },
              {
                type: 'canvasCard',
                attrs: { id: 'far', x: 6000, y: 200, width: 320, height: 240 },
                content: [
                  ...Array.from({ length: 15 }, (_, i) => paragraph(`Retained evidence ${i + 1}`)),
                  {
                    type: 'heading',
                    attrs: { level: 2 },
                    content: [{ type: 'text', text: 'Distant research' }],
                  },
                  paragraph('Keep this exact conclusion.'),
                ],
              },
            ],
          },
        ],
      },
    },
  });
  expect(response.ok()).toBe(true);
  const source = await response.json(),
    page = await context.newPage(),
    errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(`/#${source.id}/canvas`);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    const before = await (await context.request.get(`/api/pages/${source.id}/history`)).json();
    for (let i = 0; i < 4; i++)
      await page.getByRole('button', { name: 'Zoom in canvas', exact: true }).click();
    await page.getByRole('button', { name: 'Open page details', exact: true }).click();
    await page.getByRole('button', { name: 'Distant research', exact: true }).click();
    await expect
      .poll(async () =>
        Number.parseInt(await page.getByLabel('Canvas zoom', { exact: true }).innerText()),
      )
      .toBeGreaterThanOrEqual(75);
    const far = page.locator('[data-canvas-card="far"]'),
      rich = far.locator('[data-canvas-rich]'),
      heading = far.getByRole('heading', { name: 'Distant research', exact: true });
    const stage = await page
      .getByRole('application', { name: 'Canvas stage', exact: true })
      .boundingBox();
    const card = await far.boundingBox();
    expect(card!.x).toBeGreaterThanOrEqual(stage!.x);
    expect(card!.x + card!.width).toBeLessThanOrEqual(stage!.x + stage!.width);
    await expect.poll(() => rich.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const h = await heading.boundingBox(),
      r = await rich.boundingBox();
    expect(h!.y).toBeGreaterThanOrEqual(r!.y);
    expect(h!.y + h!.height).toBeLessThanOrEqual(r!.y + r!.height);
    const after = await (await context.request.get(`/api/pages/${source.id}/history`)).json();
    expect(after.version).toBe(before.version);
    await page.getByText('Properties and tags', { exact: true }).click();
    await page.getByRole('button', { name: 'Add tag', exact: true }).click();
    await page.getByRole('textbox', { name: 'New tag', exact: true }).fill('spatial-research');
    await page.getByRole('textbox', { name: 'New tag', exact: true }).press('Enter');
    await expect(
      page.getByRole('button', { name: 'Search tag spatial-research', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Add page property', exact: true }).click();
    const property = page.getByRole('dialog', { name: 'Add a property', exact: true });
    await property.getByRole('textbox', { name: 'Name', exact: true }).fill('Topic');
    await property.getByRole('button', { name: 'Add property', exact: true }).click();
    const topic = page.getByRole('textbox', { name: `Topic for ${source.title}`, exact: true });
    await topic.fill('Spatial knowledge');
    await topic.press('Enter');
    await expect
      .poll(async () =>
        JSON.stringify(
          (await (await context.request.get(`/api/pages/${source.id}`)).json()).properties.values,
        ),
      )
      .toContain('Spatial knowledge');
    if (process.env.NOTE_QA_OUTPUT) {
      await mkdir(process.env.NOTE_QA_OUTPUT, { recursive: true });
      await page.screenshot({
        path: resolve(process.env.NOTE_QA_OUTPUT, 'canvas-details-desktop.png'),
      });
    }
    await page.getByRole('button', { name: 'Connect an idea', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Connect an idea', exact: true });
    await picker.getByRole('textbox').fill('https://example.com/research');
    await picker
      .getByRole('button', { name: 'Link to https://example.com/research', exact: true })
      .click();
    await expect(page.locator('[data-canvas-card]')).toHaveCount(3);
    await expect(
      page.getByRole('link', { name: 'https://example.com/research', exact: true }),
    ).toHaveAttribute('href', 'https://example.com/research');
    await expect(page.locator('[data-canvas-card="near"]')).toHaveText('Starting point');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.reload();
    await expect(page.locator('[data-canvas-card]')).toHaveCount(3);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Page actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Page details', exact: true }).click();
    await page.getByText('Properties and tags', { exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Search tag spatial-research', exact: true }),
    ).toBeVisible();
    await expect(topic).toHaveValue('Spatial knowledge');
    expect(
      await page
        .getByRole('button', { name: 'Connect an idea', exact: true })
        .evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return element.contains(
            document.elementFromPoint(bounds.right - 24, bounds.top + bounds.height / 2),
          );
        }),
    ).toBe(true);
    if (process.env.NOTE_QA_OUTPUT)
      await page.screenshot({
        path: resolve(process.env.NOTE_QA_OUTPUT, 'canvas-details-mobile.png'),
      });
    await page.getByRole('button', { name: 'Distant research', exact: true }).click();
    await expect(
      page.getByRole('complementary', { name: 'Page details', exact: true }),
    ).toBeHidden();
    await expect(heading).toBeInViewport();
    if (process.env.NOTE_QA_OUTPUT)
      await page.screenshot({
        path: resolve(process.env.NOTE_QA_OUTPUT, 'canvas-heading-mobile.png'),
      });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    expect(errors).toEqual([]);
  } finally {
    await context.request.delete(`/api/pages/${source.id}`, { headers }).catch(() => {});
    await context.close();
  }
});

test('a viewer navigates the canvas outline while link creation and metadata remain read only', async ({
  browser,
}) => {
  const owner = await browser.newContext({ baseURL: APP_ORIGIN }),
    viewer = await browser.newContext({ baseURL: APP_ORIGIN });
  const headers = { 'x-note-request': '1' };
  for (const [context, email] of [
    [owner, 'jonathan@note.test'],
    [viewer, 'amelia@note.test'],
  ] as const)
    await context.request.post('/api/auth/sign-in/email', {
      headers: { origin: APP_ORIGIN },
      data: { email, password: 'Note-local-demo-2026' },
    });
  const session = await (await owner.request.get('/api/session')).json(),
    colleague = await (await viewer.request.get('/api/session')).json();
  const workspace = session.workspaces[0].id;
  const response = await owner.request.post(`/api/workspaces/${workspace}/pages`, {
    headers,
    data: {
      title: 'Read-only canvas navigation verification',
      kind: 'canvas',
      visibility: 'workspace',
      requestId: crypto.randomUUID(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'canvasRoot',
            content: [
              {
                type: 'canvasCard',
                attrs: { id: 'source', x: 4000, y: 200 },
                content: [
                  {
                    type: 'heading',
                    attrs: { level: 2 },
                    content: [{ type: 'text', text: 'Read-only evidence' }],
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
  const source = await response.json(),
    oldRole = colleague.workspaces.find((item: { id: string }) => item.id === workspace).role;
  let changed = false;
  try {
    const role = await owner.request.patch(
      `/api/workspaces/${workspace}/members/${colleague.user.id}`,
      { headers, data: { role: 'viewer' } },
    );
    expect(role.ok()).toBe(true);
    changed = true;
    const page = await viewer.newPage();
    await page.goto(`/#${source.id}/canvas`);
    await expect(page.locator('.save-status')).toHaveText('Read only');
    const before = await (await viewer.request.get(`/api/pages/${source.id}/history`)).json();
    await page.getByRole('button', { name: 'Open page details', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Connect an idea', exact: true })).toBeDisabled();
    await page.getByText('Properties and tags', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Add tag', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add page property', exact: true })).toHaveCount(
      0,
    );
    await page.getByRole('button', { name: 'Read-only evidence', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Read-only evidence', exact: true }),
    ).toBeInViewport();
    await expect(page.locator('[contenteditable="true"]')).toHaveCount(0);
    const after = await (await viewer.request.get(`/api/pages/${source.id}/history`)).json();
    expect(after.version).toBe(before.version);
  } finally {
    if (changed)
      await owner.request.patch(`/api/workspaces/${workspace}/members/${colleague.user.id}`, {
        headers,
        data: { role: oldRole },
      });
    await owner.request.delete(`/api/pages/${source.id}`, { headers }).catch(() => {});
    await owner.close();
    await viewer.close();
  }
});
