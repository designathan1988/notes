# Website authoring: integration evidence

The source model, renderer and authoring workspace are integrated. This is a milestone report, not whole-product completion or production certification.

## Canonical content and editing

`webPage` and `webComponent` contain collaborative `webFile` text nodes plus logical `webAsset` bindings in the existing document. File names, contents and entry selection are not independently persisted in React or application state. Additional HTML, CSS, JavaScript, JSON and module files are allowed. Logical media bindings let page duplication remap owned attachment IDs without rewriting arbitrary authored source.

CodeMirror loads only when a source file is opened. Granular edits and selections pass through ProseMirror to the existing Yjs owner; undo uses the same collaborative history. Preview revisions derive from the committed document and verify its fingerprint. They never become editable source.

## Observed gates

- Typecheck and production build passed on 2026-11-08. The build still reports large initial and source-editor chunks; no performance certification is claimed.
- All four scenarios in `e2e/web-pages.spec.ts` passed in one run (14.8 seconds): direct command creation and inline insertion; editing/running module files, JSON, reload and mobile; two-account offline close/reopen merge, independent undo and live reader/editor changes; failed-media original recovery/retry and independently owned media after duplication.
- The latest focused schema/preview/templates/transfer gate passed 25 tests before the UI-only typography refinement. The separate compatibility probe and its coverage limits are recorded in `2026-11-08-web-runtime-origin.md`.
- Actual IAB editing created HTML, CSS and JavaScript through the product, ran the page and clicked its button. Its result remained functional at 390 × 844 with no application horizontal overflow. This verification page was test-owned.

## Visual comparison ledger

Selected companion: `docs/design/concepts/workspace-reform-web-authoring.png`, generated at 1487 × 1058. Actual IAB captures `09-web-authoring-desktop.jpg` and `10-web-authoring-mobile.jpg` are retained outside the repository in the session's `workspace-reform-render` artifact folder. Both concept and renders were inspected with `view_image` in the same review.

| Point | Comparison and decision |
| --- | --- |
| Workspace structure | One light navigation hierarchy, integrated top tab band and full-height editing workspace match the selected direction. Existing real page names and open tabs are retained. |
| Content area | The desktop uses the specified 45/55 source/preview division; mobile exposes one working view at a time. No reading-width wrapper constrains a complete website. |
| App typography | Neutral sans-serif is retained in all application controls. Code measured 13.02 px and looked too small beside the concept; changed to 1 rem (14 px at default settings). Footer diagnostics increased to 0.86 rem. |
| Source identity | Actual file names replace the concept's language-only labels. The starter is expandable, not a fixed three-field form. Mandatory entry deletion has a guard rather than a misleading close X. |
| Palette and authored design | App surfaces remain white/gray/charcoal. The test author's serif reading-room layout is confined to the rendered website and does not change application fonts. The concept's plant/navy sample is optional content, not default application decoration. |
| Density and controls | One Saved indicator is retained. Run/Stop, file actions and responsive widths operate on real content. Ordinary block insertion/drag controls are removed for an exclusive website root; inline website components retain normal note block behavior. |
| Copy diff | Intentional differences are actual page/file names, an icon-labelled Stop control and the omission of redundant Saved/Responsive labels. No generated sample content is imposed on new pages. |

The first visual pair prompted the typography and exclusive-root control fixes. Fresh final captures and the complete application regression gate remain required. This report does not claim final fidelity sign-off.

## Still required for this capability

Static HTML prose/headings projection and portable website ZIP with logical owned media are now implemented. Five new discovery/transfer scenarios passed, including exact nested-entry source bytes, unauthorized cross-page media rejection and a native workspace ZIP import with attachment remapping. The full behavior suite passed 205 tests across 40 files. Typecheck and build passed; the initial chunk is now 787.86 kB (234.77 kB gzip), including the shared HTML parser, and the size warning remains visible.

Fresh IAB captures `11-web-authoring-desktop-final.jpg` (1487 × 1058) and `12-web-authoring-mobile-final.jpg` (390 × 844) were compared again with the concept using `view_image`. Source now measures 14 px by default; root-only block handles are absent, Run/Stop/Export fit on mobile, and there is no page overflow. The export control requested a real archive without an application error. The intentional copy/content differences in the ledger remain.

The independent final code review identified two Important defects. Both now have product-level closure evidence:

- Shared-page CSS escaped a raw string scope wrapper. The browser regression failed with hidden workspace navigation. Page CSS is now parsed as a standalone stylesheet and serialized through CSSOM before scoping; valid title styling still applies and shell controls remain visible.
- One atomic remote transaction inserting text at both ends of a focused source moved subsequent typing to the beginning. A normal two-window offline scenario initially passed and was insufficient to establish this condition. A third authenticated protocol client reproduced the exact atomic batch. An attempted fix using the outer absolute selection produced an off-by-one regression and was removed. The retained fix stores only Yjs-relative selection bookmarks, then resolves them against canonical text identities after remote edits. The exact atomic-batch regression passes.
- The broad browser gate finished 78/79; its sole failure was title-to-empty-description Tab navigation after contextual hiding. PageHeader now explicitly reveals/focuses the description on forward Tab, without restoring the permanent empty description stack. That original scenario passes.

After these repairs, all 12 affected browser scenarios passed in one run (38.2 seconds), covering personal/page appearance, CSS containment, atomic source selection, rich table/page-tree interactions, rapid metadata edits, website files/runtime/collaboration/recovery/permissions/media and export. The media scenario downloads the real website ZIP, verifies its source and image bytes, serves it through an independent static HTTP server and displays the image in a fresh browser context with no Note login. Typecheck passed after declaring the protocol test's WebSocket dependency/types. Production build passed; final initial/source chunks are 788.15/531.32 kB with visible size warnings.

The broad gate was not rerun after these focused repairs; do not relabel it as 81/81. Product-level OS IME certification, runaway script CPU isolation, broader template/history presentation, performance targets and original unfinished spatial/commercial/native requirements retain their documented status.

## Final note-surface comparison

The actual note was also captured in IAB at 1487 × 1058 and 390 × 844 (`13-notes-desktop-final.jpg`, `14-notes-mobile-final.jpg`) and inspected with the Quiet Workbench concept using `view_image`. Title/prose/ancestry align on one column; the rail is gone; tabs and actions share one top band; inline data remains a real editable table; mobile reading keeps compact navigation above continuous blocks. Defaults are neutral sans-serif with no imposed brand hue. Intentional differences are the specified compact type/sidebar dimensions, actual existing page/tab names, working database labels and contextual rather than decorative controls. No authored note content was rewritten for these captures. The website sample and failed metadata-test page created during this verification were moved to recoverable trash using exact ID/title guards.
