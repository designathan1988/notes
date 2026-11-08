import { test, expect } from '@playwright/test';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import WebSocket from 'ws';
import * as Y from 'yjs';

test('an offline connection to a concurrently deleted note settles without blocking surviving rich edits or durable acknowledgement', async ({
  page,
  context,
}) => {
  const headers = { 'x-note-request': '1' };
  await context.request.post('/api/auth/sign-in/email', {
    headers: { origin: 'http://127.0.0.1:5173' },
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
  });
  const session = await (await context.request.get('/api/session')).json();
  const response = await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
    headers,
    data: {
      title: 'Canvas merge verification',
      kind: 'canvas',
      requestId: crypto.randomUUID(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'canvasRoot',
            content: ['source', 'survivor'].map((id, index) => ({
              type: 'canvasCard',
              attrs: { id, x: index * 400 },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: `${id} original` }] }],
            })),
          },
        ],
      },
    },
  });
  expect(response.ok()).toBe(true);
  const canvas = await response.json();
  const cookie = (await context.cookies())
    .map((value) => `${value.name}=${value.value}`)
    .join('; ');
  class AuthenticatedSocket extends WebSocket {
    constructor(url: string) {
      super(url, { headers: { cookie, origin: 'http://127.0.0.1:5173' } });
    }
  }
  const transport = new HocuspocusProviderWebsocket({
    url: 'ws://127.0.0.1:3001/collaboration',
    WebSocketPolyfill: AuthenticatedSocket,
  });
  const document = new Y.Doc(),
    provider = new HocuspocusProvider({
      websocketProvider: transport,
      document,
      name: `${canvas.id}:${canvas.generation}`,
      token: 'cookie-session',
    });
  provider.attach();
  try {
    await expect.poll(() => provider.synced).toBe(true);
    await page.goto(`/#${canvas.id}/canvas`);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    transport.disconnect();
    const root = document.getXmlFragment('default').get(0) as Y.XmlElement;
    document.transact(() => {
      const edge = new Y.XmlElement('canvasEdge');
      for (const [key, value] of Object.entries({
        id: 'offline-edge',
        fromNode: 'source',
        toNode: 'survivor',
        fromSide: 'auto',
        toSide: 'auto',
        fromEnd: 'none',
        toEnd: 'arrow',
        color: 'neutral',
      }))
        edge.setAttribute(key, value);
      const label = new Y.XmlText();
      label.insert(0, 'Created before learning of deletion');
      edge.insert(0, [label]);
      root.push([edge]);
      const survivor = root
        .toArray()
        .find(
          (node) => node instanceof Y.XmlElement && node.getAttribute('id') === 'survivor',
        ) as Y.XmlElement;
      const text = (survivor.get(0) as Y.XmlElement).get(0) as Y.XmlText;
      text.insert(text.length, ' — keep this offline edit');
    });
    await page
      .locator('[data-canvas-card="source"]')
      .getByRole('button', { name: 'Move note', exact: true })
      .click();
    await page
      .getByRole('complementary', { name: 'Canvas selection', exact: true })
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(page.locator('[data-canvas-card]')).toHaveCount(1);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await transport.connect();
    await expect(page.getByRole('textbox', { name: 'Note content', exact: true })).toHaveText(
      'survivor original — keep this offline edit',
    );
    await expect(page.locator('[data-canvas-connection]')).toHaveCount(0);
    await expect
      .poll(
        () =>
          (document.getXmlFragment('default').get(0) as Y.XmlElement)
            .toArray()
            .filter((node) => node instanceof Y.XmlElement && node.nodeName === 'canvasEdge')
            .length,
      )
      .toBe(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('.save-status')).toHaveText('Saved');
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Note content', exact: true })).toHaveText(
      'survivor original — keep this offline edit',
    );
    await expect(page.locator('.save-status')).toHaveText('Saved');
  } finally {
    provider.destroy();
    transport.destroy();
    document.destroy();
    await context.request.delete(`/api/pages/${canvas.id}`, { headers }).catch(() => {});
  }
});
