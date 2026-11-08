# Canvas group containment

## Interaction contract

[Obsidian Canvas](https://obsidian.md/help/plugins/canvas) is a reference for direct spatial organization, grouping and resize/navigation controls. This implementation retains Note's canonical explicit group references. Moving a note or group chooses the smallest fully enclosing stationary group; moving out releases it. Nested groups move each descendant once, without flattening rich content into a separate canvas body.

Destination frames are captured before a move. An existing group therefore cannot keep expanding after a departing member and prevent that member from leaving. Moving groups and their descendants are excluded as destinations. Equal-area candidates use a deterministic ID ordering.

## One geometry owner

`canvas-containment.ts` projects effective boxes from the existing typed document. Stored group rectangles are minimum frames; child bounds expand the visible frame with shared padding. A child resize, remote member movement or concurrent independent growth consequently produces a containing frame without writing derived bounds back into Yjs. The same projection serves live cards/groups, connection endpoints, fit, resize feedback and immutable history/template previews.

The original geometry validator and limits remain in place for authored data. This is a presentation projection, not permissive import repair. Explicit group resize starts at the displayed frame origin; descendant content remains visible when the requested minimum frame is smaller. Pointer cancellation discards the transient resize. Keyboard arrows resize the focused handle; Shift uses the existing larger step. Read-only views expose no resize handles and reuse the original mutation guard.

The live view now computes the set of moving descendants once per render instead of rediscovering it for each box. Descendant traversal uses a children index and queue. A behavior test covers movement at the 2,000-element canvas limit, including a separately selected descendant moving once. This is bounded scale coverage, not a claim of measured browser frame-rate acceptance.

## Regression evidence

The initial behavior tests failed on missing containment support, then specifically on a moved note retaining null membership instead of adopting its inner group. The native scenario failed because Resize group did not exist. Both failures were observed before their repairs.

New behavior scenarios verify nested effective frames without canonical mutation, inner/outer adoption and release with retained rich-content identity, resize containment, and two independent Yjs clients changing opposite members while preserving a concurrent text edit. Both clients derive the same expanded frame and retain the original stored group width. The element-limit movement case also passes.

The native scenario exercises drag in, move together, pointer/keyboard group resize, Escape cancellation, member growth, saved reload, drag out and subsequent independent group movement. Existing canvas capture, collaboration/offline/ACL, presentation, topology, preview/template and mobile gesture cases are included in the affected gate. Final terminal counts are recorded in the execution ledger.

The final nested-selection audit reproduced a separate existing defect: grouping an ancestor together with a deeply selected note reassigned that note directly to the new wrapper. The regression failed with wrapper instead of inner membership. Grouping and drop adoption now use the same ancestor-aware selection-root resolver. The test passes and the inner hierarchy remains intact.

All 26 affected canvas browser scenarios passed in 1.6 minutes before that last hierarchy repair. After it, all 13 affected containment/core canvas scenarios passed in 42.9 seconds and all 29 affected behavior scenarios passed. The final complete behavior suite passed 218 tests across 42 files in 79.69 seconds. Current typecheck and production build passed; existing initial/source-editor chunk warnings remain (788.15 kB / 531.32 kB minified). No complete 88-scenario browser gate is inferred from these focused runs.

## Visual evidence

The user-authorized Playwright path captured `canvas-groups/canvas-group-desktop.png` and `canvas-group-mobile.png` in the session's external `workspace-reform-render` directory. Both images were inspected; the fixture shows the group after its note has been released. The integrated browser remained unavailable from the preceding surface inventory.

| Point | Reference/render decision |
| --- | --- |
| Structure | The existing spatial stage and compact tool strip remain; group membership follows actual movement. |
| Chrome | The current neutral Quiet Workbench supersedes the older canvas concept's blue shell. |
| Group frame | The selected outline is restrained, with a small visible corner handle. |
| Input | The handle supports mouse, keyboard and a 44-pixel invisible touch target on mobile. |
| Content | Notes remain normal rich blocks; resizing a frame does not scale text or replace their content. |
| Mobile | The existing bounded selection panel remains at the bottom, with fit/zoom accessible below it. |
| Copy | The verification fixture contains one source and an Evidence group; it does not imitate generated concept sample content. |

Portable JSON Canvas import/export, metadata navigation and the remaining whole-product comparison/performance/appearance/accessibility acceptance remain open. This milestone does not claim completion of those requirements or commercial/native delivery.
