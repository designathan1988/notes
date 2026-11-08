import { expect, test } from 'vitest';
import type { RecordField } from '@note/contracts';
import { displayFormula, canonicalFormula, formulaReference } from '@note/data/formula-input';

test('formula input uses property names while durable references survive renames', () => {
  const fields: RecordField[] = [{ id: 'stable-id', name: 'Annual rate', type: 'number' }];
  expect(displayFormula('[stable-id] * 2', fields)).toBe('prop("Annual rate") * 2');
  expect(canonicalFormula('prop("Annual rate") * 2', fields)).toBe('[stable-id] * 2');
  expect(displayFormula('[stable-id] * 2', [{ ...fields[0], name: 'New rate' }])).toBe(
    'prop("New rate") * 2',
  );
  expect(() => canonicalFormula('prop("Missing")', fields)).toThrow();
});
test('ambiguous names and quote characters are represented without evaluating input', () => {
  const fields: RecordField[] = [
    { id: 'a', name: 'A "quote"', type: 'number' },
    { id: 'b', name: 'A "quote"', type: 'number' },
  ];
  expect(canonicalFormula(formulaReference(fields[1], fields), fields)).toBe('[b]');
  expect(() => canonicalFormula('prop(' + JSON.stringify(fields[0].name) + ')', fields)).toThrow(
    /ambiguous/i,
  );
});
