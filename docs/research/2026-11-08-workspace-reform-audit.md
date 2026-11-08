# Workspace reform: observed interface audit

Date: 2026-11-08. This audit follows the user's latest request for a complete structural redesign, after inspecting the actual application and before further product-code changes. It supersedes the earlier Studio Index concept as the visual direction to implement. It does not supersede the original feature inventory, unfinished spatial work or commercial/native release stages.

## Scope and method

Inspected the live local application through the Codex in-app browser: document reading and metadata, page actions, outline/links, comments, history and read-only preview, database table/board/list/calendar empty state, record inspection, graph, canvas, search, commands, settings/data recovery, templates, catalog, mobile navigation/tabs/actions and block/table editing controls. All 35 screenshots were saved and inspected. Physical dimensions were verified: desktop 1487×1058, mobile 390×844 and 360×844, tablet 1024×900.

Evidence folder: `C:/Users/Jonathan/.codex/visualizations/2026/11/07/01a1b7b6-be13-7823-ace0-da731e95b11e/workspace-reform-audit/`. `audit-notes.json` retains per-step observations. No note body, record value, membership or canonical geometry was edited to improve the screenshots. Research database layouts were inspected and restored to Table. Temporary audit/reference browser tabs were closed; original user tabs were preserved and the viewport override reset.

## Verdict

The current interface has useful working capabilities but lacks one coherent workbench structure. Adding a dark activity rail, compact controls and neutral tokens did not resolve the accumulated navigation, action and panel hierarchies. The next change must reorganize those workflows, not restyle the same composition.

Measured examples: the desktop sidebar occupies 304px and two top bars occupy 85px; a normal title starts 41px to the right of its prose. At 1024px, a 280px sidebar and 560px record overlay leave only 184px of unobscured table context. On mobile, the record overlay starts at y85 while the header ends at y56. The mobile database's first table header appears around y365 after multiple control rows.

## Flow evidence

Each numbered filename below is in the evidence folder. Related steps are intentionally separate so the state shown is unambiguous.

