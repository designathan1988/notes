import { DomainError, validDate, type RecordField } from '@note/contracts';
import { compileFormulas } from '@note/data/formulas';
export const defaultFields: RecordField[] = [
  { id: 'type', name: 'Type', type: 'select', options: ['Research', 'Document', 'Collection'] },
  {
    id: 'status',
    name: 'Status',
    type: 'select',
    options: ['Planned', 'In progress', 'Active', 'Draft', 'Evergreen'],
  },
  { id: 'priority', name: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'] },
];
export function validateFields(fields: RecordField[]) {
  if (!Array.isArray(fields) || fields.length > 50)
    throw new DomainError('INVALID', 'Use up to 50 properties.');
  const ids = new Set<string>();
  for (const field of fields) {
    if (
      !field ||
      typeof field !== 'object' ||
      Array.isArray(field) ||
      typeof field.id !== 'string' ||
      typeof field.name !== 'string'
    )
      throw new DomainError('INVALID', 'Properties need string IDs and names.');
    if (field.type === 'formula' && typeof field.formula !== 'string')
      throw new DomainError('INVALID', 'A formula must be text.');
    if (
      !/^[\w-]{1,64}$/.test(field.id) ||
      !field.name?.trim() ||
      field.name.length > 100 ||
      ![
        'text',
        'number',
        'checkbox',
        'select',
        'multi-select',
        'date',
        'url',
        'relation',
        'formula',
        'button',
      ].includes(field.type) ||
      ids.has(field.id)
    )
      throw new DomainError('INVALID', 'Properties need unique IDs, names, and supported types.');
    ids.add(field.id);
    if (field.archived !== undefined && typeof field.archived !== 'boolean')
      throw new DomainError('INVALID', 'Invalid archived property flag.');
    if (
      ['select', 'multi-select'].includes(field.type) &&
      (!Array.isArray(field.options) ||
        field.options.length > 100 ||
        field.options.some((value) => typeof value !== 'string' || !value || value.length > 100))
    )
      throw new DomainError('INVALID', 'Select properties need valid options.');
  }
  compileFormulas(fields);
  for (const field of fields.filter((field) => field.type === 'button' && !field.archived)) {
    const target = fields.find((item) => item.id === field.action?.fieldId);
    if (
      !target ||
      target.archived ||
      !['text', 'number', 'checkbox', 'select', 'date', 'url'].includes(target.type)
    )
      throw new DomainError('INVALID', 'An action must update an active stored property.');
    validateValues(fields, { [target.id]: field.action!.value });
  }
  return fields;
}
export function validateValues(fields: RecordField[], values: Record<string, unknown>) {
  if (!values || typeof values !== 'object' || Array.isArray(values))
    throw new DomainError('INVALID', 'Record values must be an object.');
  for (const [id, value] of Object.entries(values)) {
    const field = fields.find((item) => item.id === id);
    if (!field) throw new DomainError('INVALID', `Unknown property: ${id}`);
    if (['formula', 'button'].includes(field.type))
      throw new DomainError('INVALID', `${field.name} is derived and cannot be edited.`);
    if (value === null || value === '') continue;
    let valid = false;
    switch (field.type) {
      case 'text':
        valid = typeof value === 'string' && value.length <= 10000;
        break;
      case 'number':
        valid = typeof value === 'number' && Number.isFinite(value);
        break;
      case 'checkbox':
        valid = typeof value === 'boolean';
        break;
      case 'select':
        valid = typeof value === 'string' && !!field.options?.includes(value);
        break;
      case 'multi-select':
        valid =
          Array.isArray(value) &&
          value.length <= 100 &&
          value.every((item) => typeof item === 'string' && field.options?.includes(item));
        break;
      case 'date':
        valid = validDate(value);
        break;
      case 'url':
        try {
          valid =
            typeof value === 'string' && ['https:', 'http:'].includes(new URL(value).protocol);
        } catch {
          // An unparsable URL stays invalid.
        }
        break;
      case 'relation':
        valid = typeof value === 'string' && value.length <= 128;
        break;
    }
    if (!valid) throw new DomainError('INVALID', `Invalid value for ${field.name}.`);
  }
}
