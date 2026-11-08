# Canvas outline and contextual metadata

## Reproduced failures

The actual Details outline called global DOM scrolling. In the native regression, clicking a distant heading left the canvas at 37% zoom instead of framing its note at a readable scale. The new navigation command now uses the canvas controller's camera and scrolls the containing note internally. It does not scroll or write another editor.

The mobile visual pass then exposed canvas zoom controls floating above the Details overlay and covering the Connect an idea button. A hit test on the covered part of that real button failed before the repair. The canvas stage now creates its own stacking context; the same test passes, and the refreshed capture shows an unobstructed panel. Nested metadata section borders and redundant spacing were removed, and the two remaining connection actions use neutral semantic colors.

## Ownership and behavior

- The existing page/account-scoped workbench editor-request channel carries heading and link requests. It remains part of the one Zustand store; there is no global DOM event bus, alternate command store or additional document body. Existing find/template requests remain intact.
- Ordinary document requests scroll a target inside that editor. Canvas requests frame the actual containing card and scroll its rich-content container to expose the heading. Mobile Details closes after navigation so the content is visible.
- Heading positions follow the same outline order as the existing projection. Static HTML component headings occupy their component's position rather than shifting all later rich headings onto the wrong target. Literal code is not an outline heading. Website headings reveal their source component; this does not claim navigation inside a separate-origin authored iframe.
- Canvas Details reuses PageTags and PageProperties. The existing Pages contract, revision handling, property manager and ACL already support canvas metadata; no new persistence API or second schema was added.
- Page actions now offers direct Page details access on mobile. Connect an idea uses the same editor command path and LinkPicker. Canvas URLs receive a new independent note through the existing insertion owner; ordinary inline links keep their original path.
- Viewers can navigate and inspect metadata, while link creation and metadata edit controls are disabled/absent. Unsupported database link creation is no longer presented as an inert generic note command; database relations remain with the existing database property controls.

## Browser and behavior evidence

The new author scenario exercises a note 6,000 units away, a heading below fifteen paragraphs, camera framing, actual internal scrolling and an unchanged durable document version. It edits tags and a typed property, verifies server persistence, creates a URL card while preserving the prior note, reloads, checks metadata again and navigates on mobile without horizontal page overflow.

The viewer scenario uses a separate authenticated account. It checks read-only navigation, unchanged durable version, disabled link creation, absent metadata mutation controls and no editable content. Its temporary role is restored to the previously observed role in finally; the test-owned page is moved to recoverable trash by its known ID.

Both native scenarios passed. All 16 affected navigation/editor/interface/properties/workbench scenarios passed in 50.9 seconds before the final layering/style refinement. All eight affected navigation/presentation/snapshot/UI scenarios passed after that refinement in 25.6 seconds. The final complete behavior suite passed 220 tests across 43 files in 85.70 seconds. Typecheck and production build passed; the existing initial/source-editor bundle warnings remain (788.81 kB / 531.32 kB minified). The complete 90-scenario browser suite is not inferred from these focused gates.

## Actual rendering

The authorized Playwright path generated `canvas-navigation/{canvas-details-desktop.png,canvas-details-mobile.png,canvas-heading-mobile.png}` in the session's external `workspace-reform-render` folder. Fresh final desktop and mobile images were inspected alongside `docs/design/concepts/workspace-reform-mobile.png`; the canvas concept was inspected during the preceding group/preview work. The integrated browser remained unavailable from the preceding inventory.

| Point | Comparison and decision |
| --- | --- |
| Content | The jump exposes the real saved heading and conclusion at readable scale instead of leaving a tiny note in an overview. |
| Structure | Existing quiet navigation/tab chrome remains. Contextual metadata stays in Details, off the spatial stage. |
| Mobile | Details occupies a coherent screen and closes after heading navigation. Its buttons are no longer covered by canvas controls. |
| Density | Tags and one property use compact existing controls, without an extra form, card or permanent toolbar. Redundant nested rules were removed. |
| Typography | Shared sans-serif controls and rich-content heading/body hierarchy remain. |
| Color | Connection actions now use neutral semantic tokens; no dominant host color was introduced. |
| Scope | The reference is a reading-page design, while these captures show canvas Details and focused spatial content. It is not claimed as an exact reproduction of a different screen. |

Portable JSON Canvas interchange and the remaining whole-product appearance, accessibility, performance and comparison-matrix acceptance remain open. No push, deployment, commercial or native-package completion is claimed.
