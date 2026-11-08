import { DomainError } from '../../../../packages/contracts/src/index.js';
export function pageOffset(value: unknown) {
  const offset = value === undefined ? 0 : Number(value);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
    throw new DomainError('INVALID', 'Use a valid page offset.');
  return offset;
}
