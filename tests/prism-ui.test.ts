import { expect, test } from 'vitest';
import { toneOf } from '../apps/web/src/ui/tone.js';
import { edited } from '../apps/web/src/home/Home.js';
import { GLOBAL_VIEWS, isView } from '../apps/web/src/state/views.js';

test('select values keep one stable tone regardless of case and spacing', () => {
  expect(toneOf('In progress')).toBe(toneOf('  in PROGRESS '));
  expect(toneOf('In progress')).toBeGreaterThanOrEqual(0);
  expect(toneOf('In progress')).toBeLessThan(8);
  expect(toneOf('')).toBeUndefined();
  expect(toneOf(null)).toBeUndefined();
  const tones = new Set(
    ['Research', 'Document', 'Collection', 'High', 'Medium', 'Low'].map(toneOf),
  );
  expect(tones.size).toBeGreaterThan(2);
});

test('home shows edit times relative to now', () => {
  const now = Date.parse('2026-11-08T12:00:00Z');
  expect(edited('2026-11-08T11:59:40Z', now)).toBe('just now');
  expect(edited('2026-11-08T11:30:00Z', now)).toBe('30 minutes ago');
  expect(edited('2026-11-08T07:00:00Z', now)).toBe('5 hours ago');
  expect(edited('2026-11-07T12:00:00Z', now)).toBe('yesterday');
});

test('home is a routable workspace-wide view', () => {
  expect(isView('home')).toBe(true);
  expect(isView('settings')).toBe(false);
  expect(GLOBAL_VIEWS).toContain('home');
});

test('home recent list skips empty untitled pages, records and templates', async () => {
  const { recentPages } = await import('../apps/web/src/home/Home.js');
  const page = (id: string, title: string, kind = 'document', updatedAt = '2026-11-08T10:00:00Z') =>
    ({ id, title, kind, updatedAt, deletedAt: null, templateRootId: null }) as never;
  const result = recentPages([
    page('a', 'Product direction', 'document', '2026-11-08T09:00:00Z'),
    page('b', 'Untitled'),
    page('c', 'Untitled canvas', 'canvas'),
    page('d', 'User interviews', 'record'),
    page('e', 'Research', 'database', '2026-11-08T11:00:00Z'),
  ]);
  expect(result.map((p: { id: string }) => p.id)).toEqual(['e', 'a']);
});
