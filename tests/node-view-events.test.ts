import { expect, test } from 'vitest';
import { stopsEditorEvent } from '../apps/web/src/documents/nodeViewEvents.js';

// Minimal DOM stand-in: an element knows its ancestors by selector.
const element = (matches: string[]) => ({
  closest: (selector: string) =>
    selector.split(',').some((part) => matches.includes(part.trim())) ? {} : null,
});
const event = (type: string, target: ReturnType<typeof element>) =>
  ({ type, target }) as unknown as Event;

test('a click on an icon inside a button belongs to the button, not the editor', () => {
  // The target is the svg/path inside the button: this is what reached ProseMirror.
  expect(stopsEditorEvent(event('mousedown', element(['button'])))).toBe(true);
  expect(stopsEditorEvent(event('mouseup', element(['a[href]'])))).toBe(true);
  expect(stopsEditorEvent(event('click', element(['[role="button"]'])))).toBe(true);
  expect(stopsEditorEvent(event('keydown', element(['input'])))).toBe(true);
});

test('editable content inside a node view stays with the editor', () => {
  expect(
    stopsEditorEvent(event('mousedown', element(['[data-node-view-content]', 'button']))),
  ).toBe(false);
});

test('plain areas, drag and drop and clipboard events stay with the editor', () => {
  expect(stopsEditorEvent(event('mousedown', element([])))).toBe(false);
  expect(stopsEditorEvent(event('dragstart', element(['button'])))).toBe(false);
  expect(stopsEditorEvent(event('drop', element(['button'])))).toBe(false);
  expect(stopsEditorEvent(event('paste', element(['input'])))).toBe(false);
});
