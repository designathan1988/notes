import { isDeepStrictEqual } from 'node:util';
import {
  DomainError,
  assertObject,
  type Actor,
  type Page,
  type PageUpdate,
  type RecordField,
} from '../../../../packages/contracts/src/index.js';
import type { Database } from '../platform/database.js';
import { Databases } from '../databases/service.js';
import { Access } from '../access/service.js';
import { validateValues } from '../databases/values.js';
import { templateValues } from './metadata.js';

async function checkRelation(
  db: Database,
  actor: Actor,
  page: Page,
  field: RecordField,
  value: unknown,
) {
  if (field.type !== 'relation' || !value || value === page.id) return;
  const target = await new Access(db).requirePage(actor, String(value), 'read');
  if (target.workspaceId !== page.workspaceId || target.kind !== 'record')
    throw new DomainError('INVALID', 'Choose an accessible record in this workspace.');
}
export async function inspectDefaults(db: Database, actor: Actor, page: Page) {
  if (!page.templateDatabaseId || page.templateRootId !== page.id)
    throw new DomainError('INVALID', 'Choose a record template.');
  const database = await new Access(db).requirePage(actor, page.templateDatabaseId, 'read');
  if (database.workspaceId !== page.workspaceId || database.kind !== 'database')
    throw new DomainError(
      'FORBIDDEN',
      'This template’s database is unavailable in this workspace.',
    );
  const definition = await new Databases(db).definition(actor, database.id),
    values = templateValues(page.templateValues ?? {}),
    issues: { fieldId: string; name: string; message: string }[] = [];
  for (const [id, value] of Object.entries(values)) {
    const field = definition.fields.find((field) => field.id === id);
    try {
      if (!field || field.archived)
        throw new DomainError('INVALID', 'The property is unavailable or archived.');
      validateValues(definition.fields, { [id]: value });
      await checkRelation(db, actor, page, field, value);
    } catch (failure) {
      if (!(failure instanceof DomainError)) throw failure;
      issues.push({
        fieldId: id,
        name: field?.name ?? 'Removed property',
        message: 'Review this saved default; its property, option or relation changed.',
      });
    }
  }
  return {
    ...definition,
    templateRevision: page.revision,
    databaseId: database.id,
    databaseVisibility: database.visibility,
    values,
    issues,
  };
}

export async function changeDefaults(
  db: Database,
  actor: Actor,
  page: Page,
  input?: PageUpdate['templateDefaults'],
) {
  if (input === undefined) return page.templateValues ?? {};
  assertObject(input);
  const review = await inspectDefaults(db, actor, page);
  if (!Number.isSafeInteger(input.fieldsRevision) || input.fieldsRevision !== review.fieldsRevision)
    throw new DomainError(
      'CONFLICT',
      'The database properties changed. Review the current defaults before saving.',
    );
  const values = { ...review.values };
  if (input.resetInvalid === true && input.property === undefined)
    for (const issue of review.issues) delete values[issue.fieldId];
  else if (input.property && input.resetInvalid === undefined) {
    const change = input.property,
      field = review.fields.find((field) => field.id === change.id);
    if (!field || field.archived || ['formula', 'button'].includes(field.type))
      throw new DomainError('INVALID', 'Choose an active stored property.');
    if (
      !Object.hasOwn(change, 'expectedValue') ||
      !isDeepStrictEqual(field, change.expectedField) ||
      !isDeepStrictEqual(
        Object.hasOwn(values, field.id) ? values[field.id] : null,
        change.expectedValue,
      )
    )
      throw new DomainError(
        'CONFLICT',
        'This default changed while you were editing. Review its latest value.',
      );
    validateValues(review.fields, { [field.id]: change.value });
    await checkRelation(db, actor, page, field, change.value);
    values[field.id] = change.value;
  } else throw new DomainError('INVALID', 'Choose one default edit or reset invalid defaults.');
  return templateValues(values);
}
