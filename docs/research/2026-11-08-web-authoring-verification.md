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

Searchable HTML prose and headings without script execution; portable website ZIP with media; native import/template/media round trips; product-level composition/focused deletion/runtime error cases; final desktop/tablet/mobile comparison after refinements. Ordinary application, spatial, commercial and native-delivery requirements retain their existing status.
