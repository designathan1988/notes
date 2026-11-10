import { APP_ORIGIN } from './origin.js';
import { allowBrowserErrors, expect, test, type BrowserContext, type Page } from './test.js';

const headers = { 'x-note-request': '1' };
async function signIn(context: BrowserContext, email: string) {
  const response = await context.request.post('/api/auth/sign-in/email', {
    data: { email, password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  expect(response.ok()).toBe(true);
  return (await context.request.get('/api/session')).json();
}
async function sharedPage(context: BrowserContext, kind: 'canvas' | 'document' = 'canvas') {
  const session = await signIn(context, 'jonathan@note.test');
  const response = await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    headers,
    data: {
      title: `Canvas collaboration ${Date.now()}`,
      kind,
      visibility: 'workspace',
      requestId: crypto.randomUUID(),
      content:
        kind === 'canvas'
          ? {
              type: 'doc',
              content: [
                {
                  type: 'canvasRoot',
                  content: [
                    {
                      type: 'canvasCard',
                      attrs: { id: 'shared-note', x: 0, y: 0, width: 300, height: 200 },
                      content: [
                        { type: 'paragraph', content: [{ type: 'text', text: 'Shared research' }] },
                      ],
                    },
                  ],
                },
              ],
            }
          : {
              type: 'doc',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Shared research' }] },
              ],
            },
    },
  });
  expect(response.ok()).toBe(true);
  return response.json();
}
function note(page: Page) {
  return page.locator('[data-canvas-card="shared-note"]');
}
async function plain(page: Page) {
  return note(page)
    .getByRole('textbox', { name: 'Note content', exact: true })
    .evaluate((element) => {
      const clone = element.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.collaboration-carets__caret').forEach((caret) => caret.remove());
      return clone.textContent;
    });
}
async function startDrag(page: Page, dx: number, dy: number) {
  const handle = (await note(page)
    .getByRole('button', { name: 'Move note', exact: true })
    .boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + dx, handle.y + handle.height / 2 + dy, {
    steps: 8,
  });
}

test('two canvas editors merge concurrent geometry and text, then recover a closed offline draft', async ({
  browser,
}) => {
  // The collaborator opens the graph while offline on purpose: its code cannot be fetched, and the
  // app shows its reconnect fallback. React reports the caught failure on the console.
  allowBrowserErrors(/Failed to fetch dynamically imported module/);
  const owner = await browser.newContext({ baseURL: APP_ORIGIN }),
    colleague = await browser.newContext({ baseURL: APP_ORIGIN });
  const source = await sharedPage(owner),
    a = await owner.newPage();
  let hold = false;
  const queued: (() => void)[] = [];
  await colleague.routeWebSocket('**/collaboration', (socket) => {
    const server = socket.connectToServer();
    socket.onMessage((message) => {
      if (hold) queued.push(() => server.send(message));
      else server.send(message);
    });
    server.onMessage((message) => {
      if (hold) queued.push(() => socket.send(message));
      else socket.send(message);
    });
  });
  try {
    await signIn(colleague, 'amelia@note.test');
    const b = await colleague.newPage();
    for (const page of [a, b]) {
      await page.goto(`/#${source.id}/canvas`);
      await expect(note(page)).toBeVisible();
      await expect(page.locator('.save-status')).toHaveText('Saved');
    }
    hold = true;
    await startDrag(a, 90, 45);
    await a.mouse.up();
    await b.locator('[data-canvas-card="shared-note"] p').click();
    await b.keyboard.press('Control+End');
    await expect(b.getByRole('group', { name: 'Page content', exact: true })).toBeFocused();
    expect(
      await b.evaluate(() =>
        document
          .getSelection()
          ?.anchorNode?.parentElement?.closest('[data-canvas-card]')
          ?.getAttribute('data-canvas-card'),
      ),
    ).toBe('shared-note');
    await b.keyboard.type(' — a colleague adds context');
    await expect.poll(() => queued.length).toBeGreaterThan(0);
    hold = false;
    queued.splice(0).forEach((send) => send());
    const expected = 'Shared research — a colleague adds context';
    await expect.poll(() => plain(a)).toBe(expected);
    await expect.poll(() => plain(b)).toBe(expected);
    for (const page of [a, b]) {
      await expect(note(page)).toHaveCSS('left', '90px');
      await expect(note(page)).toHaveCSS('top', '45px');
      await expect(page.locator('.save-status')).toHaveText('Saved');
    }
    await colleague.setOffline(true);
    await b.locator('[data-canvas-card="shared-note"] p').click();
    await b.keyboard.press('Control+End');
    await b.keyboard.type(' ');
    await expect.poll(() => plain(b)).toBe(`${expected} `);
    await b.keyboard.type('— retained offline');
    await expect.poll(() => plain(b)).toBe(`${expected} — retained offline`);
    await expect(b.locator('.save-status')).toHaveText('Saved locally');
    await a.getByRole('button', { name: 'Add note', exact: true }).click();
    await a.keyboard.type('An online continuation');
    await expect(a.locator('.save-status')).toHaveText('Saved');
    await b.getByRole('button', { name: 'Knowledge graph', exact: true }).click();
    await expect(b.getByRole('toolbar', { name: 'Canvas tools', exact: true })).toHaveCount(0);
    await colleague.setOffline(false);
    await b.goto(`/#${source.id}/canvas`);
    await expect(b.locator('[data-canvas-card]')).toHaveCount(2);
    await expect.poll(() => plain(b)).toBe(`${expected} — retained offline`);
    await expect.poll(() => plain(a)).toBe(`${expected} — retained offline`);
    for (const page of [a, b]) {
      await expect(page.locator('.save-status')).toHaveText('Saved');
      await page.reload();
      await expect(page.locator('[data-canvas-card]')).toHaveCount(2);
      await expect.poll(() => plain(page)).toBe(`${expected} — retained offline`);
    }
  } finally {
    hold = false;
    queued.splice(0).forEach((send) => {
      try {
        send();
      } catch {
        // The socket may already be closed by the offline transition.
      }
    });
    await colleague.setOffline(false).catch(() => {});
    await owner.request.delete(`/api/pages/${source.id}`, { headers }).catch(() => {});
    await owner.close();
    await colleague.close();
  }
});

