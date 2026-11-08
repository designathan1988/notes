# Studio Index workspace interface

Date: 2026-11-08. Supplements the active application-workbench design and its whole-product visual acceptance. This is an existing-product redesign, not a new starter or a narrowed replacement goal.

## Intent and selection

Make daily reading, writing, navigation and data work feel composed, fast and clearly structured. The user explicitly rejected the previous interface, green application styling and serif type, and asked for research before implementation. They previously opted out of questions and approval stops. The implementer selected Studio Index after auditing the live app, researching the reference products and comparing three independently generated directions. This is not user approval of a generated image.

The audit and primary references are in `docs/research/2026-11-08-workspace-interface-audit.md`.

Considered approaches:

1. Quiet Workspace: graphite/green navigation and editorial serif document. Rejected by the user; do not implement or reuse its palette/type.
2. Studio Index: separate activity rail, substantial page tree, horizontal working tabs and an uninterrupted sans-serif writing surface. Selected because it distinguishes tools from content without sacrificing the established working-tab model.
3. Focus Desk: vertical working tabs and a single main header. It removes one chrome row but duplicates more page lists in the navigation area and reduces tree space. Not selected.

## Visual sources and binding corrections

- Primary writing: `docs/design/concepts/interface-studio-index-2026-11-08.png`, native 1487 × 1058.
- Mobile reading: `docs/design/concepts/interface-studio-mobile-2026-11-08.png`, logical target 390 × 844; record actual generated pixel dimensions during verification.
- Database/inspector: `docs/design/concepts/interface-studio-data-2026-11-08.png`.

All generated with the built-in Image Gen tool and actual current-app screenshots attached as references. The images are design artifacts, never application UI raster assets.

Explicit corrections take precedence over image imperfections: remove green status chips from the writing concept; use solid controls instead of generated button gradients; keep all text sans-serif; keep mobile touch targets comfortably sized and remove the duplicate mobile Note wordmark if necessary to fit the actual current-page context and actions. Existing rich record bodies remain real continuous editors, not the plain bordered note box sketched in the database concept. No fake activity tabs or controls may be shipped. These corrections must appear in the fidelity ledger.

## System

Latest user correction supersedes the generated palette: the application chrome is neutral, without a dominant green, violet or blue. Retain the selected navigation/layout/type system but replace its accent styling with charcoal/gray. Authored document/site colors remain user content. Errors/warnings may use restrained semantic color rather than a brand accent.

One central authored stylesheet, existing cascade layers and focused component owners. Add/replace authoritative component rules rather than accumulating competing theme overrides.

| Token | Target |
| --- | --- |
| Canvas/content | `#ffffff` |
| Navigation surface | `#f5f5f6` |
| Activity rail | `#27282d` |
| Text | `#26272d` |
| Secondary text | `#656770`, measured for readable contrast |
| Rule | `#e1e2e5` |
| Action/focus | `#45464e` |
| Action hover | `#292a30` |
| Selection | `#e8e9ec` |
| Soft control surface | `#f2f2f4` |
| Error | contrasting restrained red; warnings amber |
| Type | Inter, system sans-serif; code uses system monospace |
| Chrome | 13–14px, explicit control typography |
| Document | 17–18px, about 1.65 line height, comfortable reading width |
| Title | 36–38px desktop, 29–30px mobile, sans-serif semibold |
| Section heading | 23–25px, sans-serif semibold |
| Icons | existing Lucide family, approximately 1.7 stroke, 16–18px chrome |
| Control corners | about 6px; meaningful popovers/dialogs slightly larger |
| Motion | short state transitions, no typing/drag latency, reduced-motion support |

No green brand/status surfaces, serif typography, decorative gradients, invented metrics, AI controls, avatars or marketing content. Do not recolor authored note content or remove user-selected media/covers. Color is a secondary categorical cue; labels remain explicit.

## Layout and behavior

### Navigation and working context

