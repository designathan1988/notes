import { test, expect } from './test.js';
import { APP_ORIGIN } from './origin.js';

test('themed selects support labels, keyboard navigation, dialog dismissal and form values', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'New page options', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const kind = dialog.getByRole('combobox', { name: 'Page type', exact: true });
  await kind.click();
  await page.getByRole('option', { name: 'Database', exact: true }).click();
  await expect(kind).toHaveAttribute('aria-expanded', 'false');
  await expect(kind).toContainText('Database');
  await expect(kind).toBeFocused();
  await kind.press('ArrowDown');
  await expect(kind).toHaveAccessibleName('Page type');
  await expect(dialog.getByRole('listbox')).toBeVisible();
  await kind.press('End');
  await expect(kind).toHaveAccessibleName('Page type');
  await kind.press('Enter');
  await expect(kind).toContainText('Canvas');
  await kind.press('Home');
  await kind.press('Enter');
  await expect(kind).toContainText('Page');
  await kind.press('d');
  await kind.press('Enter');
  await expect(kind).toContainText('Document');
  await kind.click();
  await kind.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('listbox')).toHaveCount(0);
  await kind.click();
  await kind.press('Tab');
  await expect(dialog.getByRole('listbox')).toHaveCount(0);
  const title = `Select form ${Date.now()}`;
  await dialog.getByLabel('Title', { exact: true }).fill(title);
  await dialog.getByRole('button', { name: 'Create page', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Page title', { exact: true })).toHaveValue(title);
  await page.getByRole('button', { name: 'Page actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Move page', exact: true }).click();
  const destination = page.getByRole('combobox', { name: 'Destination', exact: true });
  await expect(destination).toBeFocused();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await context.close();
});

test('multi-select keeps keyboard focus across saves and persists two choices', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await context.request.post('/api/auth/sign-in/email', {
    data: { email: 'jonathan@note.test', password: 'Note-local-demo-2026' },
    headers: { origin: APP_ORIGIN },
  });
  const headers = { 'x-note-request': '1' };
  const session = await (await context.request.get('/api/session')).json();
  const database = await (
    await context.request.post(`/api/workspaces/${session.workspaces[0].id}/pages`, {
      data: { title: `Multiple selection ${Date.now()}`, kind: 'database' },
      headers,
    })
  ).json();
  await context.request.put(`/api/databases/${database.id}/fields`, {
    data: {
      revision: 1,
      fields: [
        { id: 'labels', name: 'Labels', type: 'multi-select', options: ['Red', 'Green', 'Blue'] },
      ],
    },
    headers,
  });
  const record = await (
    await context.request.post(`/api/databases/${database.id}/records`, {
      data: { title: 'Choices', values: { labels: ['Red'] } },
      headers,
    })
  ).json();
  const page = await context.newPage();
  try {
    await page.goto(`/#${database.id}/database`);
    const labels = page.getByRole('combobox', { name: 'Labels for Choices', exact: true });
    await labels.locator('..').evaluate((element) => {
      element.style.transform = 'translate(80px, 40px) scale(0.75)';
      element.style.overflow = 'hidden';
      element.style.maxHeight = '30px';
    });
    await labels.click();
    const triggerBox = (await labels.boundingBox())!;
    const popupBox = (await page.getByRole('listbox').boundingBox())!;
    expect(Math.abs(popupBox.y - triggerBox.y - triggerBox.height - 5)).toBeLessThan(2);
    expect(popupBox.x).toBeGreaterThanOrEqual(8);
    expect(popupBox.x + popupBox.width).toBeLessThanOrEqual(1536 - 8);
    await page.getByRole('option', { name: 'Green', exact: true }).click();
    await expect(labels).not.toHaveAttribute('aria-busy', 'true');
    await expect(labels).toBeFocused();
    await expect(labels).toHaveAttribute('aria-expanded', 'true');
    await labels.press('End');
    await labels.press('Enter');
    await expect(labels).not.toHaveAttribute('aria-busy', 'true');
    await expect(labels).toBeFocused();
    await labels.press('Escape');
    await expect(labels).toHaveAttribute('aria-expanded', 'false');
    await expect
      .poll(async () => {
        const saved = await (await context.request.get(`/api/databases/${database.id}`)).json();
        return saved.records.find((item: { id: string }) => item.id === record.id)?.values.labels;
      })
      .toEqual(['Red', 'Green', 'Blue']);
    await page.reload();
    await expect(labels.locator('.select-chip')).toHaveText(['Red', 'Green', 'Blue']);
    await page.setViewportSize({ width: 390, height: 844 });
    await labels.click();
    const mobileBox = (await page.getByRole('listbox').boundingBox())!;
    expect(mobileBox.x).toBeGreaterThanOrEqual(8);
    expect(mobileBox.x + mobileBox.width).toBeLessThanOrEqual(390 - 8);
    expect(mobileBox.y + mobileBox.height).toBeLessThanOrEqual(844 - 8);
    await labels.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
  } finally {
    await context.request.delete(`/api/pages/${database.id}`, { headers });
    await context.close();
  }
});
