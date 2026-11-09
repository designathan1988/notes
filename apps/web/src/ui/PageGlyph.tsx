import { Database, FileText, Shapes, type LucideIcon } from 'lucide-react';
import type { Page, PageKind } from '@note/contracts';

const kindIcon: Record<PageKind, LucideIcon> = {
  document: FileText,
  database: Database,
  canvas: Shapes,
  record: FileText,
};

/** The plain glyph for a page kind, for lists that do not use the colored tile. */
export function KindIcon({ kind, size }: { kind: PageKind; size?: number }) {
  const Icon = kindIcon[kind];
  return <Icon size={size} data-kind={kind} aria-hidden="true" />;
}

/** Page icon on a tile colored by page kind; a chosen emoji replaces the glyph. */
export function PageGlyph({
  page,
  size = 18,
}: {
  page: Pick<Page, 'icon' | 'kind'>;
  size?: number;
}) {
  const Icon = kindIcon[page.kind];
  return (
    <span className="kind-tile" data-kind={page.kind} aria-hidden="true">
      {page.icon ? <span className="kind-tile-emoji">{page.icon}</span> : <Icon size={size} />}
    </span>
  );
}
