import type { PreferenceStorage } from '../workbench/preferences.js';
export interface CopyInput {
  operation: 'save' | 'use' | 'duplicate' | 'blank';
  sourceId?: string;
  title?: string;
  visibility?: 'private' | 'workspace';
  parentId?: string | null;
  requestId?: string;
}
export interface PendingCopy extends CopyInput {
  requestId: string;
}
export const copyKey = (user: string, workspace: string) => `note:copies:v1:${user}:${workspace}`;
const valid = (value: unknown): value is PendingCopy => {
  if (!value || typeof value !== 'object') return false;
  const item = value as PendingCopy;
  return (
    ['save', 'use', 'duplicate', 'blank'].includes(item.operation) &&
    typeof item.requestId === 'string' &&
    /^[\w-]{8,100}$/.test(item.requestId) &&
    (item.operation === 'blank'
      ? item.sourceId === undefined
      : typeof item.sourceId === 'string' && /^[\w-]{1,128}$/.test(item.sourceId)) &&
    (item.title === undefined || (typeof item.title === 'string' && item.title.length <= 300)) &&
    (item.visibility === undefined || ['private', 'workspace'].includes(item.visibility)) &&
    (item.parentId === undefined ||
      item.parentId === null ||
      (typeof item.parentId === 'string' && /^[\w-]{1,128}$/.test(item.parentId)))
  );
};
export function readCopies(storage: PreferenceStorage, key: string): PendingCopy[] {
  try {
    const result = JSON.parse(storage.getItem(key) ?? '[]');
    return Array.isArray(result) ? result.filter(valid).slice(0, 10) : [];
  } catch {
    return [];
  }
}
export function writeCopies(storage: PreferenceStorage, key: string, items: PendingCopy[]) {
  if (items.length) storage.setItem(key, JSON.stringify(items));
  else storage.removeItem(key);
}
export function sameCopy(first: CopyInput, second: CopyInput) {
  return (
    first.operation === second.operation &&
    first.sourceId === second.sourceId &&
    first.title === second.title &&
    first.visibility === second.visibility &&
    first.parentId === second.parentId
  );
}
