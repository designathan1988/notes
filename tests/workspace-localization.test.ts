import { afterEach, expect, test } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SignIn } from '../apps/web/src/identity/SignIn.js';
import { Home, edited, recentPages } from '../apps/web/src/home/Home.js';
import { useWorkspace, type WorkspaceState } from '../apps/web/src/state/store.js';
import { availableCommands, commands } from '../apps/web/src/workbench/commands.js';
import { setLocale, t } from '../apps/web/src/i18n/index.js';
import catalog from '../apps/web/src/i18n/workspace.pt-BR.js';

const initial = useWorkspace.getState();
afterEach(() => {
  setLocale('en-US');
  useWorkspace.setState(initial, true);
});

test('sign-in labels switch both ways with the device language', () => {
  setLocale('en-US');
  const english = renderToStaticMarkup(createElement(SignIn));
  expect(english).toContain('Welcome back');
  expect(english).toContain('aria-label="Language"');
  setLocale('pt-BR');
  const portuguese = renderToStaticMarkup(createElement(SignIn));
  expect(portuguese).toContain('Boas-vindas de volta');
  expect(portuguese).toContain('aria-label="Idioma"');
  expect(portuguese).toContain('Senha');
  expect(portuguese).not.toContain('Welcome back');
  setLocale('en-US');
  expect(renderToStaticMarkup(createElement(SignIn))).toBe(english);
});

test('Portuguese commands are searchable while command identities remain stable', () => {
  setLocale('pt-BR');
  const state = {
    user: { id: 'member' },
    workspaceId: 'studio',
    workspaces: [{ id: 'studio', role: 'editor' }],
    pages: [],
    tabs: [],
    closedTabs: [],
  } as unknown as WorkspaceState;
  expect(availableCommands(state, 'aparência').map((command) => command.id)).toContain(
    'appearance.app',
  );
  expect(availableCommands(state, 'nova página').map((command) => command.id)).toContain(
    'page.new',
  );
  for (const command of commands) expect(catalog[command.title]).toBeTruthy();
  expect(commands.find((command) => command.id === 'page.new')?.title).toBe('New page');
});

test('home chrome and relative times translate while recent-page titles stay authored', () => {
  setLocale('pt-BR');
  useWorkspace.setState({
    user: { id: 'member', name: 'Search', email: 'member@example.com' },
    workspaceId: 'studio',
    workspaces: [{ id: 'studio', name: 'Workspace', role: 'owner' }],
    pages: [
      {
        id: 'page',
        title: 'Untitled',
        kind: 'document',
        deletedAt: null,
        parentId: null,
        updatedAt: '2026-11-08T12:00:00Z',
      },
    ] as typeof initial.pages,
  });
  const markup = renderToStaticMarkup(createElement(Home));
  expect(markup).toContain('Recentes');
  expect(recentPages(useWorkspace.getState().pages)[0].title).toBe('Untitled');
  expect(edited('2026-11-08T11:30:00Z', Date.parse('2026-11-08T12:00:00Z'))).toBe('há 30 minutos');
  expect(edited('2026-11-08T11:59:50Z', Date.parse('2026-11-08T12:00:00Z'))).toBe('agora mesmo');
});

test('catalog translations preserve every interpolation token', () => {
  const tokens = (value: string) =>
    [...value.matchAll(/\{\{\w+\}\}/g)].map((match) => match[0]).sort();
  for (const [key, translation] of Object.entries(catalog))
    expect(tokens(translation), key).toEqual(tokens(key));
  setLocale('pt-BR');
  expect(t('Restore {{title}}', { title: 'Research' })).toBe('Restaurar Research');
});
