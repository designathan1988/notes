import { expect, type Page } from '@playwright/test';

/**
 * The workspace-wide catalogs (all pages, databases, canvases, templates) have no buttons in the
 * sidebar: pages of every kind are created and listed in the page tree. They stay one command
 * away, which is how these specs reach them, exactly as a person using the keyboard would.
 */
const commands = {
  all: { command: 'Open all pages', region: 'All pages' },
  database: { command: 'Open databases', region: 'Databases' },
  canvas: { command: 'Open canvases', region: 'Canvases' },
  templates: { command: 'Open templates', region: 'Templates' },
} as const;

export async function openCatalog(page: Page, view: keyof typeof commands) {
  const { command } = commands[view];
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  // Right after a navigation the shortcut may not be listened for yet: press until it opens.
  await expect(async () => {
    if (!(await palette.isVisible())) await page.keyboard.press('Control+Shift+p');
    await expect(palette).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 5000 });
  await palette.getByRole('combobox').fill(command);
  await palette
    .getByRole('option', { name: new RegExp(command, 'i') })
    .first()
    .click();
  await expect(palette).toBeHidden();
}

/** The region a catalog renders, for assertions after `openCatalog`. */
export const catalogName = (view: keyof typeof commands) => commands[view].region;