test('an offline draft survives reopening as a viewer and synchronizes only after editing access returns', async ({
  browser,
}) => {
  const owner = await browser.newContext({ baseURL: APP_ORIGIN }),
    colleague = await browser.newContext({ baseURL: APP_ORIGIN });
  const source = await sharedPage(owner),
    session = await signIn(colleague, 'amelia@note.test'),
    a = await owner.newPage();
  let b = await colleague.newPage();
  const role = async (value: string) => {
    const response = await owner.request.patch(
      `/api/workspaces/${source.workspaceId}/members/${session.user.id}`,
      { headers, data: { role: value } },
    );
    expect(response.ok()).toBe(true);
  };
  const retained = 'Shared research — written offline before access changed';
  try {
    for (const page of [a, b]) {
      await page.goto(`/#${source.id}/canvas`);
      await expect(note(page)).toBeVisible();
      await expect(page.locator('.save-status')).toHaveText('Saved');
    }
    await colleague.setOffline(true);
    await note(b).locator('p').click();
    await b.keyboard.press('Control+End');
    await b.keyboard.type(' — written offline before access changed');
    await expect.poll(() => plain(b)).toBe(retained);
    await expect(b.locator('.save-status')).toHaveText('Saved locally');
    await role('viewer');
    await b.close();
    await colleague.setOffline(false);
    b = await colleague.newPage();
    await b.goto(`/#${source.id}/canvas`);
    await expect(
      note(b).getByRole('textbox', { name: 'Note content', exact: true }),
    ).toHaveAttribute('aria-readonly', 'true');
    await expect.poll(() => plain(b)).toBe(retained);
    await expect(b.locator('.save-status')).toHaveText('Read only');
    await expect.poll(() => plain(a)).toBe('Shared research');
    await b.reload();
    await expect.poll(() => plain(b)).toBe(retained);
    await expect(b.locator('.save-status')).toHaveText('Read only');
    await expect.poll(() => plain(a)).toBe('Shared research');
    await role('editor');
    for (const page of [a, b]) {
      await expect.poll(() => plain(page)).toBe(retained);
      await expect(page.locator('.save-status')).toHaveText('Saved');
      await page.reload();
      await expect.poll(() => plain(page)).toBe(retained);
      await expect(page.locator('.save-status')).toHaveText('Saved');
    }
  } finally {
    await colleague.setOffline(false).catch(() => {});
    await owner.request
      .patch(`/api/workspaces/${source.workspaceId}/members/${session.user.id}`, {
        headers,
        data: { role: 'editor' },
      })
      .catch(() => {});
    await owner.request.delete(`/api/pages/${source.id}`, { headers }).catch(() => {});
    await owner.close();
    await colleague.close();
  }
});

