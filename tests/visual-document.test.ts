import { expect, test } from 'vitest';
import {
  duplicateBlock,
  findBlock,
  insertBlock,
  insertSection,
  moveBlock,
  moveSection,
  newBlock,
  newVisualDocument,
  parseVisual,
  removeBlock,
  renderVisual,
  sectionPresets,
  updateBlock,
  updateSection,
} from '@note/editor/visual';

test('a new document renders a complete page whose markup matches its model', () => {
  const document = newVisualDocument();
  const { html, css } = renderVisual(document, 'My <page>');
  expect(html).toContain('<title>My &lt;page&gt;</title>');
  expect(html).toContain('<h1 class="b-');
  expect(html).toContain('class="button"');
  expect(css).toContain(document.theme.accent);
  expect(html).not.toContain('contenteditable');
});

test('authored text can never become markup or a script address', () => {
  let document = newVisualDocument();
  const heading = document.sections[0].blocks[0];
  const button = document.sections[0].blocks[2];
  document = updateBlock(document, heading.id, { text: '<img src=x onerror=alert(1)>\nline two' });
  document = updateBlock(document, button.id, { href: 'javascript:alert(1)' });
  const { html } = renderVisual(document);
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;<br>line two');
  expect(html).not.toContain('javascript:');
  expect(html).toContain('href="#"');
});

test('stored JSON is read defensively and survives a round trip', () => {
  const document = insertSection(newVisualDocument(), null, sectionPresets.Features());
  const again = parseVisual(JSON.stringify(document))!;
  expect(renderVisual(again)).toEqual(renderVisual(document));
  expect(parseVisual('not json')).toBeNull();
  expect(parseVisual('{"version":2}')).toBeNull();
  const hostile = parseVisual(
    JSON.stringify({
      version: 1,
      theme: { accent: 'red;}body{display:none', radius: 9999 },
      sections: [
        {
          id: '"><script>',
          style: { background: 'url(x)' },
          blocks: [{ type: 'evil' }, { type: 'text', text: 'ok', style: { size: 5000 } }],
        },
      ],
    }),
  )!;
  expect(hostile.theme.accent).toBe('#4f46d8');
  expect(hostile.theme.radius).toBe(32);
  expect(hostile.sections[0].id).toMatch(/^[\w-]+$/);
  expect(hostile.sections[0].style.background).toBeUndefined();
  expect(hostile.sections[0].blocks).toHaveLength(1);
  expect(hostile.sections[0].blocks[0].style.size).toBe(120);
});

test('edits are pure and reach blocks nested in columns', () => {
  const start = insertSection(newVisualDocument(), null, sectionPresets.Features());
  const nested = start.sections[0].blocks[1].columns![1][0];
  const edited = updateBlock(start, nested.id, { text: 'Changed', style: { color: '#ff0000' } });
  expect(findBlock(edited, nested.id)!.value.text).toBe('Changed');
  expect(findBlock(start, nested.id)!.value.text).not.toBe('Changed');
  expect(renderVisual(edited).css).toContain(`.b-${nested.id}{color:#ff0000}`);
  const copied = duplicateBlock(edited, nested.id);
  expect(copied.sections[0].blocks[1].columns![1]).toHaveLength(3);
  expect(removeBlock(copied, nested.id).sections[0].blocks[1].columns![1]).toHaveLength(2);
});

test('blocks and sections insert, move and restyle in order', () => {
  let document = newVisualDocument();
  const [first, second] = document.sections[0].blocks;
  const added = newBlock('quote');
  document = insertBlock(document, document.sections[0].id, first.id, added);
  expect(document.sections[0].blocks.map((block) => block.id).slice(0, 3)).toEqual([
    first.id,
    added.id,
    second.id,
  ]);
  document = moveBlock(document, added.id, -1);
  expect(document.sections[0].blocks[0].id).toBe(added.id);
  expect(moveBlock(document, added.id, -1)).toEqual(document);
  const top = sectionPresets.Quote();
  document = insertSection(document, document.sections[0].id, top);
  document = moveSection(document, top.id, -1);
  expect(document.sections[0].id).toBe(top.id);
  document = updateSection(document, top.id, { background: '#101010', width: 'full' });
  const { css } = renderVisual(document);
  expect(css).toContain(`.s-${top.id}{background:#101010`);
  expect(css).toContain(`.s-${top.id}>.wrap{max-width:100%}`);
});
