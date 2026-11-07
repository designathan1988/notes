import { test,expect,type BrowserContext } from '@playwright/test';
async function signIn(context:BrowserContext,email='jonathan@note.test'){
  const response=await context.request.post('/api/auth/sign-in/email',{data:{email,password:'Note-local-demo-2026'},headers:{origin:'http://127.0.0.1:5173'}});expect(response.ok()).toBeTruthy();
}
test('two independent identities edit, persist, and reopen one shared document',async({browser})=>{
  const first=await browser.newContext({baseURL:'http://127.0.0.1:5173'});const second=await browser.newContext({baseURL:'http://127.0.0.1:5173'});
  await signIn(first);await signIn(second,'amelia@note.test');
  const session=await (await first.request.get('/api/session')).json();
  const response=await first.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`,{data:{title:`Collaboration check ${Date.now()}`},headers:{'x-note-request':'1'}});
  expect(response.ok()).toBeTruthy();const page=await response.json();
  const a=await first.newPage();const b=await second.newPage();
  await Promise.all([a.goto(`/#${page.id}/document`),b.goto(`/#${page.id}/document`)]);
  await expect(a.locator('.save-status')).toHaveText('Saved');await expect(b.locator('.save-status')).toHaveText('Saved');
  const one=a.getByRole('textbox',{name:'Page content'});const two=b.getByRole('textbox',{name:'Page content'});
  await Promise.all([one.pressSequentially('Alpha '),two.pressSequentially('Beta ')]);
  await expect(one).toContainText('Alpha');await expect(one).toContainText('Beta');await expect(two).toContainText('Alpha');await expect(two).toContainText('Beta');
  await expect(a.locator('.save-status')).toHaveText('Saved');await expect(b.locator('.save-status')).toHaveText('Saved');
  await a.reload();await expect(a.getByRole('textbox',{name:'Page content'})).toContainText('Alpha');await expect(a.getByRole('textbox',{name:'Page content'})).toContainText('Beta');
  await first.request.delete(`/api/pages/${page.id}`,{headers:{'x-note-request':'1'}});
  await first.close();await second.close();
});