test('a live viewer downgrade cancels an uncommitted note drag and restoring the role permits durable edits', async ({
  browser,
}) => {
  const owner = await browser.newContext({ baseURL: APP_ORIGIN }),
    colleague = await browser.newContext({ baseURL: APP_ORIGIN });
  const source = await sharedPage(owner),
    session = await signIn(colleague, 'amelia@note.test'),
    page = await colleague.newPage();
  const role = async (value: string) => {
    const response = await owner.request.patch(
      `/api/workspaces/${source.workspaceId}/members/${session.user.id}`,
      { headers, data: { role: value } },
    );
    expect(response.ok()).toBe(true);
  };
  try {
    await page.goto(`/#${source.id}/canvas`);
    await expect(note(page)).toBeVisible();
    await startDrag(page, 80, 35);
    await expect(note(page)).toHaveCSS('left', '80px');
    await role('viewer');
    await expect(page.locator('.save-status')).toHaveText('Read only');
    await expect(note(page)).toHaveCSS('left', '0px');
    await page.mouse.up();
    const body = note(page).getByRole('textbox', { name: 'Note content', exact: true });
    await expect(body).toHaveAttribute('aria-readonly', 'true');
    await body.locator('p').click();
    await expect(body).toBeFocused();
    await page.keyboard.type(' cannot change this');
    expect(await plain(page)).toBe('Shared research');
    await page.keyboard.press('Control+a');
    expect(await page.evaluate(() => document.getSelection()?.toString())).toBe('Shared research');
    await role('editor');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await expect(body).toHaveAttribute('aria-readonly', 'false');
    await startDrag(page, 50, 20);
    await page.mouse.up();
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.reload();
    await expect(note(page)).toHaveCSS('left', '50px');
    await expect(note(page)).toHaveCSS('top', '20px');
  } finally {
    await page.mouse.up().catch(() => {});
    await owner.request
      .patch(`/api/workspaces/${source.workspaceId}/members/${session.user.id}`, {
        headers,
        data: { role: 'editor' },
      })
      .catch(() => {});
    await owner.request.delete(`/api/pages/${source.id}`, { headers }).catch(() => {});
    await owner.close();
    await colleague.close();
  }
});

test('clicking a populated note keeps text shortcuts in the note instead of the canvas', async ({
  browser,
}) => {
  const owner = await browser.newContext({ baseURL: APP_ORIGIN }),
    source = await sharedPage(owner),
    page = await owner.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.text());
  });
  try {
    await page.goto(`/#${source.id}/canvas`);
    await note(page).locator('p').click();
    await expect(page.getByRole('group', { name: 'Page content', exact: true })).toBeFocused();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' new human connections have value');
    await expect.poll(() => plain(page)).toBe('Shared research new human connections have value');
    await expect(page.locator('[data-canvas-card]')).toHaveCount(1);
    expect(errors).toEqual([]);
  } finally {
    await owner.request.delete(`/api/pages/${source.id}`, { headers }).catch(() => {});
    await owner.close();
  }
});

test('moving a canvas under a private root removes another editor’s content and cancels an in-progress resize', async ({
  browser,
}) => {
  const owner = await browser.newContext({ baseURL: APP_ORIGIN }),
    colleague = await browser.newContext({ baseURL: APP_ORIGIN });
  const source = await sharedPage(owner),
    privateRoot = await (
      await owner.request.post(`/api/workspaces/${source.workspaceId}/pages`, {
        headers,
        data: { title: `Private canvas branch ${Date.now()}`, visibility: 'private' },
      })
    ).json();
  try {
    await signIn(colleague, 'amelia@note.test');
    const page = await colleague.newPage();
    await page.goto(`/#${source.id}/canvas`);
    await note(page).getByRole('button', { name: 'Move note', exact: true }).click();
    const handle = (await note(page)
      .getByRole('button', { name: 'Resize note', exact: true })
      .boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + 80, handle.y + handle.height / 2 + 60, {
      steps: 8,
    });
    await expect(note(page)).toHaveCSS('width', '380px');
    const fresh = await (await owner.request.get(`/api/pages/${source.id}`)).json();
    const moved = await owner.request.post(`/api/pages/${source.id}/move`, {
      headers,
      data: { parentId: privateRoot.id, revision: fresh.revision, confirmed: true },
    });
    expect(moved.ok()).toBe(true);
    await expect(page.getByRole('toolbar', { name: 'Canvas tools', exact: true })).toHaveCount(0);
    await expect(page.locator('[data-canvas-card]')).toHaveCount(0);
    await expect(
      page.locator('.page-tree').getByRole('button', { name: source.title, exact: true }),
    ).toHaveCount(0);
    await page.mouse.up();
    const check = await owner.newPage();
    await check.goto(`/#${source.id}/canvas`);
    await expect(note(check)).toHaveCSS('width', '300px');
    await expect(note(check)).toHaveCSS('height', '200px');
    await expect.poll(() => plain(check)).toBe('Shared research');
  } finally {
    await owner.request.delete(`/api/pages/${source.id}`, { headers }).catch(() => {});
    await owner.request.delete(`/api/pages/${privateRoot.id}`, { headers }).catch(() => {});
    await owner.close();
    await colleague.close();
  }
});

