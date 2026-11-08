import { test, expect, type Page } from '@playwright/test';
async function graphFixture(page: Page) {
  const signed = await page.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  expect(signed.ok()).toBeTruthy();
  const session = await (await page.request.get('/api/session')).json();
  const response = await page.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    data: { title: `Spatial gesture ${Date.now()}`, visibility: 'private' },
    headers: { 'x-note-request': '1' },
  });
  expect(response.ok()).toBeTruthy();
  const source = await response.json();
  await page.goto(`/#${source.id}/graph`);
  await page.getByRole('textbox', { name: 'Filter graph', exact: true }).fill(source.title);
  const node = page.getByRole('link', { name: `Open ${source.title}`, exact: true });
  await expect(node).toBeVisible();
  await page.getByRole('button', { name: 'Reset graph view', exact: true }).click();
  return {
    source,
    node,
    cleanup: () =>
      page.request.delete(`/api/pages/${source.id}`, { headers: { 'x-note-request': '1' } }),
  };
}
async function cameraOf(page: Page) {
  return page
    .getByRole('img', { name: 'Workspace knowledge graph', exact: true })
    .evaluate((svg) => ({
      x: Number(svg.getAttribute('data-camera-x')),
      y: Number(svg.getAttribute('data-camera-y')),
      zoom: Number(svg.getAttribute('data-zoom')),
    }));
}

test('graph node dragging persists visual placement without changing canonical page data', async ({
  page,
}) => {
  await page.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  const session = await (await page.request.get('/api/session')).json();
  const created = await page.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    data: {
      title: `Spatial drag ${Date.now()}`,
      visibility: 'private',
      purpose: 'copy',
      requestId: crypto.randomUUID(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Graph movement leaves this canonical body intact.' }],
          },
        ],
      },
    },
    headers: { 'x-note-request': '1' },
  });
  expect(created.ok()).toBeTruthy();
  const source = await created.json();
  try {
    await page.goto(`/#${source.id}/graph`);
    const filter = page.getByRole('textbox', { name: 'Filter graph', exact: true });
    await filter.fill(source.title);
    const node = page.getByRole('link', { name: `Open ${source.title}`, exact: true });
    await expect(node).toBeVisible();
    await page.getByRole('button', { name: 'Reset graph view', exact: true }).click();
    const before = await node.locator('circle').evaluate((circle) => ({
      x: Number(circle.getAttribute('cx')),
      y: Number(circle.getAttribute('cy')),
    }));
    const box = (await node.locator('circle').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 95, box.y + box.height / 2 + 55, { steps: 9 });
    await page.mouse.up();
    await expect(page).toHaveURL(/\/graph$/);
    await expect
      .poll(async () => Number(await node.locator('circle').getAttribute('cx')))
      .not.toBe(before.x);
    const moved = await node.locator('circle').evaluate((circle) => ({
      x: Number(circle.getAttribute('cx')),
      y: Number(circle.getAttribute('cy')),
    }));
    const zoomBefore = (await cameraOf(page)).zoom;
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect.poll(async () => (await cameraOf(page)).zoom).toBeGreaterThan(zoomBefore);
    await page.getByRole('button', { name: 'Close graph connections', exact: true }).click();
    await expect(
      page.getByRole('complementary', { name: 'Graph connections', exact: true }),
    ).toBeHidden();
    const canonical = await (await page.request.get(`/api/pages/${source.id}`)).json();
    expect(canonical.revision).toBe(source.revision);
    expect(canonical.title).toBe(source.title);
    await page.reload();
    await filter.fill(source.title);
    await expect(node).toBeVisible();
    await expect
      .poll(async () => Number(await node.locator('circle').getAttribute('cx')))
      .toBeCloseTo(moved.x, 4);
    await node.focus();
    await expect(
      page.getByRole('complementary', { name: 'Graph connections', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => Number(await node.locator('circle').getAttribute('cx')))
      .toBeCloseTo(moved.x + 20, 4);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('textbox', { name: 'Page title', exact: true })).toHaveValue(
      source.title,
    );
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await expect(page.getByRole('textbox', { name: 'Page content', exact: true })).toHaveText(
      'Graph movement leaves this canonical body intact.',
    );
  } finally {
    await page.request.delete(`/api/pages/${source.id}`, { headers: { 'x-note-request': '1' } });
  }
});