| Step | Screen / evidence | Health and observed problem |
| --- | --- | --- |
| 1 | `01-document-desktop.jpg` | Structural rework: dominant dark rail, 304px navigation, two utility bars, title/prose misalignment, tiny related links and embedded-table text. |
| 2 | `02-document-properties.jpg` | Rework: opening empty properties adds about 94px before content for two tiny add actions. Empty setup consumes writing space. |
| 3 | `03-page-actions.jpg` | Rework: sixteen flat commands mix reading, editing, organization, collaboration and deletion; many repeat header or editor controls. |
| 4 | `04-document-inspector.jpg` | Rework: nested Details/Comments/History and Outline/Links hierarchies, plus outline, miniature graph and incoming-link list stacked together. |
| 5 | `05-discussion-panel.jpg` | Rework: changing from Details to Comments changes panel width and wraps/shifts the same document; the empty composer sits in an otherwise unused tall panel. |
| 6 | `06-history-panel.jpg` | Rework: repeated automatic-version labels and faint metadata are hard to scan; large explanation/name form precede the timeline. |
| 7 | `07-history-preview.jpg` | Structural rework: a full document is compressed into a narrow nested scrolling preview. It needs a real reading/comparison workspace. No restore was executed. |
| 8 | `08-database-table.jpg` | Rework: document-sized title/description precede the data; toolbar mixes view/layout, filtering and icon-only schema actions; cells are small relative to row height. |
| 9 | `09-record-inspector.jpg` | Rework: a roughly 560px overlay obscures columns/tooling. An empty record has little visible writing guidance. Record, details and discussion use inconsistent panel systems. |
| 10 | `10-database-board.jpg` | Rework: functional Kanban cards repeat labels as tall mini-forms inside tall tinted column containers. Preserve real cards, grouping and drag; simplify their hierarchy. |
| 11 | `11-database-list.jpg` | Rework: large gaps separate names and values, with table-like row height but weaker relationships between fields. |
| 12 | `12-database-calendar.jpg` | Empty-state rework: instruction asks for a date field without a direct action; the relevant schema command is an unlabeled icon. This database has no date field, so a populated grid was not audited here. |
| 13 | `13-knowledge-graph.jpg` | Working discovery, structural rework: duplicated title/tool bands, separate bottom instruction/zoom bands and inconsistent selected-object context. Geometry was not changed. |
| 14 | `14-canvas.jpg` | Understandable empty state, structural rework: title repeated in tab, breadcrumb and tool strip; the third instance wraps. Spatial content loses height to chrome. |
| 15 | `15-canvas-content.jpg` | Working rich content: the existing note is editable; default fixed size leaves large empty height for one line. Do not confuse functional canvas objects with decorative dashboard cards. |
| 16 | `16-canvas-selected-note.jpg` | Rework: clicking text automatically opens a 220px arrangement inspector containing four common context commands. Typing should not require this permanent pane. |
| 17 | `17-global-search.jpg` | Rework: large modal, heading, query, always-exposed filter form and footer make quick navigation feel heavy. |
| 18 | `18-search-results.jpg` | Working search: the loaded query has nine relevant results. Improve parent context, query-match emphasis and scan density; transient unfiltered results were not judged as a search failure. |
| 19 | `19-command-palette.jpg` | Rework: insertion-order commands, repeated command symbols/category captions and a remaining blue selected state. Search/actions have overlapping entry points but separate interaction systems. |
| 20 | `20-settings.jpg` | Functional settings: forms are appropriate here. Large titles/backdrop compete with small member rows. No role/invitation was changed. |
| 21 | `21-data-settings.jpg` | Rework: oversized headings and implementation-heavy prose dominate a few useful actions. Recovery needs a contextual route from local-save/error states as well as settings. |
| 22 | `22-template-library.jpg` | Rework: large title/subtitle, search/filter and permanent split pane repeat selected-template identity. Only one empty existing template was available; no renderer-failure claim is made. |
| 23 | `23-page-catalog.jpg` | Structural rework: roughly 55px single-line rows waste width/height; technical kind labels lack parent context, useful dates or clear filter/sort. It needs a real workspace explorer. |
| 24 | `24-mobile-document.jpg` | Readable/no page overflow. Rework: title offset, metadata/empty-properties row, small links and faint completed tasks. First paragraph starts at y217. |
| 25 | `25-mobile-working-tabs.jpg` | Working disclosure. Rework: small close controls, weak discovery and no obvious mobile pin/reopen path; an anchored narrow popup covers content without using the available width well. |
| 26 | `26-mobile-navigation.jpg` | Structural rework: about 200px of top controls and three footer bands constrain the tree; a dark bottom destination rail has tiny wrapping labels. |
| 27 | `27-mobile-page-actions.jpg` | Working access. Rework: a long desktop-style menu with roughly 32px rows puts Comments/History after many organization commands. The existing Comments entry is functional. |
| 28 | `28-mobile-discussion.jpg` | Rework: nearly full-width side overlay leaves a useless document strip and top gap. Five native Tab steps remained inside the panel and wrapped to its close control. |
| 29 | `29-mobile-database.jpg` | Rework: heading and three control bands postpone data; tiny icon actions consume name-column space. Preserve the table's contained horizontal scrolling. |
| 30 | `30-mobile-database-360.jpg` | Same structural issue at 360px: controls wrap while only Name and Type fit before horizontal scrolling. |
| 31 | `31-mobile-record-360.jpg` | Rework: unexplained 29px top gap, another header and faint empty-body affordances. Use a deliberate mobile record workspace. |
| 32 | `32-tablet-record.jpg` | Severe layout issue: only 184px of the table remains unobscured. Responsive behavior must account for combined pane widths. |
| 33 | `33-tablet-document.jpg` | Readable ordinary document, but conflicting chrome/type proportions and the same title/prose offset remain. Native browser spelling decoration in a focused title is not an authored style. |
| 34 | `34-block-insertion.jpg` | Working insertion popup: tall repeated icon/name/description rows, non-obvious ordering and competing bottom formatting/utility surfaces. No block was inserted. |
| 35 | `35-table-action-modal.jpg` | Critical interaction defect: the visible modal inherits `pointer-events:none` from its contextual toolbar after focus moves into the native modal. Buttons cannot be clicked. Hit-testing their center returns HTML. No table mutation was executed. |

### Representative captures

