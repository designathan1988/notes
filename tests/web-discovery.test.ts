import { expect, test } from 'vitest';
import { projectDocument } from '@note/editor/projection';

test('website discovery indexes static HTML prose, entities, headings and image descriptions without executing code', () => {
  const projection = projectDocument({
    type: 'doc',
    content: [
      {
        type: 'webPage',
        attrs: { entry: 'index.html' },
        content: [
          {
            type: 'webFile',
            attrs: { path: 'index.html' },
            content: [
              {
                type: 'text',
                text: '<!doctype html><title>Field notes</title><style>secretCSSNoise</style><h1>Reading &amp; thinking</h1><p>A useful <strong>shared</strong> thought.</p><img alt="A coastal landscape"><script>globalThis.discoveryExecuted = true; secretJSNoise()</script><template>Not rendered</template><p hidden>Hidden material</p><h2>Next steps</h2>',
              },
            ],
          },
          {
            type: 'webFile',
            attrs: { path: 'main.js' },
            content: [{ type: 'text', text: 'const sourceOnlyNoise = 42;' }],
          },
        ],
      },
    ],
  });
  expect(projection.text).toContain('Field notes');
  expect(projection.text).toContain('Reading & thinking');
  expect(projection.text).toContain('A useful shared thought.');
  expect(projection.text).toContain('A coastal landscape');
  for (const noise of [
    'secretCSSNoise',
    'secretJSNoise',
    'sourceOnlyNoise',
    'Not rendered',
    'Hidden material',
  ])
    expect(projection.text).not.toContain(noise);
  expect(projection.headings).toEqual([
    { level: 1, text: 'Reading & thinking' },
    { level: 2, text: 'Next steps' },
  ]);
  expect((globalThis as Record<string, unknown>).discoveryExecuted).toBeUndefined();
});

test('inline website projections retain surrounding note order and additional HTML documents', () => {
  const projection = projectDocument({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Before.' }] },
      {
        type: 'webComponent',
        attrs: { entry: 'index.html' },
        content: [
          {
            type: 'webFile',
            attrs: { path: 'index.html' },
            content: [{ type: 'text', text: '<h2>Interactive section</h2><p>First page.</p>' }],
          },
          {
            type: 'webFile',
            attrs: { path: 'guide.html' },
            content: [{ type: 'text', text: '<p>Second page.</p>' }],
          },
        ],
      },
      { type: 'paragraph', content: [{ type: 'text', text: 'After.' }] },
    ],
  });
  expect(projection.text).toMatch(
    /Before\.[\s\S]*Interactive section[\s\S]*First page\.[\s\S]*Second page\.[\s\S]*After\./,
  );
});
