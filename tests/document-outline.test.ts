import { test, expect } from 'vitest';
import { editorSchema, projectDocument } from '@note/editor/schema';
import { headingPositions } from '@note/editor/outline';

test('outline positions keep HTML component headings aligned with subsequent rich headings', () => {
  const schema = editorSchema();
  const first = schema.node('heading', { level: 2 }, schema.text('First'));
  const site = schema.node(
    'webComponent',
    null,
    schema.node(
      'webFile',
      { path: 'index.html' },
      schema.text('<h1>Website</h1><script>"<h2>Hidden</h2>"</script><h2>Evidence</h2>'),
    ),
  );
  const last = schema.node('heading', { level: 2 }, schema.text('Last'));
  const doc = schema.node('doc', null, [first, site, last]);
  expect(projectDocument(doc.toJSON()).headings.map((heading) => heading.text)).toEqual([
    'First',
    'Website',
    'Evidence',
    'Last',
  ]);
  expect(headingPositions(doc)).toEqual([
    0,
    first.nodeSize,
    first.nodeSize,
    first.nodeSize + site.nodeSize,
  ]);
});

test('canvas outline targets retain the containing card position and do not mistake code for headings', () => {
  const schema = editorSchema();
  const card = schema.node('canvasCard', { id: 'source' }, [
    schema.node('codeBlock', null, schema.text('# Code stays literal')),
    schema.node('heading', { level: 3 }, schema.text('Real heading')),
  ]);
  const doc = schema.node('doc', null, schema.node('canvasRoot', null, card));
  const [position] = headingPositions(doc);
  expect(doc.nodeAt(position)?.textContent).toBe('Real heading');
  expect(doc.resolve(position).parent.type.name).toBe('canvasCard');
});
