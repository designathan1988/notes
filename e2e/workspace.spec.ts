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
  await one.click();await one.press('Control+End');await one.press('Enter');await expect(two.locator('p')).toHaveCount(2);
  await one.locator('p').first().click();await two.locator('p').last().click();
  await Promise.all([one.pressSequentially('Alpha '),two.pressSequentially('Beta ')]);
  await expect(one).toContainText('Alpha');await expect(one).toContainText('Beta');await expect(two).toContainText('Alpha');await expect(two).toContainText('Beta');
  await expect(a.locator('.save-status')).toHaveText('Saved');await expect(b.locator('.save-status')).toHaveText('Saved');
  await a.reload();await expect(a.getByRole('textbox',{name:'Page content'})).toContainText('Alpha');await expect(a.getByRole('textbox',{name:'Page content'})).toContainText('Beta');
  await first.request.delete(`/api/pages/${page.id}`,{headers:{'x-note-request':'1'}});
  await first.close();await second.close();
});
test('pastes rich content safely and persists original source and uploaded image bytes',async({browser})=>{
  const context=await browser.newContext({baseURL:'http://127.0.0.1:5173'});await signIn(context);
  const session=await(await context.request.get('/api/session')).json();const created=await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`,{data:{title:`Capture check ${Date.now()}`},headers:{'x-note-request':'1'}});const note=await created.json();
  const page=await context.newPage();await page.goto(`/#${note.id}/document`);await expect(page.locator('.save-status')).toHaveText('Saved');
  const original='<h2>Captured heading</h2><p><strong>Keep this formatting</strong></p><button onclick="window.pastedScriptExecuted=true">Interactive source</button>';
  await page.getByRole('textbox',{name:'Page content'}).evaluate((element,html)=>{const data=new DataTransfer();data.setData('text/html',html);data.setData('text/plain','Captured heading');element.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));},original);
  await expect(page.getByRole('textbox',{name:'Page content'})).toContainText('Keep this formatting');await expect(page.locator('.attachment-block a')).toHaveText('Original pasted content.html');
  expect(await page.evaluate(()=>('pastedScriptExecuted' in window))).toBe(false);
  const originalUrl=await page.locator('.attachment-block a').getAttribute('href');const download=await context.request.get(originalUrl!);expect(await download.text()).toBe(original);expect(download.headers()['content-disposition']).toContain('attachment');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  await page.locator('input[type=file]').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:png});await expect(page.locator('.attachment-block img')).toBeVisible();await expect(page.locator('.save-status')).toHaveText('Saved');
  await page.reload();await expect(page.locator('.attachment-block img')).toBeVisible();const imageUrl=await page.locator('.attachment-block img').getAttribute('src');expect((await(await context.request.get(imageUrl!)).body()).equals(png)).toBe(true);
  await context.request.delete(`/api/pages/${note.id}`,{headers:{'x-note-request':'1'}});await context.close();
});
test('creates and edits a structured record, finds its body, and follows its graph connection',async({browser})=>{
  const context=await browser.newContext({baseURL:'http://127.0.0.1:5173'});await signIn(context);const page=await context.newPage();await page.goto('/');
  await page.getByRole('button',{name:'Database',exact:true}).click();await expect(page.getByRole('table',{name:'Database records'})).toBeVisible();
  await page.locator('.table-actions').getByRole('button',{name:'New record'}).click();const title=`Discovery check ${Date.now()}`;
  await page.getByRole('dialog').getByLabel('Name',{exact:true}).fill(title);await page.getByRole('button',{name:'Create record',exact:true}).click();
  await page.getByLabel(`Status for ${title}`,{exact:true}).selectOption('Active');await expect(page.getByLabel(`Status for ${title}`,{exact:true})).toHaveValue('Active');
  await page.getByRole('button',{name:`Open ${title}`,exact:true}).click();await expect(page.getByLabel('Page title',{exact:true})).toHaveValue(title);await expect(page.locator('.save-status')).toHaveText('Saved');
  const id=page.url().split('#')[1].split('/')[0];await page.getByRole('textbox',{name:'Page content'}).pressSequentially('uniquediscoveryphrase ');
  await page.getByRole('button',{name:'Insert link',exact:true}).click();await page.getByRole('dialog').getByRole('textbox').fill('Product direction');await page.getByRole('dialog').getByRole('button',{name:'Product direction',exact:true}).click();await expect(page.locator('.save-status')).toHaveText('Saved');
  await page.getByRole('button',{name:'Search anything Ctrl K'}).click();await page.getByLabel('Search query',{exact:true}).fill('uniquediscoveryphrase');await expect(page.getByRole('option').filter({hasText:title})).toBeVisible();await page.getByRole('option').filter({hasText:title}).click();
  const session=await(await context.request.get('/api/session')).json();await expect.poll(async()=>{const graph=await(await context.request.get(`/api/workspaces/${session.workspaces[0].id}/graph`)).json();return graph.edges.some((edge:{source:string})=>edge.source===id);}).toBe(true);
  await page.getByRole('button',{name:'Graph',exact:true}).click();await expect(page.getByRole('img',{name:'Workspace knowledge graph'})).toBeVisible();await page.getByRole('link',{name:'Open Product direction',exact:true}).click();await expect(page.getByLabel('Page title',{exact:true})).toHaveValue('Product direction');
  await context.request.delete(`/api/pages/${id}`,{headers:{'x-note-request':'1'}});await context.close();
});
