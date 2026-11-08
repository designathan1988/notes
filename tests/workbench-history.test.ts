import { expect, test } from 'vitest';
import { navigateHistory } from '../apps/web/src/workbench/history.js';
test('application history starts inside the workspace and replaces forward entries after a new navigation', () => {
  let history = navigateHistory(
    { entries: [], index: -1 },
    { pageId: 'first', view: 'document' },
    'replace',
  );
  expect(history.index).toBe(0);
  history = navigateHistory(history, { pageId: 'second', view: 'document' }, 'push');
  history = navigateHistory(history, { pageId: 'first', view: 'document' }, 'none', 0);
  expect(history.index).toBe(0);
  expect(history.entries).toHaveLength(2);
  history = navigateHistory(history, { pageId: 'third', view: 'document' }, 'push');
  expect(history.entries.map((entry) => entry.pageId)).toEqual(['first', 'third']);
  history = navigateHistory(history, { pageId: 'third', view: 'document' }, 'push');
  expect(history.entries).toHaveLength(2);
});