test('graph toolbar stays compact and background pan uses CSS pixels at different viewport sizes', async ({
  page,
}) => {
  const { cleanup } = await graphFixture(page);
  try {
    const search = page.locator('.graph-search');
    expect((await search.boundingBox())!.height).toBeLessThanOrEqual(44);
    for (const width of [1536, 390, 360]) {
      await page.setViewportSize({ width, height: width > 500 ? 1024 : 844 });
      const stage = page.locator('.graph-canvas');
      await expect.poll(async () => (await stage.boundingBox())!.width).toBeGreaterThan(200);
      const box = (await stage.boundingBox())!;
      const before = await cameraOf(page);
      await page.mouse.move(box.x + 24, box.y + 24);
      await page.mouse.down();
      await page.mouse.move(box.x + 84, box.y + 64, { steps: 6 });
      await page.mouse.up();
      const after = await cameraOf(page);
      expect(after.x).toBeCloseTo(before.x - 60 / before.zoom, 3);
      expect(after.y).toBeCloseTo(before.y - 40 / before.zoom, 3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
    }
  } finally {
    await cleanup();
  }
});

test('wheel zoom keeps the pointed world position fixed and a normal click still opens the note', async ({
  page,
}) => {
  const { node, source, cleanup } = await graphFixture(page);
  try {
    const stage = (await page.locator('.graph-canvas').boundingBox())!;
    const before = await cameraOf(page),
      point = { x: 130, y: 160 };
    const world = {
      x: before.x + (point.x - stage.width / 2) / before.zoom,
      y: before.y + (point.y - stage.height / 2) / before.zoom,
    };
    await page.mouse.move(stage.x + point.x, stage.y + point.y);
    await page.mouse.wheel(0, -120);
    await expect.poll(async () => (await cameraOf(page)).zoom).toBeGreaterThan(before.zoom);
    const after = await cameraOf(page);
    expect((world.x - after.x) * after.zoom + stage.width / 2).toBeCloseTo(point.x, 2);
    expect((world.y - after.y) * after.zoom + stage.height / 2).toBeCloseTo(point.y, 2);
    await page.getByRole('button', { name: 'Reset graph view', exact: true }).click();
    await node.click();
    await expect(page.getByRole('textbox', { name: 'Page title', exact: true })).toHaveValue(
      source.title,
    );
  } finally {
    await cleanup();
  }
});

test('focus connections uses the inspected page and revoking that local center returns to an authorized global graph', async ({
  browser,
}) => {
  const owner = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  const reader = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  for (const [context, email] of [
    [owner, 'jonathan@note.test'],
    [reader, 'amelia@note.test'],
  ] as const)
    expect(
      (
        await context.request.post('/api/auth/sign-in/email', {
          data: { email, password: 'Note-local-demo-2026' },
          headers: { origin: 'http://127.0.0.1:5173' },
        })
      ).ok(),
    ).toBe(true);
  const session = await (await owner.request.get('/api/session')).json(),
    workspace = session.workspaces[0].id;
  const create = async (title: string, visibility = 'workspace') => {
    const response = await owner.request.post(`/api/workspaces/${workspace}/pages`, {
      data: { title, visibility },
      headers: { 'x-note-request': '1' },
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  const target = await create(`Local center ${Date.now()}`),
    privateRoot = await create(`Spatial private ${Date.now()}`, 'private');
  try {
    const page = await reader.newPage();
    await page.goto('/#ea293f81-c7fa-4551-9da5-58b8af0510a9/graph');
    await page.getByRole('textbox', { name: 'Filter graph', exact: true }).fill(target.title);
    const node = page.getByRole('link', { name: `Open ${target.title}`, exact: true });
    await expect(node).toBeVisible();
    await page.getByRole('button', { name: 'Reset graph view', exact: true }).click();
    await node.focus();
    const focused = page.waitForResponse((response) =>
      response.url().includes(`/graph?center=${target.id}`),
    );
    await page.getByRole('button', { name: 'Focus connections', exact: true }).click();
    expect((await focused).ok()).toBe(true);
    await expect(page.getByRole('checkbox', { name: 'Local graph', exact: true })).toBeChecked();
    await expect(node).toBeVisible();
    const moved = await owner.request.post(`/api/pages/${target.id}/move`, {
      data: { parentId: privateRoot.id, revision: target.revision, confirmed: true },
      headers: { 'x-note-request': '1' },
    });
    expect(moved.ok()).toBe(true);
    await expect(node).toHaveCount(0);
    await expect(
      page.getByRole('checkbox', { name: 'Local graph', exact: true }),
    ).not.toBeChecked();
    await expect(
      page.getByRole('img', { name: 'Workspace knowledge graph', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('complementary', { name: 'Graph connections', exact: true }),
    ).not.toContainText(target.title);
  } finally {
    await owner.request.delete(`/api/pages/${privateRoot.id}`, {
      headers: { 'x-note-request': '1' },
    });
    await owner.request.delete(`/api/pages/${target.id}`, { headers: { 'x-note-request': '1' } });
    await owner.close();
    await reader.close();
  }
});

test('a failed layout worker keeps navigation available and retries without reloading the application', async ({
  page,
}) => {
  const { source, cleanup } = await graphFixture(page);
  const workerPath = /\/layout\.worker\.ts(?:\?|$)/;
  try {
    await page.route(workerPath, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'throw new Error("Simulated layout worker failure")',
      }),
    );
    await page.reload();
    await expect(
      page.getByText('Graph layout could not be loaded.', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Command palette', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Command palette', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.unroute(workerPath);
    await page.getByRole('button', { name: 'Retry graph layout', exact: true }).click();
    await expect(
      page.getByRole('link', { name: `Open ${source.title}`, exact: true }),
    ).toBeAttached();
    await expect(page.getByText('Graph layout could not be loaded.', { exact: true })).toBeHidden();
  } finally {
    await page.unroute(workerPath);
    await cleanup();
  }
});

test('pending graph physics leaves application commands responsive until the real worker is ready', async ({
  page,
}) => {
  const { source, cleanup } = await graphFixture(page);
  const workerPath = /\/layout\.worker\.ts(?:\?|$)/;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await page.route(workerPath, async (route) => {
      await held;
      await route.continue();
    });
    const requested = page.waitForRequest(workerPath);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await requested;
    await expect(page.getByText('Loading graph…', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Command palette', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Command palette', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    release();
    await expect(
      page.getByRole('link', { name: `Open ${source.title}`, exact: true }),
    ).toBeAttached();
  } finally {
    release();
    await page.unroute(workerPath);
    await cleanup();
  }
});

test.describe('native mobile graph gestures', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('pinch and pan keep their world anchor, persist the camera, and cancellation restores an uncommitted node drag', async ({
    page,
    context,
  }) => {
    const { node, source, cleanup } = await graphFixture(page);
    const cdp = await context.newCDPSession(page);
    const touch = (
      type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
      points: { x: number; y: number; id: number }[],
    ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    try {
      const box = (await node.locator('circle').boundingBox())!,
        start = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
      const original = await node.locator('circle').getAttribute('cx');
      await touch('touchStart', [start]);
      await touch('touchMove', [{ ...start, x: start.x + 60, y: start.y + 30 }]);
      await expect.poll(async () => node.locator('circle').getAttribute('cx')).not.toBe(original);
      await touch('touchCancel', []);
      await expect(node.locator('circle')).toHaveAttribute('cx', original!);
      const stage = (await page.locator('.graph-canvas').boundingBox())!;
      const before = await cameraOf(page),
        a = { x: stage.x + 70, y: stage.y + 65, id: 1 },
        b = { x: stage.x + 170, y: stage.y + 65, id: 2 };
      const middle = { x: 120, y: 65 },
        anchor = {
          x: before.x + (middle.x - stage.width / 2) / before.zoom,
          y: before.y + (middle.y - stage.height / 2) / before.zoom,
        };
      await touch('touchStart', [a, b]);
      await touch('touchMove', [
        { ...a, x: a.x - 30, y: a.y + 40 },
        { ...b, x: b.x + 70, y: b.y + 40 },
      ]);
      await touch('touchEnd', []);
      const after = await cameraOf(page);
      expect(after.zoom).toBeCloseTo(Math.min(3, before.zoom * 2), 3);
      expect((anchor.x - after.x) * after.zoom + stage.width / 2).toBeCloseTo(140, 2);
      expect((anchor.y - after.y) * after.zoom + stage.height / 2).toBeCloseTo(105, 2);
      await expect(page).toHaveURL(/\/graph$/);
      await page.reload();
      await expect(
        page.getByRole('link', { name: `Open ${source.title}`, exact: true }),
      ).toBeAttached();
      const restored = await cameraOf(page);
      expect(restored.zoom).toBeCloseTo(after.zoom, 4);
      expect(restored.x).toBeCloseTo(after.x, 4);
    } finally {
      await cdp.detach();
      await cleanup();
    }
  });
});
