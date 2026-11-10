import type { PageKind } from '@note/contracts';
import type { View } from '../state/store.js';
export const pageView = (kind?: PageKind): View =>
  kind === 'canvas' ? 'canvas' : kind === 'database' ? 'database' : 'document';

/** A page's own address; the app routes by the URL hash. */
export const pageUrl = (pageId: string, view: View = 'document') =>
  `${location.origin}${location.pathname}#${pageId}/${view}`;

/** "Open in new tab" and Ctrl/⌘+click open the page in a real browser tab, as in Notion. */
export function openInBrowserTab(pageId: string, view: View = 'document') {
  window.open(pageUrl(pageId, view), '_blank', 'noopener');
}
