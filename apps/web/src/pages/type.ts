import type { Page } from '@note/contracts';

/**
 * The type a person sees. Storage has one 'document' kind written in two formats: a Page
 * (text in blocks) and a Document (a free-form page).
 */
export type PageType = 'page' | 'document' | 'database' | 'canvas' | 'record';
export const pageType = (page: Pick<Page, 'kind' | 'format'>): PageType =>
  page.kind === 'document' ? (page.format === 'web' ? 'document' : 'page') : page.kind;
/** Source-message labels, translated at render time. */
export const typeLabel: Record<PageType, string> = {
  page: 'Page',
  document: 'Document',
  database: 'Database',
  canvas: 'Canvas',
  record: 'Record',
};
