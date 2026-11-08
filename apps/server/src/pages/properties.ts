import { isDeepStrictEqual } from 'node:util';
import {
  assertObject,
  DomainError,
  type Actor,
  type Page,
  type PageProperties,
  type PageUpdate,
  type RecordField,
} from '../../../../packages/contracts/src/index.js';
import { validateFields, validateValues } from '../databases/values.js';
import type { Database } from '../platform/database.js';
import { Access } from '../access/service.js';

export function validatePageProperties(input: unknown): PageProperties {
  assertObject(input);
  validateFields(input.fields as RecordField[]);
  const fields = (input.fields as RecordField[]).map((field) => ({
    id: field.id,
    name: field.name.trim(),
    type: field.type,
    ...(field.archived !== undefined ? { archived: field.archived } : {}),
    ...(field.type.includes('select') ? { options: field.options } : {}),
    ...(field.type === 'formula' ? { formula: field.formula } : {}),
    ...(field.type === 'button' ? { action: field.action } : {}),
  }));
  const names = new Set<string>();
  for (const field of fields) {
    const name = field.name.replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
    if (
      names.has(name) ||
      field.name.includes('\0') ||
      field.options?.some((option) => option.includes('\0')) ||
      field.formula?.includes('\0') ||
      (typeof field.action?.value === 'string' && field.action.value.includes('\0')) ||
      ['__proto__', 'constructor', 'prototype'].includes(field.id)
    )
      throw new DomainError('INVALID', 'Use unique property names and valid property IDs.');
    names.add(name);
  }
  const values = input.values as Record<string, unknown>;
  validateValues(fields, values);
  const result = { fields, values };
  if (Buffer.byteLength(JSON.stringify(result)) > 64 * 1024)
    throw new DomainError('LIMIT', 'Page properties must fit within 64 KiB.');
  if (
    Object.values(values).some(
      (value) =>
        (typeof value === 'string' && value.includes('\0')) ||
        (Array.isArray(value) &&
          value.some((item) => typeof item === 'string' && item.includes('\0'))),
    )
  )
    throw new DomainError('INVALID', 'Property values cannot contain null characters.');
  return result;
}

export async function changePageProperties(
  db: Database,
  actor: Actor,
  page: Page,
  input: PageUpdate,
  imported?: PageProperties,
): Promise<PageProperties> {
  const current = page.properties ?? { fields: [], values: {} };
  const operations = [input.fields, input.property, input.propertyAction, imported].filter(
    (value) => value !== undefined,
  );
  if (!operations.length) return current;
  if (page.kind !== 'document')
    throw new DomainError('CONFLICT', 'Record properties belong to their database.');
  if (operations.length !== 1)
    throw new DomainError('INVALID', 'Apply one property operation at a time.');
  let next = current;
  const references: Record<string, unknown> = {};
  if (imported) {
    next = validatePageProperties(imported);
    Object.assign(references, next.values);
  } else if (input.fields !== undefined) {
    next = validatePageProperties({ fields: input.fields, values: current.values });
    if (current.fields.some((field) => !next.fields.some((item) => item.id === field.id)))
      throw new DomainError(
        'INVALID',
        'Archive properties to preserve their definitions and values.',
      );
  } else if (input.property !== undefined) {
    assertObject(input.property);
    const change = input.property,
      field = current.fields.find((field) => field.id === change.id);
    if (!field || field.archived || ['formula', 'button'].includes(field.type))
      throw new DomainError('INVALID', 'Choose an active stored property.');
    if (
      !('expectedValue' in change) ||
      !isDeepStrictEqual(field, change.expectedField) ||
      !isDeepStrictEqual(
        Object.hasOwn(current.values, field.id) ? current.values[field.id] : null,
        change.expectedValue,
      )
    )
      throw new DomainError(
        'CONFLICT',
        'This property changed while you were editing. Review the latest value before saving.',
      );
    next = validatePageProperties({
      fields: current.fields,
      values: { ...current.values, [field.id]: change.value },
    });
    references[field.id] = change.value;
  } else {
    const field = current.fields.find(
      (field) => field.id === input.propertyAction && field.type === 'button' && !field.archived,
    );
    if (!field?.action) throw new DomainError('INVALID', 'Choose an available property action.');
    next = validatePageProperties({
      fields: current.fields,
      values: { ...current.values, [field.action.fieldId]: field.action.value },
    });
  }
  for (const field of next.fields.filter((field) => field.type === 'relation')) {
    const id = references[field.id];
    if (!id) continue;
    const target = await new Access(db).requirePage(actor, String(id), 'read');
    if (target.workspaceId !== page.workspaceId)
      throw new DomainError('INVALID', 'Connect a page in the same workspace.');
  }
  return next;
}
