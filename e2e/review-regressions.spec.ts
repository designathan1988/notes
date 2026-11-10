import { APP_ORIGIN, COLLABORATION_URL } from './origin.js';
import { test, expect, type BrowserContext } from './test.js';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import * as Y from 'yjs';
import WebSocket from 'ws';

const headers = { 'x-note-request': '1' };
async function signedIn(context: BrowserContext) {
  expect(
    (
      await context.request.post('/api/auth/sign-in/email', {
        headers: { origin: APP_ORIGIN },
        data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
      })
    ).ok(),
  ).toBe(true);
  return (await context.request.get('/api/session')).json();
}

test('shared page CSS stays inside its page even when its source contains unmatched scope delimiters', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN }),
    session = await signedIn(context);
  const note = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      headers,
      data: { title: 'Scoped appearance regression' },
    })
  ).json();
  try {
    expect(
      (
        await context.request.patch(`/api/pages/${note.id}`, {
          headers,
          data: {
            revision: note.revision,
            appearance: {
              customCss:
                '.page-title { font-style: italic; } } .workspace-select { display: none; } @scope ([data-styled-page="unrelated"]) {',
            },
          },
        })
      ).ok(),
    ).toBe(true);
    const page = await context.newPage();
    await page.goto(`/#${note.id}/document`);
    await expect(page.getByLabel('Page title', { exact: true })).toHaveCSS('font-style', 'italic');
    // The page's CSS tries to hide the workspace switcher, which lives in the account menu.
    await page.getByRole('button', { name: 'Account menu', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Workspace', exact: true })).toBeVisible();
  } finally {
    await context.request.delete(`/api/pages/${note.id}`, { headers });
    await context.close();
  }
});

test('batched remote source insertions preserve the focused editing position between unchanged text', async ({
  browser,
}) => {
  const alice = await browser.newContext({ baseURL: APP_ORIGIN }),
    bob = await browser.newContext({ baseURL: APP_ORIGIN });
  const session = await signedIn(alice);
  await signedIn(bob);
  const note = await (
    await alice.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      headers,
      data: {
        title: 'Source selection regression',
        requestId: crypto.randomUUID(),
        content: {
          type: 'doc',
          content: [
            {
              type: 'webPage',
              attrs: { version: 1, entry: 'index.html' },
              content: [
                {
                  type: 'webFile',
                  attrs: { path: 'index.html', id: crypto.randomUUID() },
                  content: [{ type: 'text', text: 'abcde' }],
                },
              ],
            },
          ],
        },
      },
    })
  ).json();
  try {
    const first = await alice.newPage(),
      second = await bob.newPage();
    await first.goto(`/#${note.id}/document`);
    await second.goto(`/#${note.id}/document`);
    const a = first.getByRole('textbox', { name: 'index.html source', exact: true }),
      b = second.getByRole('textbox', { name: 'index.html source', exact: true });
    await expect(a).toHaveText('abcde');
    await expect(b).toHaveText('abcde');
    await expect(first.locator('.save-status')).toHaveText('Saved');
    await expect(second.locator('.save-status')).toHaveText('Saved');
    await a.press('Control+Home');
    await a.press('ArrowRight');
    await a.press('ArrowRight');
    const cookie = (await bob.cookies()).map((value) => `${value.name}=${value.value}`).join('; ');
    class AuthenticatedSocket extends WebSocket {
      constructor(url: string) {
        super(url, { headers: { cookie, origin: APP_ORIGIN } });
      }
    }
    const generation = (await (await bob.request.get(`/api/pages/${note.id}/document`)).json())
      .generation;
    const document = new Y.Doc(),
      transport = new HocuspocusProviderWebsocket({
        url: COLLABORATION_URL,
        WebSocketPolyfill: AuthenticatedSocket,
      });
    const provider = new HocuspocusProvider({
      websocketProvider: transport,
      name: `${note.id}:${generation}`,
      document,
      token: 'cookie-session',
    });
    provider.attach();
    try {
      await expect.poll(() => provider.synced).toBe(true);
      const root = document.getXmlFragment('default').get(0) as Y.XmlElement,
        file = root.get(0) as Y.XmlElement,
        text = file.get(0) as Y.XmlText;
      document.transact(() => {
        text.insert(text.length, 'Y');
        text.insert(0, 'X');
      });
      await expect(a).toHaveText('XabcdeY');
    } finally {
      provider.destroy();
      transport.destroy();
      document.destroy();
    }
    await expect(a).toHaveText('XabcdeY');
    await first.keyboard.insertText('|');
    await expect(a).toHaveText('Xab|cdeY');
    await expect(b).toHaveText('Xab|cdeY');
    await expect(first.locator('.save-status')).toHaveText('Saved');
  } finally {
    await alice.request.delete(`/api/pages/${note.id}`, { headers });
    await Promise.all([alice.close(), bob.close()]);
  }
});
