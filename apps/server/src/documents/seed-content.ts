import type { JSONContent } from '@tiptap/core';
import * as Y from 'yjs';
import type { Database } from '../platform/database.js';
import { documentFromJSON } from '@note/editor/schema';
const p = (text: string): JSONContent => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h = (text: string): JSONContent => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [{ type: 'text', text }],
});
const link = (targetId: string, label: string): JSONContent => ({
  type: 'pageLink',
  attrs: { targetId, label },
});
export async function seedContent(db: Database) {
  if (process.env.NODE_ENV === 'production') return;
  const pages = await db.query<{ id: string; title: string }>(
    `SELECT p.id,p.title FROM pages p JOIN "user" u ON u.id=p.created_by WHERE u.email='jonathan@note.test'`,
  );
  const ids = Object.fromEntries(pages.map((page) => [page.title, page.id]));
  if (!ids['Product direction']) return;
  const contents: Record<string, JSONContent[]> = {
    'Product direction': [
      { type: 'blockquote', content: [p('Good ideas become useful when they connect.')] },
      h('What we’re building'),
      p('One place to capture what matters, connect the dots, and move ideas forward.'),
      p(
        'Keep the clarity of a document, the structure of a database, and the context of a connected knowledge base.',
      ),
      h('The principles'),
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: true },
            content: [p('Make space for focused thinking')],
          },
          {
            type: 'taskItem',
            attrs: { checked: true },
            content: [p('Keep information connected')],
          },
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [p('Build with care, not complexity')],
          },
        ],
      },
      h('Explore this space'),
      link(ids.Research, 'Research'),
      link(ids['Design principles'], 'Design principles'),
      link(ids['Reading room'], 'Reading room'),
      h('Related notes'),
      { type: 'databaseView', attrs: { databaseId: ids.Research } },
    ],
    Research: [
      p('Our next steps follow the product direction.'),
      link(ids['Product direction'], 'Product direction'),
      h('Questions worth asking'),
      p('What helps a good idea grow into something useful? Capture the evidence here.'),
    ],
    'Design principles': [
      p('The thinking behind the product.'),
      link(ids['Product direction'], 'Product direction'),
      h('Clarity comes first'),
      p(
        'Make every interaction feel considered. Keep the path from thought to understanding short.',
      ),
    ],
    'Getting started': [
      h('Make yourself at home'),
      p('This is your space to capture, organize, and connect what matters.'),
      h('A few things to try'),
      p(
        'Create a page from the sidebar. Type / in an empty paragraph to add a block. Link ideas with the link tool. Press Ctrl K to find anything.',
      ),
      link(ids['Product direction'], 'Product direction'),
    ],
    'Reading room': [
      h('Ideas worth returning to'),
      p(
        'Keep a thoughtful collection of books, essays, and observations. Add your first note below.',
      ),
    ],
    'Meeting notes': [
      h('Make the next conversation count'),
      p('Write down the context, decisions, and open questions while they are still fresh.'),
    ],
    Product: [
      h('The work behind the work'),
      p('A shared home for the direction, research, and principles that shape this product.'),
      link(ids['Product direction'], 'Product direction'),
      link(ids.Research, 'Research'),
      link(ids['Design principles'], 'Design principles'),
    ],
  };
  for (const [title, content] of Object.entries(contents)) {
    if (!ids[title]) continue;
    const doc = documentFromJSON({ type: 'doc', content });
    await db.query(
      'INSERT INTO documents (page_id,state) VALUES ($1,$2) ON CONFLICT (page_id) DO NOTHING',
      [ids[title], Buffer.from(Y.encodeStateAsUpdate(doc))],
    );
    doc.destroy();
  }
}
