import type { PageKind } from '../../../../packages/contracts/src/index.js';
import type { View } from '../state/store.js';
export const pageView = (kind?: PageKind): View =>
  kind === 'canvas' ? 'canvas' : kind === 'database' ? 'database' : 'document';
