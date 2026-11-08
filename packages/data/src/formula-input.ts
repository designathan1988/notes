import { DomainError, type RecordField } from '../../contracts/src/index.js';

export function formulaReference(field: RecordField, fields: RecordField[]) {
  const ambiguous = fields.filter((item) => item.name === field.name).length > 1;
  return `prop(${JSON.stringify(field.name)}${ambiguous ? ', ' + JSON.stringify(field.id) : ''})`;
}
export function displayFormula(source: string, fields: RecordField[]) {
  const byId = new Map(fields.map((field) => [field.id, field]));
  return source.replace(/\[([\w-]{1,64})\]/gu, (reference, id: string) => {
    const field = byId.get(id);
    return field ? formulaReference(field, fields) : reference;
  });
}
/** Translate user-facing names to stable IDs; arithmetic is validated by the formula engine. */
export function canonicalFormula(source: string, fields: RecordField[]) {
  if (source.length > 40000) throw new DomainError('INVALID', 'The formula is too long.');
  const result = source.replace(
    /\bprop\(\s*("(?:[^"\\]|\\.)*")\s*(?:,\s*("(?:[^"\\]|\\.)*"))?\s*\)/gu,
    (_reference, nameJSON: string, idJSON?: string) => {
      let name: string, id: string | undefined;
      try {
        name = JSON.parse(nameJSON);
        id = idJSON ? JSON.parse(idJSON) : undefined;
      } catch {
        throw new DomainError('INVALID', 'Use a quoted property name.');
      }
      const matches = fields.filter((field) => (id ? field.id === id : field.name === name));
      if (matches.length > 1)
        throw new DomainError(
          'INVALID',
          `The property name ${name} is ambiguous. Insert its reference using a property button.`,
        );
      if (matches.length !== 1 || !['number', 'formula'].includes(matches[0].type))
        throw new DomainError('INVALID', `Choose a numeric property for ${name}.`);
      return `[${matches[0].id}]`;
    },
  );
  if (/\bprop\s*\(/u.test(result))
    throw new DomainError('INVALID', 'Use prop("Property name") or insert a property reference.');
  return result;
}
