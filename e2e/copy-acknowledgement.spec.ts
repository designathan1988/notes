import { expect, test, type Page } from './test.js';
import { openCatalog } from './navigate.js';
import { APP_ORIGIN } from './origin.js';

async function hasPending(page: Page, id: string) {
  return page.evaluate(
    (id) =>
      new Promise<boolean>((resolve, reject) => {
        const request = indexedDB.open('note-recovery-v1', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const keys = db.transaction('documents').objectStore('documents').getAllKeys();
          keys.onsuccess = () => {
            resolve(
              keys.result.some(
                (key) => String(key).startsWith('!pending:') && String(key).includes(`:${id}:`),
              ),
            );
            db.close();
          };
          keys.onerror = () => {
            reject(keys.error);
            db.close();
          };
        };
      }),
    id,
  );
}

test('leaving a newly opened template before its socket acknowledgement does not block an already durable copy', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  const headers = { 'x-note-request': '1' };
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json();
  const title = `Immediate saved template ${Date.now()}`;
  const sourceResponse = await context.request.post(
    `/api/workspaces/${session.workspaces[0].id}/pages`,
    {
      headers,
      data: {
        title: 'Original durable note',
        kind: 'document',
        requestId: crypto.randomUUID(),
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Canonical content before acknowledgement.' }],
            },
          ],
        },
      },
    },
  );
  expect(sourceResponse.ok(), await sourceResponse.text()).toBe(true);
  const source = await sourceResponse.json();
  const templateResponse = await context.request.post(`/api/pages/${source.id}/templates`, {
    headers,
    data: { title, requestId: crypto.randomUUID(), expectedUserId: session.user.id },
  });
  expect(templateResponse.ok(), await templateResponse.text()).toBe(true);
  const template = await templateResponse.json();
  let dropped = 0;
  await context.routeWebSocket('**/collaboration', (socket) => {
    const server = socket.connectToServer();
    server.onMessage((message) => {
      const text = message.toString();
      if (text.includes(template.id) && text.includes('"type":"durable"')) {
        dropped++;
        return;
      }
      socket.send(message);
    });
  });
  const page = await context.newPage();
  let instance: string | undefined;
  try {
    await page.goto(`/#${template.id}/document`);
    await expect(page.getByRole('textbox', { name: 'Page content', exact: true })).toContainText(
      'Canonical content before acknowledgement.',
    );
    await expect.poll(() => dropped).toBeGreaterThan(0);
    await expect.poll(() => hasPending(page, template.id)).toBe(true);
    await openCatalog(page, 'templates');
    await page.getByRole('button', { name: `Preview ${title}`, exact: true }).click();
    const verified = page.waitForResponse((response) =>
      response.url().endsWith(`/pages/${template.id}/document/acknowledgement`),
    );
    await page
      .getByRole('region', { name: 'Template preview', exact: true })
      .getByRole('button', { name: 'Use template', exact: true })
      .click();
    expect((await verified).status()).toBe(200);
    await expect(page.getByRole('textbox', { name: 'Page title', exact: true })).toBeFocused();
    instance = page.url().split('#')[1].split('/')[0];
    expect(instance).not.toBe(template.id);
    await expect(page.getByRole('textbox', { name: 'Page content', exact: true })).toContainText(
      'Canonical content before acknowledgement.',
    );
    await expect.poll(() => hasPending(page, template.id)).toBe(false);
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally {
    for (const id of [instance, template.id, source.id].filter(Boolean))
      await context.request.delete(`/api/pages/${id}`, { headers });
    await context.close();
  }
});
