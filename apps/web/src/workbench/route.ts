import type { PageKind } from '@note/contracts';
import type { View } from '../state/store.js';
export const pageView = (kind?: PageKind): View =>
  kind === 'canvas' ? 'canvas' : kind === 'database' ? 'database' : 'document';
