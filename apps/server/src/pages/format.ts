import * as Y from 'yjs';
import { runOnce, type Database } from '../platform/database.js';

/** A document whose single root is a web page is the free-form Document type. */
export function isWebDocument(doc: Y.Doc): boolean {
  const first = doc.getXmlFragment('default').get(0);
  return first instanceof Y.XmlElement && first.nodeName === 'webPage';
}
/** The format is decided by what a page is created from: a web root makes a Document. */
export async function markWebFormat(db: Database, pageId: string): Promise<void> {
  await db.query("UPDATE pages SET format='web' WHERE id=$1", [pageId]);
}
/**
 * One-time repair for pages created before formats existed: a document page whose content is
 * a web page becomes format 'web'. A marker row makes it run once.
 */
export async function backfillPageFormats(db: Database): Promise<void> {
  await runOnce(db, 'data-002-page-format', async (tx) => {
    const rows = await tx.query<{ page_id: string; state: Uint8Array }>(
      "SELECT d.page_id,d.state FROM documents d JOIN pages p ON p.id=d.page_id WHERE p.kind='document' AND p.format='blocks'",
    );
    const web: string[] = [];
    for (const row of rows) {
      const doc = new Y.Doc();
      try {
        Y.applyUpdate(doc, new Uint8Array(row.state));
        if (isWebDocument(doc)) web.push(row.page_id);
      } catch {
        // An unreadable state is left as it is; opening the page reports it.
      } finally {
        doc.destroy();
      }
    }
    if (web.length) await tx.query("UPDATE pages SET format='web' WHERE id=ANY($1::text[])", [web]);
  });
}
