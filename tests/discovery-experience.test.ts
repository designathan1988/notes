import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { CalendarView } from '../apps/web/src/databases/CalendarView.js';
import * as Y from 'yjs';
import { documentFromJSON } from '@note/editor/schema';
import TemplatePreview from '../apps/web/src/templates/TemplatePreview.js';

const props = {
  id: 'db',
  records: [],
  month: new Date(2026, 10, 1),
  changeMonth: () => {},
  undated: false,
  toggleUndated: () => {},
  readOnly: false,
  inspect: () => {},
  refresh: async () => {},
  error: () => {},
  addDateProperty: () => {},
};
test('an empty calendar offers date property creation to editors', () => {
  const html = renderToStaticMarkup(createElement(CalendarView, props));
  expect(html).toContain('Add date property');
});
test('an empty calendar explains the requirement without an editor action for viewers', () => {
  const html = renderToStaticMarkup(createElement(CalendarView, { ...props, readOnly: true }));
  expect(html).toContain('date property');
  expect(html).not.toContain('Add date property');
});

test('an empty template explains that its preview has no content', () => {
  const doc = documentFromJSON({ type: 'doc', content: [{ type: 'paragraph' }] });
  const state = Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
  doc.destroy();
  const html = renderToStaticMarkup(createElement(TemplatePreview, { state }));
  expect(html).toContain('This template has no content yet.');
  expect(html).toContain('Edit template');
});
