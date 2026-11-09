import { expect, test, type Page } from '@playwright/test';
import { APP_ORIGIN } from './origin.js';

async function chooseLanguage(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function changeWorkspaceLanguage(page: Page, portuguese: boolean) {
  const currentPortuguese = (await page.locator('html').getAttribute('lang')) === 'pt-BR';
  await page
    .getByRole('button', {
      name: currentPortuguese ? 'Menu da conta' : 'Account menu',
      exact: true,
    })
    .click();
  await page
    .getByRole('menuitem', { name: currentPortuguese ? 'Configurações' : 'Settings', exact: true })
    .click();
  await page
    .getByRole('tab', { name: currentPortuguese ? 'Conta' : 'Account', exact: true })
    .click();
  await chooseLanguage(
    page,
    currentPortuguese ? 'Idioma' : 'Language',
    portuguese ? 'Português (Brasil)' : 'English (US)',
  );
  await page
    .getByRole('button', { name: portuguese ? 'Fechar janela' : 'Close dialog', exact: true })
    .click();
}

test('sign-in language works with keyboard, persists and leaves form input intact', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('draft@example.test');
  const language = page.getByRole('combobox', { name: 'Language', exact: true });
  await language.press('ArrowDown');
  await language.press('End');
  await language.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.getByRole('combobox', { name: 'Idioma', exact: true })).toContainText(
    'Português',
  );
  await expect(page.getByRole('textbox', { name: 'E-mail', exact: true })).toHaveValue(
    'draft@example.test',
  );
  await page.getByLabel('Senha', { exact: true }).fill('Incorrect-demo-password');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('E-mail ou senha inválidos');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Idioma', exact: true })).toBeVisible();
  await chooseLanguage(page, 'Idioma', 'English (US)');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

test('changing language keeps the live document and synchronizes other tabs', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json();
  const title = `Locale user content ${Date.now()}`;
  const created = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      headers: { 'x-note-request': '1' },
      data: { title, kind: 'document' },
    })
  ).json();
  const page = await context.newPage();
  const other = await context.newPage();
  await page.goto(`/#${created.id}`);
  await other.goto('/');
  const editor = page.getByRole('textbox', { name: 'Page content', exact: true });
  await editor.fill('Conteúdo autoral Research — permanece igual.');
  await editor.evaluate((node) => {
    node.setAttribute('data-locale-check', 'same-editor');
  });
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Account', exact: true }).click();
  await chooseLanguage(page, 'Language', 'Português (Brasil)');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(other.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await page.getByRole('button', { name: 'Fechar janela', exact: true }).click();
  const translatedEditor = page.getByRole('textbox', { name: 'Conteúdo da página', exact: true });
  await expect(translatedEditor).toHaveAttribute('data-locale-check', 'same-editor');
  await expect(translatedEditor).toContainText('Conteúdo autoral Research — permanece igual.');
  await expect(page.getByRole('textbox', { name: 'Título da página', exact: true })).toHaveValue(
    title,
  );
  await translatedEditor.press('End');
  await translatedEditor.pressSequentially(' Continuação.');
  await expect(page.locator('.save-status').filter({ hasText: 'Salvo' }).first()).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('textbox', { name: 'Conteúdo da página', exact: true }),
  ).toContainText('Continuação.');
  await page.getByRole('button', { name: 'Adicionar um bloco', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Texto', exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Componente web', exact: true }).click();
  const component = page.locator('.web-authoring-component');
  await component.getByRole('button', { name: 'Código', exact: true }).click();
  await expect(
    component.getByRole('textbox', { name: 'Código de index.html', exact: true }),
  ).toBeVisible();
  await expect(component.getByRole('button', { name: 'Executar', exact: true })).toBeVisible();
  const source = component.getByRole('textbox', { name: 'Código de index.html', exact: true });
  await source.evaluate((node) => node.setAttribute('data-locale-check', 'same-source'));
  await component.getByRole('button', { name: 'Adicionar arquivo de código', exact: true }).click();
  await component
    .getByRole('textbox', { name: 'Caminho do arquivo', exact: true })
    .fill('../bad.js');
  await component.getByRole('button', { name: 'Adicionar arquivo', exact: true }).click();
  await expect(component.getByRole('alert')).toHaveText(
    'Use um caminho de arquivo relativo, como lib/helpers.js.',
  );
  await changeWorkspaceLanguage(page, false);
  await expect(component.getByRole('alert')).toHaveText(
    'Use a relative file path such as lib/helpers.js.',
  );
  await expect(
    component.getByRole('textbox', { name: 'index.html source', exact: true }),
  ).toHaveAttribute('data-locale-check', 'same-source');
  await expect(component.getByRole('textbox', { name: 'File path', exact: true })).toHaveValue(
    '../bad.js',
  );
  await changeWorkspaceLanguage(page, true);
  await expect(component.getByRole('alert')).toHaveText(
    'Use um caminho de arquivo relativo, como lib/helpers.js.',
  );
  await expect(source).toHaveAttribute('data-locale-check', 'same-source');
  await context.close();
});

test('Portuguese database controls retain machine values and user properties', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: APP_ORIGIN,
    viewport: { width: 390, height: 844 },
  });
  await context.addInitScript(() => localStorage.setItem('mosaic:locale', 'pt-BR'));
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const session = await (await context.request.get('/api/session')).json();
  const database = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      headers: { 'x-note-request': '1' },
      data: { title: 'Research Dados', kind: 'database' },
    })
  ).json();
  const page = await context.newPage();
  await page.goto(`/#${database.id}/database`);
  await expect(page.getByRole('textbox', { name: 'Título da página', exact: true })).toHaveValue(
    'Research Dados',
  );
  await page.getByRole('combobox', { name: 'Layout', exact: true }).click();
  await page.getByRole('option', { name: 'Calendário', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Adicionar propriedade de data', exact: true }),
  ).toBeVisible();
  await page.getByRole('combobox', { name: 'Layout', exact: true }).click();
  await page.getByRole('option', { name: 'Tabela', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Nome', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.route(`**/api/databases/${database.id}/fields`, (route) =>
    route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'CONFLICT', message: 'Invalid value for Research label.' }),
    }),
  );
  await page.getByRole('button', { name: 'Adicionar propriedade', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Adicionar uma propriedade', exact: true });
  await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill('Research label');
  await dialog.getByRole('button', { name: 'Adicionar propriedade', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Valor inválido para Research label.');
  await context.close();
});
