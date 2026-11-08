import { expect, test } from 'vitest';
import {
  editorSchema,
  documentFromJSON,
  documentJSON,
  projectDocument,
} from '../packages/editor/src/schema.js';
import { findDocumentMatches } from '../packages/editor/src/find.js';
import { documentTemplates } from '../packages/editor/src/templates.js';
import { documentStatistics } from '../packages/editor/src/statistics.js';

test('statistics preserve words across mark boundaries and count Unicode characters', () => {
  const doc = editorSchema().nodeFromJSON({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Know' },
          { type: 'text', text: 'ledge', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' grows 👋' },
        ],
      },
    ],
  });
  expect(documentStatistics(doc)).toEqual({ words: 3, characters: 17, minutes: 1 });
});

test('find locates phrases across formatting boundaries and treats punctuation as literal text', () => {
  const schema = editorSchema(),
    doc = schema.nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Alpha ' },
            { type: 'text', text: 'beta', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' [a+b] alpha beta' },
          ],
        },
      ],
    });
  const matches = findDocumentMatches(doc, 'alpha beta');
  expect(matches.map((match) => doc.textBetween(match.from, match.to))).toEqual([
    'Alpha beta',
    'alpha beta',
  ]);
  expect(findDocumentMatches(doc, '[a+b]')).toHaveLength(1);
  expect(findDocumentMatches(doc, 'alpha beta', true)).toHaveLength(1);
});
test('collapsible sections and highlights round-trip through the canonical collaborative schema', () => {
  const content = {
    type: 'doc',
    content: [
      {
        type: 'toggleBlock',
        attrs: { collapsed: true },
        content: [
          { type: 'toggleTitle', content: [{ type: 'text', text: 'Open questions' }] },
          {
            type: 'toggleContent',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'A searchable answer', marks: [{ type: 'highlight' }] },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const doc = documentFromJSON(content);
  try {
    const restored = documentJSON(doc);
    expect(restored.content?.[0].attrs?.collapsed).toBe(true);
    expect(restored.content?.[0].content?.[1].content?.[0].content?.[0].marks?.[0].type).toBe(
      'highlight',
    );
    expect(projectDocument(restored).text).toContain('A searchable answer');
  } finally {
    doc.destroy();
  }
});
test('every built-in template is valid structured content and includes useful editable sections', () => {
  expect(documentTemplates.map((template) => template.id)).toEqual(
    expect.arrayContaining(['meeting', 'project', 'decision', 'research']),
  );
  for (const template of documentTemplates) {
    const doc = editorSchema().nodeFromJSON({ type: 'doc', content: template.content });
    doc.check();
    expect(doc.childCount).toBeGreaterThan(3);
    expect(doc.textContent.length).toBeGreaterThan(40);
  }
});
