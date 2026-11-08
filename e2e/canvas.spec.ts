import { expect, test, type Page } from '@playwright/test';
async function createCanvas(page: Page, visibility = 'private') {
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await page.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  const session = await (await page.request.get('/api/session')).json();
  const response = await page.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    data: { title: `Canvas tools ${Date.now()}`, kind: 'canvas', visibility },
    headers: { 'x-note-request': '1' },
  });
  expect(response.ok()).toBe(true);
  const source = await response.json();
  try {
    await page.goto(`/#${source.id}/canvas`);
    await expect(page.getByRole('toolbar', { name: 'Canvas tools', exact: true })).toBeVisible();
    expect(warnings.filter((message) => message.includes('TextSelection endpoint'))).toEqual([]);
    return source;
  } catch (error) {
    await page.request
      .delete(`/api/pages/${source.id}`, { headers: { 'x-note-request': '1' } })
      .catch(() => {});
    throw error;
  }
}

test('canvas creates editable notes directly, drags and resizes their canonical content, and reopens durably', async ({
  page,
}) => {
  const signed = await page.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  expect(signed.ok()).toBe(true);
  const session = await (await page.request.get('/api/session')).json();
  const response = await page.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    data: { title: `Canvas interaction ${Date.now()}`, kind: 'canvas', visibility: 'private' },
    headers: { 'x-note-request': '1' },
  });
  expect(response.ok()).toBe(true);
  const source = await response.json();
  try {
    await page.goto(`/#${source.id}/canvas`);
    await expect(page.getByRole('toolbar', { name: 'Canvas tools', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add note', exact: true }).click();
    const note = page.getByRole('textbox', { name: 'Note content', exact: true });
    await expect(page.getByRole('group', { name: 'Page content', exact: true })).toBeFocused();
    await expect
      .poll(() =>
        note.evaluate((element) => {
          const anchor = window.getSelection()?.anchorNode;
          return !!anchor && element.contains(anchor);
        }),
      )
      .toBe(true);
    await page.keyboard.type('A shared spatial idea');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    const card = page.locator('[data-canvas-card]').first(),
      handle = card.getByRole('button', { name: 'Move note', exact: true });
    const before = (await card.boundingBox())!,
      grip = (await handle.boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 + 110, grip.y + grip.height / 2 + 65, {
      steps: 10,
    });
    await page.mouse.up();
    const moved = (await card.boundingBox())!;
    expect(moved.x - before.x).toBeCloseTo(110, 0);
    expect(moved.y - before.y).toBeCloseTo(65, 0);
    const resize = (await card
      .getByRole('button', { name: 'Resize note', exact: true })
      .boundingBox())!;
    await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2);
    await page.mouse.down();
    await page.mouse.move(resize.x + resize.width / 2 + 70, resize.y + resize.height / 2 + 40, {
      steps: 8,
    });
    await page.mouse.up();
    await expect
      .poll(async () => (await card.boundingBox())!.width)
      .toBeGreaterThan(before.width + 60);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Note content', exact: true })).toHaveText(
      'A shared spatial idea',
    );
    await expect(page.getByRole('toolbar', { name: 'Canvas tools', exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${source.id}/canvas$`));
  } finally {
    await page.request
      .delete(`/api/pages/${source.id}`, { headers: { 'x-note-request': '1' } })
      .catch(() => {});
  }
});

test('canvas groups move their notes together, connects them, duplicates independently and undoes a discrete delete', async ({
  page,
}) => {
  const source = await createCanvas(page);
  try {
    await page.getByRole('button', { name: 'Add note', exact: true }).click();
    await page.keyboard.type('First source');
    await page.getByRole('button', { name: 'Add note', exact: true }).click();
    await page.keyboard.type('Second source');
    const cards = page.locator('[data-canvas-card]');
    await expect(cards).toHaveCount(2);
    const first = (await cards.nth(0).boundingBox())!,
      second = (await cards.nth(1).boundingBox())!;
    expect(
      first.x + first.width <= second.x ||
        second.x + second.width <= first.x ||
        first.y + first.height <= second.y ||
        second.y + second.height <= first.y,
    ).toBe(true);
    await cards.nth(0).getByRole('button', { name: 'Move note', exact: true }).click();
    await cards
      .nth(1)
      .getByRole('button', { name: 'Move note', exact: true })
      .click({ modifiers: ['Shift'] });
    await page.getByRole('button', { name: 'Group selection', exact: true }).click();
    const group = page.locator('[data-canvas-group]');
    await expect(group).toHaveCount(1);
    const grip = (await group
      .getByRole('button', { name: 'Move group', exact: true })
      .boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 + 55, grip.y + grip.height / 2 + 45, {
      steps: 8,
    });
    await page.mouse.up();
    expect((await cards.nth(0).boundingBox())!.x - first.x).toBeCloseTo(55, 0);
    expect((await cards.nth(1).boundingBox())!.y - second.y).toBeCloseTo(45, 0);
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    const a = (await cards
        .nth(0)
        .getByRole('button', { name: 'Move note', exact: true })
        .boundingBox())!,
      b = (await cards
        .nth(1)
        .getByRole('button', { name: 'Move note', exact: true })
        .boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('[data-canvas-connection]')).toHaveCount(1);
    await page.getByRole('textbox', { name: 'Connection label', exact: true }).click();
    await page.keyboard.type('Supports');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.reload();
    await expect(cards).toHaveCount(2);
    await expect(group).toHaveCount(1);
    await expect(page.getByRole('textbox', { name: 'Connection label', exact: true })).toHaveText(
      'Supports',
    );
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await group.getByRole('button', { name: 'Move group', exact: true }).click();
    await page
      .getByRole('complementary', { name: 'Canvas selection', exact: true })
      .getByRole('button', { name: 'Duplicate', exact: true })
      .click();
    await expect(cards).toHaveCount(4);
    await expect(group).toHaveCount(2);
    await expect(page.locator('[data-canvas-connection]')).toHaveCount(2);
    await page
      .getByRole('complementary', { name: 'Canvas selection', exact: true })
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(cards).toHaveCount(2);
    await page.getByRole('application', { name: 'Canvas stage', exact: true }).focus();
    await page.keyboard.press('Control+z');
    await expect(cards).toHaveCount(4);
    await expect(cards.filter({ hasText: 'First source' })).toHaveCount(2);
  } finally {
    await page.request
      .delete(`/api/pages/${source.id}`, { headers: { 'x-note-request': '1' } })
      .catch(() => {});
  }
});

test('the canvas catalog creates directly into a focused title without a setup form', async ({
  page,
}) => {
  await page.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  let id: string | null = null;
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Canvases', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Canvases', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'New canvas', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Page title', exact: true })).toBeFocused();
    id = new URL(page.url()).hash.slice(1).split('/')[0];
    await page
      .getByRole('textbox', { name: 'Page title', exact: true })
      .fill('Canvas created directly');
    await page.getByRole('textbox', { name: 'Page title', exact: true }).press('Enter');
    await expect(page.getByRole('toolbar', { name: 'Canvas tools', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Canvases', exact: true }).click();
    await expect(
      page
        .getByRole('region', { name: 'Canvases', exact: true })
        .getByRole('button')
        .filter({ hasText: 'Canvas created directly' }),
    ).toBeVisible();
  } finally {
    if (id)
      await page.request
        .delete(`/api/pages/${id}`, { headers: { 'x-note-request': '1' } })
        .catch(() => {});
  }
});

test('a fresh canvas client waits for the canonical document before exposing editing tools', async ({
  browser,
  page,
}) => {
  const source = await createCanvas(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  try {
    await page.getByRole('button', { name: 'Add note', exact: true }).click();
    await page.keyboard.type('Canonical content before delayed synchronization');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    const before = await (await page.request.get(`/api/pages/${source.id}`)).json();
    await context.request.post('/api/auth/sign-in/email', {
      data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
      headers: { origin: 'http://127.0.0.1:5173' },
    });
    let held = true;
    const pending: (() => void)[] = [];
    await context.routeWebSocket('**/collaboration', (socket) => {
      const server = socket.connectToServer();
      server.onMessage((message) => {
        if (held) pending.push(() => socket.send(message));
        else socket.send(message);
      });
    });
    const delayed = await context.newPage();
    const warnings: string[] = [];
    delayed.on('console', (message) => {
      if (message.type() === 'warning') warnings.push(message.text());
    });
    await delayed.goto(`/#${source.id}/canvas`);
    await expect.poll(() => pending.length).toBeGreaterThan(0);
    await delayed.getByRole('button', { name: 'Command palette', exact: true }).click();
    await expect(delayed.getByRole('dialog')).toBeVisible();
    await delayed.keyboard.press('Escape');
    await delayed.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(delayed.getByText('Opening canvas…', { exact: true })).toBeVisible();
    await expect(delayed.getByRole('toolbar', { name: 'Canvas tools', exact: true })).toHaveCount(
      0,
    );
    held = false;
    pending.splice(0).forEach((send) => send());
    await expect(delayed.getByRole('textbox', { name: 'Note content', exact: true })).toContainText(
      'Canonical content before delayed synchronization',
    );
    await expect(delayed.locator('[data-canvas-card]')).toHaveCount(1);
    await expect(delayed.locator('.save-status')).toHaveText('Saved');
    await delayed.reload();
    await expect(delayed.locator('[data-canvas-card]')).toHaveCount(1);
    await expect(delayed.locator('.save-status')).toHaveText('Saved');
    const after = await (await page.request.get(`/api/pages/${source.id}`)).json();
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(warnings.filter((message) => message.includes('TextSelection endpoint'))).toEqual([]);
  } finally {
    await context.close();
    await page.request
      .delete(`/api/pages/${source.id}`, { headers: { 'x-note-request': '1' } })
      .catch(() => {});
  }
});

test('select all inside a duplicated note edits only that independent note', async ({ page }) => {
  const source = await createCanvas(page);
  try {
    await page.getByRole('button', { name: 'Add note', exact: true }).click();
    await page.keyboard.type('Original note remains independent');
    await page.getByRole('button', { name: 'Move note', exact: true }).click();
    await page
      .getByRole('complementary', { name: 'Canvas selection', exact: true })
      .getByRole('button', { name: 'Duplicate', exact: true })
      .click();
    const notes = page.getByRole('textbox', { name: 'Note content', exact: true });
    await expect(notes).toHaveCount(2);
    await notes.nth(1).locator('p').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Only the copy changes');
    await expect(notes).toHaveCount(2);
    await expect(notes.nth(0)).toHaveText('Original note remains independent');
    await expect(notes.nth(1)).toHaveText('Only the copy changes');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.reload();
    await expect(notes.nth(0)).toHaveText('Original note remains independent');
    await expect(notes.nth(1)).toHaveText('Only the copy changes');
    const stage = page.getByRole('application', { name: 'Canvas stage', exact: true });
    await notes.nth(1).locator('p').click();
    await page.keyboard.press('Escape');
    await expect(stage).toBeFocused();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    await expect(notes).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(notes).toHaveCount(2);
  } finally {
    await page.request
      .delete(`/api/pages/${source.id}`, { headers: { 'x-note-request': '1' } })
      .catch(() => {});
  }
});

test.describe('native mobile canvas interactions', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('direct canvas creation keeps the title reachable and focused on a narrow screen', async ({
    page,
  }) => {
    const source = await createCanvas(page);
    let created: string | undefined;
    try {
      await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
      await page.getByRole('button', { name: 'Canvases', exact: true }).click();
      await page.getByRole('button', { name: 'New canvas', exact: true }).click();
      created = new URL(page.url()).hash.slice(1).split('/')[0];
      const title = page.getByRole('textbox', { name: 'Page title', exact: true });
      await expect(title).toBeVisible();
      await expect(title).toBeFocused();
      expect(
        await title.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
      ).toBeLessThanOrEqual(18);
      await title.fill('A mobile thinking space');
      await title.press('Enter');
      await page.getByRole('button', { name: 'Add note', exact: true }).click();
      await page.keyboard.type('An idea captured on a phone');
      await expect(page.locator('.save-status')).toHaveText('Saved');
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      await page.reload();
      await expect(title).toHaveValue('A mobile thinking space');
      await expect(page.getByRole('textbox', { name: 'Note content', exact: true })).toHaveText(
        'An idea captured on a phone',
      );
    } finally {
      for (const id of [created, source.id].filter(Boolean))
        await page.request
          .delete(`/api/pages/${id}`, { headers: { 'x-note-request': '1' } })
          .catch(() => {});
    }
  });
  test('pinch starts over note content, keeps its anchor and persists the camera', async ({
    page,
    context,
  }) => {
    const source = await createCanvas(page);
    const cdp = await context.newCDPSession(page);
    const touch = (
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      points: { x: number; y: number; id: number }[],
    ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    try {
      await page.getByRole('button', { name: 'Add note', exact: true }).click();
      await page.keyboard.type('Touch can start on content');
      const note = page.getByRole('textbox', { name: 'Note content', exact: true });
      const box = (await note.boundingBox())!;
      const a = { x: box.x + 70, y: box.y + 60, id: 1 },
        b = { x: box.x + 170, y: box.y + 60, id: 2 };
      const matrix = () =>
        page.locator('.canvas-world').evaluate((element) => {
          const matrix = new DOMMatrix(getComputedStyle(element).transform);
          return { zoom: matrix.a, x: matrix.e, y: matrix.f };
        });
      const before = await matrix(),
        stage = (await page.locator('.canvas-stage').boundingBox())!;
      const anchor = {
        x: ((a.x + b.x) / 2 - stage.x - before.x) / before.zoom,
        y: (a.y - stage.y - before.y) / before.zoom,
      };
      await touch('touchStart', [a, b]);
      await touch('touchMove', [
        { ...a, x: a.x - 30, y: a.y + 25 },
        { ...b, x: b.x + 30, y: b.y + 25 },
      ]);
      await touch('touchEnd', []);
      await expect.poll(async () => (await matrix()).zoom).toBeCloseTo(before.zoom * 1.6, 3);
      const after = await matrix();
      expect(anchor.x * after.zoom + after.x + stage.x).toBeCloseTo((a.x + b.x) / 2, 1);
      expect(anchor.y * after.zoom + after.y + stage.y).toBeCloseTo(a.y + 25, 1);
      await expect(page.locator('.save-status')).toHaveText('Saved');
      await page.reload();
      await expect(note).toHaveText('Touch can start on content');
      await expect.poll(async () => (await matrix()).zoom).toBeCloseTo(after.zoom, 3);
    } finally {
      await cdp.detach();
      await page.request
        .delete(`/api/pages/${source.id}`, { headers: { 'x-note-request': '1' } })
        .catch(() => {});
    }
  });
  test('a finger scrolls a long note and canceled note gestures preserve canonical geometry', async ({
    page,
    context,
  }) => {
    const source = await createCanvas(page),
      cdp = await context.newCDPSession(page);
    const touch = (
      type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
      points: { x: number; y: number; id: number }[],
    ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    try {
      await page.getByRole('button', { name: 'Add note', exact: true }).click();
      await page.keyboard.insertText(
        Array.from({ length: 25 }, (_, i) => `Scrollable thought ${i + 1}`).join('\n'),
      );
      const note = page.getByRole('textbox', { name: 'Note content', exact: true }),
        card = page.locator('[data-canvas-card]');
      await note.evaluate((element) => {
        element.scrollTop = 0;
      });
      const bounds = (await note.boundingBox())!,
        start = { x: bounds.x + 180, y: bounds.y + 150, id: 1 };
      await touch('touchStart', [start]);
      for (let i = 1; i <= 5; i++) await touch('touchMove', [{ ...start, y: start.y - i * 16 }]);
      await touch('touchEnd', []);
      await expect.poll(() => note.evaluate((element) => element.scrollTop)).toBeGreaterThan(60);
      const before = (await card.boundingBox())!;
      const handle = (await card
        .getByRole('button', { name: 'Move note', exact: true })
        .boundingBox())!;
      const grab = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2, id: 1 };
      await touch('touchStart', [grab]);
      await touch('touchMove', [{ ...grab, x: grab.x + 30, y: grab.y + 35 }]);
      await expect.poll(async () => (await card.boundingBox())!.x).toBeCloseTo(before.x + 30, 1);
      await touch('touchCancel', []);
      expect((await card.boundingBox())!.x).toBeCloseTo(before.x, 1);
      expect((await card.boundingBox())!.y).toBeCloseTo(before.y, 1);
      const resize = (await card
        .getByRole('button', { name: 'Resize note', exact: true })
        .boundingBox())!;
      const corner = { x: resize.x + resize.width / 2, y: resize.y + resize.height / 2, id: 1 };
      await touch('touchStart', [corner]);
      await touch('touchMove', [{ ...corner, x: corner.x + 20, y: corner.y + 25 }]);
      await expect
        .poll(async () => (await card.boundingBox())!.width)
        .toBeGreaterThan(before.width + 15);
      await touch('touchCancel', []);
      expect((await card.boundingBox())!.width).toBeCloseTo(before.width, 1);
      expect((await card.boundingBox())!.height).toBeCloseTo(before.height, 1);
      await expect(page.locator('.save-status')).toHaveText('Saved');
      await page.reload();
      await expect(card).toHaveCount(1);
      expect((await card.boundingBox())!.width).toBeCloseTo(before.width, 1);
    } finally {
      await cdp.detach();
      await page.request
        .delete(`/api/pages/${source.id}`, { headers: { 'x-note-request': '1' } })
        .catch(() => {});
    }
  });
});

test('temporary space panning releases even when a dialog takes keyboard focus', async ({
  page,
}) => {
  const source = await createCanvas(page);
  try {
    const stage = page.getByRole('application', { name: 'Canvas stage', exact: true });
    await stage.focus();
    await page.keyboard.down('Space');
    await expect(stage).toHaveAttribute('data-tool', 'hand');
    await page.getByRole('button', { name: 'Command palette', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.up('Space');
    await page.keyboard.press('Escape');
    await expect(stage).toHaveAttribute('data-tool', 'select');
  } finally {
    await page.request
      .delete(`/api/pages/${source.id}`, { headers: { 'x-note-request': '1' } })
      .catch(() => {});
  }
});

test('adding many notes finds free space and reveals the new note instead of covering existing content', async ({
  page,
}) => {
  const source = await createCanvas(page);
  try {
    const cards = page.locator('[data-canvas-card]');
    for (let i = 0; i < 10; i++) {
      await page.getByRole('button', { name: 'Add note', exact: true }).click();
      await page.keyboard.type(`Independent idea ${i + 1}`);
      await expect(cards).toHaveCount(i + 1);
      const boxes = await cards.evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return { x: box.x, y: box.y, width: box.width, height: box.height };
        }),
      );
      const last = boxes.at(-1)!;
      expect(
        boxes
          .slice(0, -1)
          .every(
            (box) =>
              last.x + last.width <= box.x ||
              box.x + box.width <= last.x ||
              last.y + last.height <= box.y ||
              box.y + box.height <= last.y,
          ),
      ).toBe(true);
      const stage = (await page.locator('.canvas-stage').boundingBox())!;
      expect(last.x).toBeGreaterThanOrEqual(stage.x);
      expect(last.y).toBeGreaterThanOrEqual(stage.y);
      expect(last.y + last.height).toBeLessThanOrEqual(stage.y + stage.height);
    }
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.reload();
    await expect(cards).toHaveCount(10);
    await expect(page.getByText('Independent idea 10', { exact: true })).toBeVisible();
  } finally {
    await page.request
      .delete(`/api/pages/${source.id}`, { headers: { 'x-note-request': '1' } })
      .catch(() => {});
  }
});

test('a long note scrolls with the wheel without changing the canvas zoom', async ({ page }) => {
  const source = await createCanvas(page);
  try {
    await page.getByRole('button', { name: 'Add note', exact: true }).click();
    await page.keyboard.insertText(
      Array.from({ length: 25 }, (_, i) => `Long note line ${i + 1}`).join('\n'),
    );
    const note = page.getByRole('textbox', { name: 'Note content', exact: true });
    await note.evaluate((element) => {
      element.scrollTop = 0;
    });
    const zoom = () =>
      page
        .locator('.canvas-world')
        .evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a);
    const before = await zoom();
    await note.hover();
    await page.mouse.wheel(0, 150);
    await expect.poll(() => note.evaluate((element) => element.scrollTop)).toBeGreaterThan(50);
    expect(await zoom()).toBe(before);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await expect.poll(zoom).toBeGreaterThan(before);
    await page.keyboard.up('Control');
  } finally {
    await page.request
      .delete(`/api/pages/${source.id}`, { headers: { 'x-note-request': '1' } })
      .catch(() => {});
  }
});

