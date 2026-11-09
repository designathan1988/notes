import { expect, type Locator } from '@playwright/test';

/** Read the backing form value while exercising the visible themed control. */
export function selectValue(control: Locator) {
  return control.locator('..').locator('select');
}

export async function selectOption(control: Locator, value: string | { label: string }) {
  await expect(control).toBeVisible();
  const option = selectValue(control).locator('option');
  const label = await option.evaluateAll((items, target) => {
    const item = (items as HTMLOptionElement[]).find((item) =>
      typeof target === 'string' ? item.value === target : item.label === target.label,
    );
    return item?.label;
  }, value);
  expect(label, `Option ${value} exists`).toBeDefined();
  await control.click();
  const list = control.page().getByRole('listbox');
  await list.getByRole('option', { name: label!, exact: true }).click();
}
