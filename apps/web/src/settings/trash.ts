import type { Page } from '@note/contracts';

/** Search the whole deleted tree, but restore through its topmost deleted ancestor. */
export function trashResults(pages: Page[], query: string, requestedPage: number) {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const matches = new Set<string>();
  const needle = query.trim().toLocaleLowerCase();
  for (const page of pages) {
    if (!page.title.toLocaleLowerCase().includes(needle)) continue;
    let root = page;
    const visited = new Set([root.id]);
    while (root.parentId && byId.has(root.parentId) && !visited.has(root.parentId)) {
      root = byId.get(root.parentId)!;
      visited.add(root.id);
    }
    matches.add(root.id);
  }
  const sorted = pages
    .filter((page) => matches.has(page.id))
    .sort(
      (a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '') || a.id.localeCompare(b.id),
    );
  const pageCount = Math.max(1, Math.ceil(sorted.length / 50));
  const pageIndex = Math.max(0, Math.min(requestedPage, pageCount - 1));
  return {
    pages: sorted.slice(pageIndex * 50, (pageIndex + 1) * 50),
    total: sorted.length,
    pageCount,
    pageIndex,
  };
}