test('document-boundary shortcuts and Shift selection stay inside the current spatial note', async ({
  browser,
}) => {
  const owner = await browser.newContext({ baseURL: APP_ORIGIN }),
    source = await sharedPage(owner),
    page = await owner.newPage();
  try {
    await page.goto(`/#${source.id}/canvas`);
    await page.getByRole('button', { name: 'Add note', exact: true }).click();
    await page.keyboard.type('A separate note');
    await note(page).locator('p').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' connected');
    await expect.poll(() => plain(page)).toBe('Shared research connected');
    await page.keyboard.press('Control+Home');
    await page.keyboard.type('Initial ');
    await expect.poll(() => plain(page)).toBe('Initial Shared research connected');
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('Control+Shift+End');
    expect(await page.evaluate(() => document.getSelection()?.toString())).toBe(
      'Initial Shared research connected',
    );
    await page.keyboard.type('Replaced first note');
    await expect.poll(() => plain(page)).toBe('Replaced first note');
    await expect(page.getByText('A separate note', { exact: true })).toBeVisible();
    await expect(page.locator('[data-canvas-card]')).toHaveCount(2);
    expect(await page.locator('.canvas-stage').evaluate((element) => element.scrollTop)).toBe(0);
    const second = page.locator('[data-canvas-card]').filter({ hasText: 'A separate note' });
    await second.locator('p').click();
    await page.keyboard.press('Control+a');
    expect(await page.evaluate(() => document.getSelection()?.toString())).toBe('A separate note');
    await page.keyboard.type('Replaced second note');
    await expect.poll(() => plain(page)).toBe('Replaced first note');
    await expect(second).toHaveCount(0);
    await expect(page.getByText('Replaced second note', { exact: true })).toBeVisible();
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.reload();
    await expect.poll(() => plain(page)).toBe('Replaced first note');
    await expect(page.getByText('Replaced second note', { exact: true })).toBeVisible();
  } finally {
    await owner.request.delete(`/api/pages/${source.id}`, { headers }).catch(() => {});
    await owner.close();
  }
});

test('the same document session restores ordinary note editing after a live viewer downgrade', async ({
  browser,
}) => {
  const owner = await browser.newContext({ baseURL: APP_ORIGIN }),
    colleague = await browser.newContext({ baseURL: APP_ORIGIN });
  const source = await sharedPage(owner, 'document'),
    session = await signIn(colleague, 'amelia@note.test');
  const role = async (value: string) => {
    const response = await owner.request.patch(
      `/api/workspaces/${source.workspaceId}/members/${session.user.id}`,
      { headers, data: { role: value } },
    );
    expect(response.ok()).toBe(true);
  };
  try {
    const page = await colleague.newPage();
    await page.goto(`/#${source.id}/document`);
    const body = page.getByRole('textbox', { name: 'Page content', exact: true });
    await expect(body).toHaveAttribute('contenteditable', 'true');
    await role('viewer');
    await expect(body).toHaveAttribute('contenteditable', 'false');
    await expect(page.locator('.save-status')).toHaveText('Read only');
    await role('editor');
    await expect(body).toHaveAttribute('contenteditable', 'true');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await body.press('Control+End');
    await page.keyboard.type(' — editing restored');
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.reload();
    await expect(body.locator('p').first()).toHaveText('Shared research — editing restored');
  } finally {
    await owner.request
      .patch(`/api/workspaces/${source.workspaceId}/members/${session.user.id}`, {
        headers,
        data: { role: 'editor' },
      })
      .catch(() => {});
    await owner.request.delete(`/api/pages/${source.id}`, { headers }).catch(() => {});
    await owner.close();
    await colleague.close();
  }
});
