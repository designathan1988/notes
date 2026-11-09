export const VIEWS = [
  'document',
  'database',
  'graph',
  'all',
  'templates',
  'canvas',
  'home',
] as const;
export type View = (typeof VIEWS)[number];
export const isView = (value: unknown): value is View => VIEWS.includes(value as View);
/** Workspace-wide destinations that do not belong to a single page. */
export const GLOBAL_VIEWS: readonly View[] = ['graph', 'all', 'templates', 'home'];
