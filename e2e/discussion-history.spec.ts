import { APP_ORIGIN } from './origin.js';
import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import * as Y from 'yjs';

test('two editors discuss, resolve and reopen; saved history previews and restores a live document', async ({
  browser,
}) => {
  const contexts = [];
  for (const email of ['jonathan@note.test', 'amelia@note.test']) {
    const context = await browser.newContext({ baseURL: APP_ORIGIN });
    await context.request.post('/api/auth/sign-in/email', {
      data: { email, password: 'Note-local-demo-2026' },
      headers: { origin: APP_ORIGIN },
    });
    contexts.push(context);
  }
  const [owner, editor] = contexts,
    session = await (await owner.request.get('/api/session')).json();
  const note = await (
    await owner.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Discussion history ${Date.now()}` },
      headers: { 'x-note-request': '1' },
    })
  ).json();
  const first = await owner.newPage(),
    second = await editor.newPage();
  const errors: string[] = [];
  for (const page of [first, second]) page.on('pageerror', (error) => errors.push(error.message));
  try {
    await first.goto(`/#${note.id}/document`);
    await second.goto(`/#${note.id}/document`);
    const body = first.getByRole('textbox', { name: 'Page content', exact: true });
    await expect(first.locator('.save-status')).toHaveText('Saved');
    await body.fill('Original evidence');
    await body.press('Control+End');
    await body.press('Enter');
    await first.keyboard.type('/');
    await first.getByRole('textbox', { name: 'Find block type' }).fill('Toggle');
    await first.keyboard.press('Enter');
    await first.keyboard.type('Additional context');
    await first.keyboard.press('Enter');
    await first.keyboard.type('Retained context inside collapsed section');
    await first.getByRole('button', { name: 'Collapse section', exact: true }).click();
    await expect(first.locator('.save-status')).toHaveText('Saved');
    await expect(first.getByRole('button', { name: 'Open comments', exact: true })).toBeVisible();
    await first.getByRole('button', { name: 'Open comments', exact: true }).click();
    await first
      .getByRole('textbox', { name: 'New comment', exact: true })
      .fill('What evidence supports this?');
    await first.getByRole('button', { name: 'Post comment', exact: true }).click();
    await expect(first.getByRole('button', { name: /What evidence supports this/ })).toBeVisible();
    await second.getByRole('button', { name: 'Open comments', exact: true }).click();
    await second.getByRole('button', { name: /What evidence supports this/ }).click();
    await second.getByRole('textbox', { name: 'Reply', exact: true }).fill('Three interviews.');
    await second.getByRole('button', { name: 'Send reply', exact: true }).click();
    await first.getByRole('button', { name: /What evidence supports this/ }).click();
    await expect(first.getByRole('region', { name: 'Discussion messages' })).toContainText(
      'Three interviews.',
    );
    if (process.env.NOTE_QA_OUTPUT) {
      await mkdir(process.env.NOTE_QA_OUTPUT, { recursive: true });
      await first.screenshot({
        path: resolve(process.env.NOTE_QA_OUTPUT, 'discussion-desktop.png'),
      });
    }
    await second.getByRole('button', { name: 'Resolve discussion', exact: true }).click();
    await first.getByRole('button', { name: 'Resolved', exact: true }).click();
    await first.getByRole('button', { name: /What evidence supports this/ }).click();
    await first.getByRole('button', { name: 'Reopen discussion', exact: true }).click();
    await first.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(first.getByRole('button', { name: /What evidence supports this/ })).toBeVisible();
    await first.getByRole('button', { name: 'Insert template', exact: true }).click();
    await first.getByRole('menuitem', { name: /Meeting notes/ }).click();
    await expect(first.locator('.save-status')).toHaveText('Saved');
    await first.getByRole('tab', { name: 'Version history', exact: true }).click();
    await first
      .getByRole('textbox', { name: 'Version name', exact: true })
      .fill('Reviewed evidence');
    await first.getByRole('button', { name: 'Save version', exact: true }).click();
    await expect(first.getByRole('button', { name: /Reviewed evidence/ })).toBeVisible();
    await body.fill('Revised evidence');
    await expect(first.locator('.save-status')).toHaveText('Saved');
    await expect(second.getByRole('textbox', { name: 'Page content', exact: true })).toContainText(
      'Revised evidence',
    );
    await first.getByRole('button', { name: /Reviewed evidence/ }).click();
    const preview = first.getByRole('region', { name: 'Version preview', exact: true });
    await expect(preview).toContainText('Original evidence');
    await expect(
      preview.getByText('Retained context inside collapsed section', { exact: true }),
    ).toBeVisible();
    await expect(preview.locator('[contenteditable="true"]')).toHaveCount(0);
    await expect(preview.getByRole('checkbox').first()).toBeDisabled();
    const task = preview.locator('li[data-checked]').first(),
      check = await task.locator('input').boundingBox(),
      text = await task.locator('p').first().boundingBox();
    expect(Math.abs(check!.y - text!.y)).toBeLessThan(8);
    if (process.env.NOTE_QA_OUTPUT)
      await first.screenshot({
        path: resolve(process.env.NOTE_QA_OUTPUT, 'history-preview-desktop.png'),
      });
    await expect(body).toContainText('Revised evidence');
    await first.getByRole('button', { name: 'Restore this version', exact: true }).click();
    await first.keyboard.press('Escape');
    await expect(preview).toBeVisible();
    await second
      .getByRole('textbox', { name: 'Page content', exact: true })
      .fill('Concurrent review edit');
    await expect(second.locator('.save-status')).toHaveText('Saved');
    await expect(body).toContainText('Concurrent review edit');
    await first.getByRole('button', { name: 'Restore this version', exact: true }).click();
    await first
      .getByRole('dialog', { name: 'Restore saved version' })
      .getByRole('button', { name: 'Restore version', exact: true })
      .click();
    await expect(first.getByRole('dialog').getByRole('alert')).toContainText('document changed');
    await expect(body).toContainText('Concurrent review edit');
    await first.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await first.getByRole('button', { name: 'Refresh comparison', exact: true }).click();
    await first.getByRole('button', { name: 'Restore this version', exact: true }).click();
    await first
      .getByRole('dialog', { name: 'Restore saved version' })
      .getByRole('button', { name: 'Restore version', exact: true })
      .click();
    await expect(body).toContainText('Original evidence');
    await expect(second.getByRole('textbox', { name: 'Page content', exact: true })).toContainText(
      'Original evidence',
    );
    await expect(first.getByRole('button', { name: /Before restore/ })).toBeVisible();
    await first.getByRole('button', { name: /Before restore/ }).click();
    await expect(preview).toContainText('Concurrent review edit');
    await first.reload();
    await expect(body).toContainText('Original evidence');
    await first.getByRole('button', { name: 'Page actions', exact: true }).click();
    await expect(
      first.getByRole('menuitem', { name: 'Version history', exact: true }),
    ).toBeVisible();
    await first.getByRole('menuitem', { name: 'Version history', exact: true }).click();
    await expect(first.getByRole('button', { name: /Reviewed evidence/ })).toBeVisible();
    for (const width of [390, 360]) {
      await first.setViewportSize({ width, height: 844 });
      await first.getByRole('button', { name: 'Page actions', exact: true }).click();
      await first.getByRole('menuitem', { name: 'Comments', exact: true }).click();
      await first.getByRole('tab', { name: 'Version history', exact: true }).click();
      await first.getByRole('button', { name: /Reviewed evidence/ }).click();
      await expect(preview).toContainText('Original evidence');
      expect(await first.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      if (process.env.NOTE_QA_OUTPUT) {
        await mkdir(process.env.NOTE_QA_OUTPUT, { recursive: true });
        await first.screenshot({
          path: resolve(process.env.NOTE_QA_OUTPUT, `history-mobile-${width}.png`),
        });
      }
      await first.getByRole('button', { name: 'All versions', exact: true }).click();
    }
    expect(errors).toEqual([]);
  } finally {
    await owner.request
      .delete(`/api/pages/${note.id}`, { headers: { 'x-note-request': '1' } })
      .catch(() => {});
    for (const context of contexts) await context.close();
  }
});

test('a disconnected collaborator recovers retained drafts as private pages and signs out safely', async ({
  browser,
}) => {
  const firstContext = await browser.newContext({ baseURL: APP_ORIGIN }),
    secondContext = await browser.newContext({ baseURL: APP_ORIGIN });
  for (const [context, email] of [
    [firstContext, 'jonathan@note.test'],
    [secondContext, 'amelia@note.test'],
  ] as const)
    await context.request.post('/api/auth/sign-in/email', {
      data: { email, password: 'Note-local-demo-2026' },
      headers: { origin: APP_ORIGIN },
    });
  const session = await (await firstContext.request.get('/api/session')).json(),
    headers = { 'x-note-request': '1' };
  const note = await (
    await firstContext.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Discussion recovery ${Date.now()}` },
      headers,
    })
  ).json();
  const recoveredIds: string[] = [];
  let initialCopyId = '',
    release: (() => void) | undefined;
  const first = await firstContext.newPage(),
    second = await secondContext.newPage();
  try {
    await first.goto(`/#${note.id}/document`);
    await expect(first.locator('.save-status')).toHaveText('Saved');
    await first
      .getByRole('textbox', { name: 'Page content', exact: true })
      .fill('Shared stable text');
    await expect(first.locator('.save-status')).toHaveText('Saved');
    const checkpoint = await (
      await firstContext.request.post(`/api/pages/${note.id}/history`, {
        data: { label: 'Stable' },
        headers,
      })
    ).json();
    await second.goto(`/#${note.id}/document`);
    await expect(second.locator('.save-status')).toHaveText('Saved');
    await secondContext.setOffline(true);
    await second.evaluate(() => window.dispatchEvent(new Event('offline')));
    await second.getByRole('textbox', { name: 'Page content', exact: true }).press('Control+End');
    await second.keyboard.type(' My disconnected contribution.');
    await expect(second.locator('.save-status')).toHaveText('Saved locally');
    const current = await (await firstContext.request.get(`/api/pages/${note.id}/history`)).json();
    expect(
      (
        await firstContext.request.post(`/api/pages/${note.id}/history/${checkpoint.id}/restore`, {
          data: { version: current.version },
          headers,
        })
      ).status(),
    ).toBe(200);
    await secondContext.setOffline(false);
    await second.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(
      second.getByRole('alert').filter({ hasText: /local draft|local recovery/i }),
    ).toBeVisible();
    await second.reload();
    await expect(second.locator('.save-status')).toHaveText('Saved');
    await secondContext.setOffline(true);
    await second.evaluate(() => window.dispatchEvent(new Event('offline')));
    await second.getByRole('textbox', { name: 'Page content', exact: true }).press('Control+End');
    await second.keyboard.type(' Another disconnected contribution.');
    await expect(second.locator('.save-status')).toHaveText('Saved locally');
    const latest = await (await firstContext.request.get(`/api/pages/${note.id}/history`)).json();
    expect(
      (
        await firstContext.request.post(`/api/pages/${note.id}/history/${checkpoint.id}/restore`, {
          data: { version: latest.version },
          headers,
        })
      ).status(),
    ).toBe(200);
    await secondContext.setOffline(false);
    await second.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(
      second.getByRole('alert').filter({ hasText: /local draft|local recovery/i }),
    ).toBeVisible();
    await second.getByRole('button', { name: 'Account menu', exact: true }).click();

    await second.getByRole('menuitem', { name: 'Settings', exact: true }).click();
    await second.getByRole('dialog').getByRole('tab', { name: 'Data', exact: true }).click();
    const downloading = second.waitForEvent('download');
    await second.getByRole('button', { name: 'Download local drafts', exact: true }).click();
    const download = await downloading,
      archive = unzipSync(await readFile((await download.path())!));
    expect(
      Object.entries(archive)
        .filter(([name]) => name.endsWith('.json') && name !== 'recovery.json')
        .map(([, bytes]) => strFromU8(bytes))
        .join(''),
    ).toContain('My disconnected contribution.');
    expect(
      Object.entries(archive)
        .filter(([name]) => name.endsWith('.json') && name !== 'recovery.json')
        .map(([, bytes]) => strFromU8(bytes))
        .join(''),
    ).toContain('Another disconnected contribution.');
    const manifest = JSON.parse(strFromU8(archive['recovery.json'])),
      original = manifest.drafts.find(
        (draft: { pageId: string; generation: string }) =>
          draft.pageId === note.id && draft.generation === '1',
      );
    const changed = new Y.Doc();
    Y.applyUpdate(changed, archive[original.yjsFile]);
    const paragraph = changed.getXmlFragment('default').get(0) as Y.XmlElement,
      text = paragraph.get(0) as Y.XmlText;
    text.insert(text.length, ' Newer retained addition.');
    const newer = Array.from(Y.encodeStateAsUpdate(changed));
    changed.destroy();
    const editorSession = await (await secondContext.request.get('/api/session')).json(),
      key = `${editorSession.user.id}:${original.workspaceId}:${original.pageId}:${original.generation}`;
    let arrived!: () => void;
    const requested = new Promise<void>((resolve) => {
      arrived = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let attempt = 0;
    await second.route(`**/api/workspaces/${session.workspaces[0].id}/pages`, async (route) => {
      if (
        route.request().method() !== 'POST' ||
        route.request().postDataJSON().purpose !== 'recovery'
      ) {
        await route.continue();
        return;
      }
      if (attempt++ === 0) {
        const response = await route.fetch();
        initialCopyId = (await response.json()).id;
        await route.fulfill({
          status: 503,
          json: { code: 'UNAVAILABLE', message: 'Recovery response unavailable' },
        });
        return;
      }
      if (attempt === 2) {
        arrived();
        await gate;
      }
      await route.continue();
    });
    await second
      .getByRole('button', { name: 'Recover as private page', exact: true })
      .first()
      .click();
    await expect(
      second.getByRole('region', { name: 'Local recovery', exact: true }).getByRole('alert'),
    ).toContainText('Recovery response unavailable');
    const renamedSource = await (await firstContext.request.get(`/api/pages/${note.id}`)).json();
    await firstContext.request.patch(`/api/pages/${note.id}`, {
      headers: { 'x-note-request': '1' },
      data: { revision: renamedSource.revision, title: 'Renamed retained draft source' },
    });
    await expect(second.locator('.local-draft strong').first()).toHaveText(
      'Renamed retained draft source',
    );
    await expect(
      second.getByRole('button', { name: 'Recover as private page', exact: true }),
    ).toHaveCount(2);
    for (const [index, contribution] of [
      'My disconnected contribution.',
      'Newer retained addition.',
      'Another disconnected contribution.',
    ].entries()) {
      await expect(
        second.getByRole('button', { name: 'Recover as private page', exact: true }).first(),
      ).toBeVisible();
      await second
        .getByRole('button', { name: 'Recover as private page', exact: true })
        .first()
        .click();
      if (index === 0) {
        await requested;
        await second.evaluate(
          async ({ key, newer }) => {
            const path = '/src/documents/recovery.ts',
              { openRecovery } = await import(path),
              storage = await openRecovery();
            try {
              await storage.write(key, new Uint8Array(newer), true);
            } finally {
              storage.close();
            }
          },
          { key, newer },
        );
        release?.();
      }
      await expect(second.getByRole('textbox', { name: 'Page title', exact: true })).toHaveValue(
        `Recovered: ${index === 0 ? note.title : 'Renamed retained draft source'}`,
      );
      await expect(
        second.getByRole('textbox', { name: 'Page content', exact: true }),
      ).toContainText(contribution);
      await expect(second.locator('.save-status')).toHaveText('Saved');
      const id = new URL(second.url()).hash.slice(1).split('/')[0];
      recoveredIds.push(id);
      if (index === 0) expect(id).toBe(initialCopyId);
      expect((await (await secondContext.request.get(`/api/pages/${id}`)).json()).visibility).toBe(
        'private',
      );
      expect((await firstContext.request.get(`/api/pages/${id}`)).status()).toBe(403);
      await second.getByRole('button', { name: 'Account menu', exact: true }).click();

      await second.getByRole('menuitem', { name: 'Settings', exact: true }).click();
      await second.getByRole('dialog').getByRole('tab', { name: 'Data', exact: true }).click();
    }
    await expect(
      second.getByRole('button', { name: 'Recover as private page', exact: true }),
    ).toHaveCount(0);
    await second
      .getByRole('dialog')
      .getByRole('button', { name: 'Close dialog', exact: true })
      .click();
    await second.getByRole('button', { name: 'All pages', exact: true }).click();
    await second.getByRole('button', { name: 'Account menu', exact: true }).click();

    await second.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
    await expect(
      second.getByRole('button', { name: 'Open demo workspace', exact: true }),
    ).toBeVisible();
  } finally {
    await secondContext.setOffline(false);
    release?.();
    if (recoveredIds.length || initialCopyId) {
      await secondContext.request.post('/api/auth/sign-in/email', {
        data: { email: 'amelia@note.test', password: 'Note-local-demo-2026' },
        headers: { origin: APP_ORIGIN },
      });
      for (const id of new Set([...recoveredIds, ...(initialCopyId ? [initialCopyId] : [])]))
        await secondContext.request.delete(`/api/pages/${id}`, { headers }).catch(() => {});
    }
    await firstContext.request.delete(`/api/pages/${note.id}`, { headers }).catch(() => {});
    await firstContext.close();
    await secondContext.close();
  }
});

test('commenting on a record selection targets that record and retains failed comment drafts', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json(),
    headers = { 'x-note-request': '1' };
  const database = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Discussion records ${Date.now()}`, kind: 'database' },
      headers,
    })
  ).json();
  const record = await (
    await context.request.post(`/api/databases/${database.id}/records`, {
      data: { title: 'Selected record', values: {} },
      headers,
    })
  ).json();
  const page = await context.newPage();
  try {
    await page.goto(`/#${database.id}/database`);
    await page.getByRole('button', { name: 'Inspect Selected record', exact: true }).click();
    const body = page
      .getByRole('region', { name: 'Record details', exact: true })
      .getByRole('textbox', { name: 'Page content', exact: true });
    await body.fill('Evidence from a record');
    await expect(
      page.getByRole('status', { name: 'Record document status', exact: true }),
    ).toHaveText('Saved');
    await body.click();
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('Control+Shift+End');
    await expect(
      page.getByRole('button', { name: 'Comment on selection', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Comment on selection', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(record.pageId));
    await expect(page.locator('.discussion-quote')).toContainText('Evidence from a record');
    await page
      .getByRole('textbox', { name: 'New comment', exact: true })
      .fill('Preserve this feedback');
    await page.route(`**/api/pages/${record.pageId}/discussions`, async (route) => {
      if (route.request().method() === 'POST')
        await route.fulfill({
          status: 503,
          json: { code: 'UNAVAILABLE', message: 'Test save unavailable' },
        });
      else await route.continue();
    });
    await page.getByRole('button', { name: 'Post comment', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Test save unavailable');
    await expect(page.getByRole('textbox', { name: 'New comment', exact: true })).toHaveValue(
      'Preserve this feedback',
    );
    await page.unroute(`**/api/pages/${record.pageId}/discussions`);
    await page.route(`**/api/pages/${record.pageId}/discussions`, async (route) => {
      if (route.request().method() === 'POST')
        await new Promise((resolve) => setTimeout(resolve, 600));
      await route.continue();
    });
    await page.getByRole('button', { name: 'Post comment', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'New comment', exact: true })
      .fill('Next feedback draft');
    await expect(page.getByRole('button', { name: /Preserve this feedback/ })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'New comment', exact: true })).toHaveValue(
      'Next feedback draft',
    );
    await page.getByRole('tab', { name: 'Version history', exact: true }).click();
    await page.getByRole('tab', { name: 'Comments', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'New comment', exact: true })).toHaveValue(
      'Next feedback draft',
    );
    const comments = await (
      await context.request.get(`/api/pages/${record.pageId}/discussions`)
    ).json();
    expect(comments.threads[0].quote).toBe('Evidence from a record');
    expect(
      (await (await context.request.get(`/api/pages/${database.id}/discussions`)).json()).threads,
    ).toEqual([]);
    await page.setViewportSize({ width: 360, height: 844 });
    const content = page.getByRole('textbox', { name: 'Page content', exact: true });
    await content.fill('WWWWWWWWWWWWWWWWWWW');
    await content.click();
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('End');
    await page.keyboard.press('Shift+ArrowLeft');
    const toolbar = page.getByRole('toolbar', { name: 'Selection formatting', exact: true });
    await expect(toolbar).toBeVisible();
    const bounds = await toolbar.boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
    await expect(page.locator('.save-status')).toHaveText('Saved');
  } finally {
    await context.request.delete(`/api/pages/${database.id}`, { headers }).catch(() => {});
    await context.close();
  }
});

test('a private move revokes discussion and history access and clears displayed page activity', async ({
  browser,
}) => {
  const contexts = [];
  for (const email of ['jonathan@note.test', 'amelia@note.test']) {
    const context = await browser.newContext({ baseURL: APP_ORIGIN });
    await context.request.post('/api/auth/sign-in/email', {
      data: { email, password: 'Note-local-demo-2026' },
      headers: { origin: APP_ORIGIN },
    });
    contexts.push(context);
  }
  const [owner, editor] = contexts,
    session = await (await owner.request.get('/api/session')).json(),
    headers = { 'x-note-request': '1' },
    stamp = Date.now();
  const parent = await (
    await owner.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Discussion private ${stamp}`, visibility: 'private' },
      headers,
    })
  ).json();
  const note = await (
    await owner.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Discussion access ${stamp}` },
      headers,
    })
  ).json();
  const checkpoint = await (
    await owner.request.post(`/api/pages/${note.id}/history`, {
      data: { label: `Access version ${stamp}` },
      headers,
    })
  ).json();
  await owner.request.post(`/api/pages/${note.id}/discussions`, {
    data: { body: `Confidential discussion ${stamp}` },
    headers,
  });
  const page = await editor.newPage();
  try {
    await page.goto(`/#${note.id}/document`);
    await page.getByRole('button', { name: 'Open comments', exact: true }).click();
    await expect(
      page.getByRole('button', { name: new RegExp(`Confidential discussion ${stamp}`) }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Version history', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`Access version ${stamp}`) }).click();
    await expect(page.getByRole('region', { name: 'Version preview', exact: true })).toContainText(
      `Access version ${stamp}`,
    );
    const current = await (await owner.request.get(`/api/pages/${note.id}`)).json();
    expect(
      (
        await owner.request.post(`/api/pages/${note.id}/move`, {
          data: { parentId: parent.id, revision: current.revision, confirmed: true },
          headers,
        })
      ).status(),
    ).toBe(200);
    await expect(page.getByRole('textbox', { name: 'Page title', exact: true })).not.toHaveValue(
      note.title,
    );
    await expect(page.locator('body')).not.toContainText(`Access version ${stamp}`);
    await expect(page.locator('body')).not.toContainText(`Confidential discussion ${stamp}`);
    expect((await editor.request.get(`/api/pages/${note.id}/discussions`)).status()).toBe(403);
    expect(
      (await editor.request.get(`/api/pages/${note.id}/history/${checkpoint.id}`)).status(),
    ).toBe(403);
    expect(
      (
        await editor.request.post(`/api/pages/${note.id}/discussions`, {
          data: { body: 'No longer allowed' },
          headers,
        })
      ).status(),
    ).toBe(403);
  } finally {
    for (const item of [parent, note])
      await owner.request.delete(`/api/pages/${item.id}`, { headers }).catch(() => {});
    for (const context of contexts) await context.close();
  }
});

test('paging discussions and history retains the selected page during live refresh', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json(),
    headers = { 'x-note-request': '1' };
  const note = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Discussion paging ${Date.now()}` },
      headers,
    })
  ).json();
  try {
    for (let index = 1; index <= 41; index++) {
      expect(
        (
          await context.request.post(`/api/pages/${note.id}/discussions`, {
            data: { body: `Paged discussion ${index}` },
            headers,
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await context.request.post(`/api/pages/${note.id}/history`, {
            data: { label: `Paged version ${index}` },
            headers,
          })
        ).status(),
      ).toBe(200);
    }
    const page = await context.newPage();
    await page.goto(`/#${note.id}/document`);
    await page.getByRole('button', { name: 'Open comments', exact: true }).click();
    await expect(page.locator('.discussion-summary')).toHaveCount(40);
    await page.getByRole('button', { name: 'More discussions', exact: true }).click();
    await expect(page.locator('.discussion-summary')).toHaveCount(1);
    await expect(page.locator('.discussion-summary')).toContainText('Paged discussion 1');
    await page.waitForResponse((response) =>
      response.url().includes(`/pages/${note.id}/discussions?resolved=false&offset=40`),
    );
    await expect(page.locator('.discussion-summary')).toHaveCount(1);
    await page.getByRole('button', { name: 'Previous discussions', exact: true }).click();
    await expect(page.locator('.discussion-summary')).toHaveCount(40);
    await page.getByRole('tab', { name: 'Version history', exact: true }).click();
    await expect(page.locator('.version-entry')).toHaveCount(40);
    await page.getByRole('button', { name: 'Older versions', exact: true }).click();
    const oldest = page
      .locator('.version-entry')
      .filter({ has: page.getByText('Paged version 1', { exact: true }) });
    await expect(oldest).toBeVisible();
    await page.waitForResponse((response) =>
      response.url().includes(`/pages/${note.id}/history?offset=40`),
    );
    await expect(oldest).toBeVisible();
    await page.getByRole('button', { name: 'Newer versions', exact: true }).click();
    await expect(page.locator('.version-entry')).toHaveCount(40);
  } finally {
    await context.request.delete(`/api/pages/${note.id}`, { headers }).catch(() => {});
    await context.close();
  }
});
