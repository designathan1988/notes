# Spatial history and template previews

## Observed defects and repairs

The real history workflow reproduced the missing spatial stage: saved canvas notes were rendered in sequence by the ordinary preview schema. The new browser scenario failed because no Saved canvas application existed. Read-only node views now retain saved card/group coordinates, stacking, rich content and labels inside the existing snapshot editor.

The expanded preview initially disappeared when the viewport crossed the mobile breakpoint. Workspace's resize handler closed its parent context panel even while a native modal was open. It now preserves open modal work through that responsive change. A second regression showed that removing the dialog left keyboard focus inactive. The shared Dialog owner now closes its own native element and restores its connected opener on cleanup. This follows the native [HTMLDialogElement.close lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/close); focus return is separately verified in the browser.

Visual inspection then found excessive mobile fitting margins: a 330-unit note occupied only 43.6 CSS pixels in a 312-pixel stage. The spatial gesture owner now accepts optional fitting padding, retaining its previous default for live graph/canvas surfaces. Snapshot views use 24 pixels. The browser regression first failed at 43.6 versus a minimum of 62.4, then passed at both 390 and 360 viewports.

## Ownership

- VersionPreview dispatches saved canvases to a lazy renderer and keeps ordinary document previews unchanged.
- The snapshot remains a disposable, read-only editor over the saved schema content. It has no collaborative provider, document session, recovery writes, projection subscription or application camera persistence.
- Rich notes use the existing block schema and BlockSurface. Historical task inputs are disabled. Long notes remain selectable and scrollable.
- Live and saved views share one SVG connection presenter and the existing pure geometry owner, including sides, both arrow ends, colors and label placement.
- A weak, immutable-document-keyed geometry lookup avoids repeatedly scanning the entire saved scene for each edge. It is a derived projection, never an editable body or application state owner.
- Pan, anchored zoom and fit reuse useSpatialView. Keyboard arrows, plus/minus and Home operate only on the focused saved stage. Expanded previews use the existing native Dialog; authored code remains ordinary schema source rendering, without a new execution path.

## Verified behavior

The native regression saves a named canvas version, makes later live edits, then opens the earlier version. It checks distinct positions, groups, bold text, disabled tasks, connection sides/arrows/color/label, keyboard pan/zoom/fit, scrolling without zooming the long note, responsive modal retention and focus return. Closing and reloading retain the later live work. The same scenario saves a template, opens its spatial preview, creates an independent working canvas from it and reloads that instance.

The complete 17-scenario affected history/template/UI/presentation run passed in 1.5 minutes before the final fitting refinement. After that refinement, all 23 affected snapshot/canvas/graph/recovery-accessibility scenarios passed in 1.1 minutes. All 44 affected behavior tests across six files passed in 11.78 seconds. Typecheck and the production build passed; the source-editor and initial bundle-size warnings remain visible (531.32 kB and 788.15 kB minified).

## Visual comparison

Browser plugin not available: the integrated browser previously returned `Browser is not available: iab`, with no browser surfaces in inventory. The explicitly authorized Playwright path captured `canvas-snapshots/{canvas-snapshot-desktop.png,canvas-snapshot-mobile-390.png,canvas-snapshot-mobile-360.png}` under the session's external `workspace-reform-render` directory. The fresh images and `docs/design/concepts/canvas-2026-11-08.png` were inspected with view_image.

| Point | Comparison and decision |
| --- | --- |
| Structure | Saved boxes and labelled curves remain a spatial scene instead of a vertical document. |
| Controls | A saved scene exposes navigation and close controls; editing/selection-inspector actions remain in the live canvas. |
| Scale | Compact previews show the overall map, with optional expansion. Desktop expands to a usable scene; mobile keeps the complete overview with pan/zoom for reading individual notes. |
| Spacing | Mobile fitting uses the scene width instead of spending most of it on the previous 80-pixel margins. |
| Typography | Saved rich heading/body/task roles and shared sans-serif controls remain intact. |
| Color | The current neutral shell supersedes the old concept's blue chrome. The brown connection/card tint belongs to the authored fixture. |
| Content | The fixture deliberately includes a long source note, a separate conclusion and one relationship. No user note was rewritten for screenshots. |

This completes this preview gap, not the remaining containment, portable interchange, metadata navigation or whole-product acceptance requirements. No deployment or push is part of this milestone.