- A narrow dark activity rail provides existing All pages, Knowledge graph, Databases, Templates and Canvases destinations with visible active state and hover/keyboard labels.
- The adjacent navigation pane holds a compact wordmark/workspace switcher, search, direct New page, favorites and the existing draggable nested tree. The page tree gets the flexible height; secondary actions do not displace it.
- Settings, commands, account/sign-out and invitation controls remain reachable and functional. Existing navigation, ACL filtering, drag owner and working-state preferences remain authoritative.
- Horizontal desktop tabs retain activation, close/pin/reopen/reorder and keyboard operation. On narrow screens, use a reachable working-pages disclosure rather than a row of tiny clipped tabs. It projects the same tab list; do not create a second working-set store.
- Sidebar collapse/drawer focus trapping, Escape and focus restoration remain correct. Do not rely on hover alone for essential navigation.

### Writing and page identity

- An unobtrusive utility header keeps context, durable status and a small number of useful page actions. Sharing does not visually dominate the writing task.
- The title, existing description and one compact metadata line lead directly to content. Empty tag/property/customization controls stop forming a tall form-like stack.
- Page icon/cover editing stays in its existing presentation owner. Existing covers remain visible. Actual tags and typed properties stay editable and discoverable through a clear disclosure/contextual control; record properties retain their canonical database owner.
- Ordinary blocks remain continuous, without paragraph cards or extra per-block space. Heading/list/quote rhythm provides hierarchy. Gutter handles and insertion guides communicate direct manipulation.
- Formatting appears for focused/selected writing rather than covering reading content permanently. Find/template/focus commands and document statistics remain accessible.
- Fix the observed leading-quote initialization warning and the existing canvas boundary-focus failure from evidence. Do not suppress console output or weaken exact-content assertions.

### Tables, inspectors and other surfaces

- Keep real tables, canonical cells and connected board/list/calendar layouts. Compact the page heading and group existing view/filter/sort/property/create controls coherently.
- Improve readable labels, focus/hover/selection and restrained categorical color. A single shared cell presentation must serve table, record and ordinary-page properties without changing field values.
- Inspectors use one clear hierarchy and the same surface/type/control system. Activity remains in the existing discussion/history owner; no fake copied activity interface.
- Search, commands, menus, templates, settings, graph and canvas extend this same token/control family. Do not create unrelated theme variants or reframe every region as a card.

### Responsive and accessibility

- Desktop at the primary concept's native viewport and at a smaller laptop size; tablet around 1024; mobile 390 and 360 wide.
- Main content becomes the primary mobile surface. Navigation is a drawer, working tabs a reachable disclosure, and secondary actions stay accessible through contextual menus.
- Keep main reading content near the title rather than after empty controls. Formatting must not overlay reading content in the unfocused state. Verify focused editing and a useful path to insertion, media and block actions.
- Preserve keyboard labels/order, visible focus, escape/return, modal focus management and live permission behavior. Measure contrast and target sizes; do not claim full accessibility compliance from screenshots.

## Ownership and implementation

`Sidebar` owns navigation presentation and delegates page gestures to `useTreeDrag`. `TabStrip` owns presentation of the existing workbench tabs. `Workspace` composes the shell; page-action/chrome extraction is permitted only if it gives that responsibility a clear owner. `PageHeader` composes title/description and the existing page presentation/tags/properties owners. `Editor`, its block/selection surfaces and DocumentSession keep content and editor lifecycle ownership. `Cell` owns shared property-value presentation. Shared UI primitives own popover/dialog/focus behavior. Root Zustand and PostgreSQL/Yjs remain unchanged as application and durable-data authorities.

Before final handoff, inspect the source concepts and fresh rendered screenshots in the same pass. Record at least copy/layout/type/palette/navigation/table/mobile comparisons, every intentional correction above, real task behavior and remaining mismatches. A passing build or test subset does not complete visual acceptance or the original product goal.