test('shared canvas media and page references remain authorized through renames and live private moves, including the catalog', async ({
  browser,
}) => {
  const owner = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' }),
    reader = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  const a = await owner.newPage(),
    source = await createCanvas(a, 'workspace');
  const createTarget = async (title: string, visibility: string) => {
    const response = await owner.request.post(`/api/workspaces/${source.workspaceId}/pages`, {
      data: { title, visibility },
      headers: { 'x-note-request': '1' },
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  const secret = await createTarget(`Private canvas reference ${Date.now()}`, 'private'),
    target = await createTarget(`Visible canvas reference ${Date.now()}`, 'workspace');
  try {
    for (const page of [secret, target]) {
      await a.getByRole('button', { name: 'Link page', exact: true }).click();
      const dialog = a.getByRole('dialog', { name: 'Connect an idea', exact: true });
      await dialog.getByRole('textbox').fill(page.title);
      await dialog.getByRole('button', { name: page.title, exact: true }).click();
      await expect(
        a.locator('.canvas-page-reference strong').filter({ hasText: page.title }),
      ).toBeVisible();
    }
    const image = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    );
    await a
      .getByLabel('Upload canvas media', { exact: true })
      .setInputFiles({ name: 'canvas-proof.png', mimeType: 'image/png', buffer: image });
    await expect(a.locator('[data-canvas-card] img')).toHaveCount(1);
    await expect(a.locator('.save-status')).toHaveText('Saved');
    await reader.request.post('/api/auth/sign-in/email', {
      data: { email: 'amelia@note.test', password: 'Note-local-demo-2026' },
      headers: { origin: 'http://127.0.0.1:5173' },
    });
    const b = await reader.newPage();
    await b.goto(`/#${source.id}/canvas`);
    await expect(b.locator('[data-canvas-card]')).toHaveCount(3);
    await expect(b.getByText('Unavailable page', { exact: true })).toBeVisible();
    await expect(
      b.locator('.canvas-page-reference strong').filter({ hasText: target.title }),
    ).toBeVisible();
    await expect(b.locator('[data-canvas-card] img')).toHaveJSProperty('naturalWidth', 1);
    const renamed = await owner.request.patch(`/api/pages/${target.id}`, {
      data: { revision: target.revision, title: `Renamed ${target.title}` },
      headers: { 'x-note-request': '1' },
    });
    expect(renamed.ok()).toBe(true);
    const current = await renamed.json();
    await expect(
      b.locator('.canvas-page-reference strong').filter({ hasText: current.title }),
    ).toBeVisible();
    expect(
      (
        await owner.request.post(`/api/pages/${target.id}/move`, {
          data: { parentId: secret.id, revision: current.revision, confirmed: true },
          headers: { 'x-note-request': '1' },
        })
      ).ok(),
    ).toBe(true);
    await expect(b.getByText('Unavailable page', { exact: true })).toHaveCount(2);
    await expect(
      b.locator('.canvas-page-reference').filter({ hasText: current.title }),
    ).toHaveCount(0);
    await b.getByRole('button', { name: 'Canvases', exact: true }).click();
    const row = b
      .getByRole('region', { name: 'Canvases', exact: true })
      .getByRole('button')
      .filter({ hasText: source.title });
    await expect(row).toBeVisible();
    const sourceNow = await (await owner.request.get(`/api/pages/${source.id}`)).json();
    expect(
      (
        await owner.request.post(`/api/pages/${source.id}/move`, {
          data: { parentId: secret.id, revision: sourceNow.revision, confirmed: true },
          headers: { 'x-note-request': '1' },
        })
      ).ok(),
    ).toBe(true);
    await expect(row).toHaveCount(0);
  } finally {
    for (const id of [secret.id, source.id, target.id])
      await owner.request
        .delete(`/api/pages/${id}`, { headers: { 'x-note-request': '1' } })
        .catch(() => {});
    await owner.close();
    await reader.close();
  }
});
