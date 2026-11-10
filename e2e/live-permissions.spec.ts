import { APP_ORIGIN } from './origin.js';
import { test, expect, type BrowserContext } from './test.js';
async function signIn(context: BrowserContext, email: string) {
  await context.request.post('/api/auth/sign-in/email', {
    data: { email, password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
}
test('a graph already open in another identity removes a page when its root becomes private', async ({
  browser,
}) => {
  const owner = await browser.newContext({ baseURL: APP_ORIGIN }),
    editor = await browser.newContext({ baseURL: APP_ORIGIN });
  await signIn(owner, 'jonathan@note.test');
  await signIn(editor, 'amelia@note.test');
  const session = await (await owner.request.get('/api/session')).json();
  const workspace = session.workspaces[0].id;
  const create = async (data: unknown) =>
    await (
      await owner.request.post(`/api/workspaces/${workspace}/pages`, {
        data,
        headers: { 'x-note-request': '1' },
      })
    ).json();
  const privateRoot = await create({
    title: `Private visibility ${Date.now()}`,
    visibility: 'private',
  });
  const target = await create({ title: `Visibility probe ${Date.now()}` });
  const page = await editor.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Knowledge graph', exact: true }).click();
  await expect(page.getByRole('link', { name: `Open ${target.title}`, exact: true })).toBeVisible();
  const moved = await owner.request.post(`/api/pages/${target.id}/move`, {
    data: { parentId: privateRoot.id, revision: target.revision, confirmed: true },
    headers: { 'x-note-request': '1' },
  });
  expect(moved.ok()).toBe(true);
  await expect(page.getByRole('link', { name: `Open ${target.title}`, exact: true })).toHaveCount(
    0,
  );
  await owner.request.delete(`/api/pages/${privateRoot.id}`, {
    headers: { 'x-note-request': '1' },
  });
  await owner.close();
  await editor.close();
});