![Current desktop composition](C:/Users/Jonathan/.codex/visualizations/2026/11/07/01a1b7b6-be13-7823-ace0-da731e95b11e/workspace-reform-audit/01-document-desktop.jpg)

![Tablet record obscures the working table](C:/Users/Jonathan/.codex/visualizations/2026/11/07/01a1b7b6-be13-7823-ace0-da731e95b11e/workspace-reform-audit/32-tablet-record.jpg)

![Mobile data controls displace the data](C:/Users/Jonathan/.codex/visualizations/2026/11/07/01a1b7b6-be13-7823-ace0-da731e95b11e/workspace-reform-audit/29-mobile-database.jpg)

## Reference study

- [Linear's current design explanation](https://linear.app/now/behind-the-latest-design-refresh): consistent workbench location/view controls and reduced navigational prominence. Its sidebar comparison was inspected in the official article's image viewer and captured as `reference-linear-navigation.jpg`. Learn the hierarchy; do not copy its dark palette or merely repeat its cosmetic refresh.
- [Notion editing guidance](https://www.notion.com/help/writing-and-editing-basics): selection-local formatting and direct block interaction. The official editing-toolbar example was inspected and captured as `reference-notion-contextual-editing.jpg`. Its tall property stack and AI controls are not requirements to reproduce.
- [Bear's pane controls](https://bear.app/faq/hide-the-sidebar-and-note-list-on-mac-and-ipad/) and [typography controls](https://bear.app/faq/typography-options/): expose useful navigation while letting people focus on their note, with comfortable reading width/type. These were documentation research, not hands-on use of an authenticated Bear app.
- [Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/): make common work easy to see and reveal less-frequent controls in context. This is not permission to hide all useful navigation behind menus.
- [W3C target-size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast): visual density must retain perceivable focus, meaningful labels and usable targets. A 44px touch target is the product's comfortable mobile design target, not a claim that WCAG AA universally requires 44px.

## Structural decisions for the next design exploration

1. Replace the permanent dark activity rail and stacked navigation/footer systems with one compact, readable workspace navigation hierarchy. Keep nested pages, favorites, global destinations, account/settings and direct creation reachable.
2. Give the workbench a coherent location/action model. Reduce repeated titles and permanent duplicate toolbars; preserve tabs, pin/reopen/reorder, history navigation, save state, sharing and page commands.
3. Treat documents, data views and spatial surfaces according to their work, within one system. Continuous prose keeps a calm reading width; data/canvas use the available workspace instead of a large document-like setup header.
4. Use stable, explicit context panels and a real history preview/compare surface. At constrained widths, use a purposeful full-screen/overlay workflow instead of squeezing unusable panes together. Do not open arrangement panels merely because someone types in a canvas note.
5. Consolidate search and command access around one predictable quick-access experience while retaining the existing command and search-data owners. Group common/context/advanced actions by task instead of exposing flat control inventories.
6. Keep editing controls local to selection, blocks and cells. Native modals must have an independent portal/interaction boundary; toolbar visibility must never disable a modal. Preserve direct keyboard, pointer, touch and drag behavior.
7. Apply a complete neutral type/control/token system across every surface, including legacy command selection and property focus styles. Grayscale alone is not sufficient: measure legibility and focus and use shape/weight/labels for states. No serif, dominant brand color, decorative card grid or dashboard framing.

## Preservation and acceptance

Keep all existing document/block/media/table, page tree, search/indexing, database layouts/properties/record editing, graph/canvas, template, discussion/history, ACL, recovery and transfer workflows. Keep English product/code/docs and Portuguese chat. The original capability owners, root state manager and central stylesheet remain authoritative; changing workflow composition must not fork content, permissions or persistence.

The fresh pre-redesign verification run passed 182 behavior tests, typecheck and production build, but its full 72-scenario browser run ended with 69 passes and three failures: the obsolete mobile-comments access path, the real table-modal pointer failure and a working-note save status stuck at Saving. The last requires separate transport/durability investigation; a visual rewrite must not hide it or increase timeouts to conceal it. Failure traces are retained in this evidence folder.

This audit does not certify every possible data state, a populated calendar, physical-device keyboards, screen-reader behavior, full WCAG conformance or the whole product. Those limits are explicit acceptance work. User content and test-fixture labels must not be rewritten just to produce attractive screenshots.
