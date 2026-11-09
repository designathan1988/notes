import { expect, test } from 'vitest';
import type { Page } from '@note/contracts';
import { trashResults } from '../apps/web/src/settings/trash.js';
const page = (id: string, title: string, deletedAt: string, parentId: string | null = null) =>
  ({ id, title, deletedAt, parentId }) as Page;

test('trash sorts newest roots first and searches descendant titles without orphaning restore actions', () => {
  const pages = [
    page('old', 'Old parent', '2026-11-01'),
    page('child', 'Find this child', '2026-11-02', 'old'),
    page('new', 'New parent', '2026-11-09'),
  ];
  expect(trashResults(pages, '', 0).pages.map((p) => p.id)).toEqual(['new', 'old']);
  expect(trashResults(pages, 'FIND THIS', 0).pages.map((p) => p.id)).toEqual(['old']);
});
test('thousands of deleted pages yield bounded pages and clamp a stale page index', () => {
  const pages = Array.from({ length: 2001 }, (_, i) => page(String(i), `Page ${i}`, '2026-11-01'));
  const first = trashResults(pages, '', 0);
  expect(first.pages).toHaveLength(50);
  expect(first.total).toBe(2001);
  expect(first.pageCount).toBe(41);
  const last = trashResults(pages, '', 999);
  expect(last.pageIndex).toBe(40);
  expect(last.pages).toHaveLength(1);
  expect(trashResults(pages, 'no matches', 999)).toMatchObject({
    pages: [],
    total: 0,
    pageIndex: 0,
  });
});

test('deep matching descendants deduplicate to their root while standalone deleted children remain restorable', () => {
  const pages = [
    page('root', 'Root', '2026-11-03'),
    page('middle', 'Needle middle', '2026-11-03', 'root'),
    page('deep', 'Needle deep', '2026-11-03', 'middle'),
    page('standalone', 'Needle standalone', '2026-11-04', 'live-parent'),
  ];
  const result = trashResults(pages, 'needle', 0);
  expect(result.total).toBe(2);
  expect(result.pages.map((p) => p.id)).toEqual(['standalone', 'root']);
});
