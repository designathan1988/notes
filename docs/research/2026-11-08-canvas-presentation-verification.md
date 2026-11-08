# Canvas connection and appearance acceptance

This completes the existing connection-presentation item within Task 6. It does not complete the remaining spatial or whole-product matrix.

The [JSON Canvas 1.0 specification](https://jsoncanvas.org/spec/1.0/) distinguishes attachment sides, start/end arrow shapes and optional colors. Those attributes already existed in the canonical schema but were only partly rendered and had no editing controls. The implementation now uses one shared connection-geometry projection for the actual path and label, and one canonical canvas style command for attribute updates. Notes, groups and connections accept preset or arbitrary hexadecimal colors. The application's neutral default remains unchanged.

The existing selection inspector owns these controls; no new application store or writable document copy was added. Controls unavailable to connections, such as box stacking, are omitted for a connection-only selection. Clicking rich note content selects it without opening the inspector over the writing area. The source model, permission checks, collaborative undo and document persistence retain their existing owners.

## Observed verification

- New geometry/style tests were observed failing before implementation. The focused canvas/service/transfer/schema gate passed 29 tests across five files (19.90 seconds).
- All 20 canvas interaction and collaboration browser scenarios passed together (1.3 minutes), including live access changes, closed offline recovery, pointer/pinch/scroll, grouping, undo and the new presentation workflow. The last geometry/mobile refinement passed the affected scenario again (2.5 seconds).
- Typecheck and production build passed after the final geometry change. The initial/source bundle warnings remain visible; no performance acceptance is inferred.
- IAB exercised real start-side and start-arrow changes and reopened the saved canvas. At 390 × 844, all six color choices expose 44 × 44 touch areas; side/arrow fields remain visible and there is no application horizontal overflow.
- A second IAB inspection found a concrete defect absent from the first browser fixture: a top-to-left curve placed its label over the source card, whose stacking intercepted the click. Native hit testing confirmed the obstruction. A new unit regression failed first; label placement now prefers a clear point on the same curve, and labels occupy a layer above cards when overlap cannot be avoided. The expanded mobile browser scenario and actual IAB click both passed; native hit testing confirmed the label receives its center click.

## Visual comparison

The existing `docs/design/concepts/canvas-2026-11-08.png` and final IAB captures `18-canvas-connections-desktop-final.jpg` / `17-canvas-connections-mobile-final.jpg` were inspected using `view_image`. Captures remain outside the repository in the session's `workspace-reform-render` folder.

| Point | Evidence and decision |
| --- | --- |
| Structure | Free spatial stage, compact tools, white note surfaces, group frame, editable labelled connections and a selection inspector preserve the existing canvas design. |
| Current shell | The newer Quiet Workbench navigation/tab band supersedes the old concept's two-band shell. No second navigation pattern was reintroduced. |
| Typography | Application tools and controls retain the shared sans-serif scale. Authored note heading/body roles keep their appearance settings. |
| Color | Old blue chrome is superseded by the user's neutral-default direction. Optional chosen colors affect authored elements and their arrows, not application branding. |
| Selection | Existing duplicate/delete actions remain; real appearance and connection controls extend the inspector. Pure connections do not display ineffective box-order controls. |
| Mobile | The inspector becomes a bounded bottom panel; touch choices are enlarged without drawing large decorative rings. The freely panned canvas can extend outside the viewport while app controls fit the screen. |
| Copy | Actual verification note text replaces generated sample content. New labels describe the implemented side/end/color functions; there are no inert generated controls. |

The two exact test-owned canvases were moved to recoverable trash with ID/title/type/visibility guards. User notes were not rewritten for screenshots. No push or deployment occurred. Task 6's original base is unchanged. Concurrent topology repair, containment/resize, stage capture, rich read-only previews, JSON Canvas interchange and metadata/navigation still require their own acceptance.
