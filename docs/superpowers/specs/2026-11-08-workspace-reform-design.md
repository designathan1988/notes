# Quiet Workbench: structural redesign and user-controlled appearance

Date: 2026-11-08. Status: implementation design selected by the implementer under the user's explicit no-question/no-stop authorization. It is not a claim of user approval or an implemented interface.

## Authority and intent

The latest request requires a new application architecture grounded in a deep inspection, not another cosmetic pass. The live audit is `docs/research/2026-11-08-workspace-reform-audit.md`: 35 inspected captures across content, data, spatial work, supporting workflows and responsive states, including a confirmed table-modal pointer defect.

The latest additional requirement is equally binding: nothing rigid. Users can change fonts throughout the app and content, colors, sizes, density and styles. Neutral/sans-serif is the starting appearance, not a restriction. Page-specific styling and complete HTML/CSS/JavaScript authoring remain required; do not substitute a plain code block, a few presets or raw host-DOM injection for those capabilities.

This design supersedes the earlier Studio Index layout and palette contract. The original capability inventory, Task 6 BASE/status, incomplete spatial acceptance, final whole-change review and commercial/native stages remain in force.

## Alternatives and selection

Three independent image concepts were displayed in this order and saved in `docs/design/concepts/`:

1. `workspace-reform-quiet-workbench.png`: one light navigation hierarchy, direct named destinations, visible working tabs and one integrated workbench band. Selected because frequent navigation and open-page context remain immediately available.
2. `workspace-reform-writing-desk.png`: vertical working pages above the page tree, with destinations behind Browse. It saves the horizontal tab strip but makes the left hierarchy longer and hides frequent global destinations. Its generated concept-name branding is not a product rename.
3. `workspace-reform-adaptive-navigator.png`: Pages/Open/Views navigation modes and a single-mode Links inspector. Clear in isolation, but more mode changes are required to reach the current working set and global destinations.

Selected companions: `workspace-reform-data-inspector.png`, `workspace-reform-mobile.png`, `workspace-reform-appearance.png`. Desktop concepts are 1487×1058. The mobile artwork is 852×1846 representing a logical 390×844 viewport; compare proportions/type at that logical scale, not at its raw raster dimensions.

The generated images are visual references, not shipping bitmap UI or user-approved specifications. The user's explicit compactness, accessibility, neutral defaults and customization requirements govern corrections to generated oversized control/title examples. Document measured corrections during implementation; do not silently copy a large title/sidebar merely because a generator drew it.

## Application structure

### Navigation and working context

- Replace the dark activity rail plus adjacent pane with one quiet light navigation pane. Keep named All pages, Databases, Knowledge graph, Templates and Canvases destinations on desktop, existing favorites, the draggable nested page tree and direct creation. A compact Studio workspace switcher and compose action replace the large logo/workspace/search/New-page stack. The footer is one account/settings entry rather than multiple utility bands.
- Keep the current single workbench owner for tabs, pin/unpin, close/reopen, reorder and independent window restoration. Present them in one compact top band alongside history navigation and a restrained save/context/share/more action group. Remove the separate permanent breadcrumb/action toolbar; ordinary page ancestry can appear in the content header.
- Use one action hierarchy for common page work, organization, collaboration and advanced operations. Keep actions reachable by pointer, keyboard and mobile. Reduce permanent duplicates instead of deleting capability. Contextual menus must have predictable grouping and focus return.
- Mobile uses one compact workbench header, a purposeful navigation drawer and a working-pages sheet with a visible count. Expose pin/reopen/close actions in that sheet; do not depend on desktop right-click or hardware shortcuts. Remove the dark five-destination footer and three-band drawer footer. Global destinations remain clearly reachable through the drawer's browse entry without shrinking touch labels.

### Content surfaces

- Documents have continuous unboxed prose. Align authored icon/title, description and content deliberately; omit the generic default file icon in ordinary note titles. Do not put empty date/property setup rows before every note. Authored icon/cover/tag/property data must remain accessible and unchanged.
- Keep ordinary-note metadata/properties in an explicit context surface by default; record properties remain content in their canonical record owner. Allow page appearance to choose inline versus contextual metadata. No form-like empty setup stack in the reading surface.
- Contextual formatting follows selection/focus. Block insertion and cell operations stay near the task, with readable text and compact groups. Table operations become a contextual menu rather than a large modal inventory. Native modals use an independent portal boundary so toolbar visibility/pointer state cannot disable them.
- Data pages use a compact heading and a coherent saved-view/action row, followed directly by the real data table/board/list/calendar. Group filters/sort/view configuration; move advanced property/template controls into a clear View options entry. Cells read as values at rest and expose editing deliberately. Preserve all typed fields, formulas, relation actions, saved views, grouping/drag and underlying records.
- Catalogs become useful workspace explorers with a purposeful compact row hierarchy, meaningful location/type/updated context and clear discovery/filter controls. Do not replace a data model with decorative cards or filter only an arbitrary loaded subset while implying complete results.
- Context and record panes use one deliberate pane family. Reflow available working space; do not obscure essential controls. Opening a record at 1024px must not leave a 184px sliver of its table. Collapse nonessential navigation presentation or use a full-screen workflow when the combined minimum pane widths do not fit. Mobile panels align to the actual workbench boundary, removing the unexplained y85/y56 gap.
- History has a genuine read-only preview/comparison workspace with sufficient content width, a clear return path and the existing frozen comparison/restore owner. Do not squeeze a full rich document into a tiny nested preview beside the same current document.
- Canvas/graph use available workspace area with a compact task toolbar and contextual object actions. Selecting text does not automatically require a permanent arrangement inspector. Keep real rich canvas objects, geometry, connections and direct manipulation; they are user content, not dashboard decoration.
- Search and commands share one predictable quick-access surface while retaining their existing search/indexing and command-registry owners. Common results/actions have meaningful groups and context. Advanced filters are disclosed when useful; avoid repeated symbols/category captions and separate modal inventories for the same navigation intent.
- Settings, data transfer and templates use the same hierarchy/type/control family. Forms remain appropriate for actual settings, but large explanatory headers and repeated setup copy do not dominate daily work. Recovery remains available in Settings and gains a contextual route from local-save/error states.

## Defaults and customization

### Default visual contract

White content, a light neutral navigation surface, graphite text and neutral selection/action/focus. Inter/system sans-serif for UI/prose, system monospace for code, minimal necessary rules and restrained overlay elevation. No dark rail, imposed brand hue, serif default, decorative gradients, card-based prose or marketing/dashboard framing. Category/media colors authored by users remain content. Error/warning semantics remain perceivable with text/icons as well as color.

Use readable balanced density: approximately 13–14px UI, 16–17px prose, 28–32px page titles and 21–24px content subheadings at default settings. Data/catalog headings are smaller than document titles. Desktop rows should fit their information; mobile controls target comfortable 44px hit areas without inflating content typography or adding tall empty bands. Measure actual contrast, focus and available content space. Do not claim WCAG conformance from a screenshot.

### App appearance

- Entry points: workspace/account menu, Settings → Appearance and the command registry. Changes preview immediately and save automatically; no mandatory wizard, Apply cycle or approval prompt. Reset is always directly available.
- Personal app appearance belongs to the authenticated account and persists across reload/devices; one root Zustand slice projects it into CSS. Do not create another theme state manager or a separate editable copy in component state. An account-scoped local pending cache can preserve unconfirmed preferences; it must not overwrite newer remote fields or leak to another identity.
- Allow independently selecting Interface, Body, Headings and Code fonts, plus text scale/density and other relevant style values. Offer convenient defaults and custom family/font-source entry through Add font. Do not limit users to Inter, sans-serif or a small preset list. User-selected serif or colored appearances are valid even though the initial design is neutral.
- Expose all meaningful surface/text/navigation/action/selection/border roles through simple color controls. Presets are starting points. Custom CSS is an advanced optional entry, not mandatory setup. App CSS customization is personal presentation; user JavaScript belongs to the isolated web-page runtime.
- Keep application defaults authoritative in the central stylesheet. Store appearance overrides, not an independently maintained second default palette in server/client code. A pure projection maps overrides to root CSS variables so portals/dialogs inherit the same current appearance. Reset removes overrides. Built-in alternative presets are explicit override sets, not competing default sources.
- Add font supports a custom installed family and a loadable font source, with a usable fallback if loading fails. Use browser font loading and the existing attachment owner when owned assets are used; do not introduce a parallel font storage service or fetch arbitrary URLs through the server. Custom-source licensing/network availability is not a reason to silently substitute a couple of fixed fonts.
- Provide an appearance-reset command/shortcut independent of custom CSS visibility so a broken personal style can be recovered. Ordinary customization stays direct; do not add warning checklists or contrast-approval bureaucracy.

### This-page appearance and full web content

- The same Appearance surface has an explicit This page scope for page typography, width, spacing, colors, metadata layout and styles. Page choices persist through the existing Pages presentation owner and its authorization/revision handling; cloning, templates and native transfer preserve them. They do not mutate the user's personal app theme or other collaborators' personal settings.
- Complete HTML/CSS/JavaScript components and full-page layouts follow the supplemental web-authoring plan. Raw source is canonical collaborative text in the existing document, with source/code/split/preview controls and proper browser isolation. Users should create/run/edit a web page directly, without provider-install wizards or agent approval flows.
- Revalidate the preliminary renderer/resource policy against genuine website behavior: module scripts, CSS/fonts, images/media, controls/forms and normal web dependencies. Preserve the host's data/auth boundary without turning every resource into a configuration chore. The earlier self-contained-only starting proposal is not permission to ship a permanently restricted substitute for the user's full web-authoring request. Test the selected execution/origin model before claiming support.
- Imported HTML into ordinary rich notes continues through the existing sanitizer. Explicit web authoring preserves raw source. User-authored CSS is document content, not a second application stylesheet. Neither style controls nor a generated HTML export become a second editable body.

## Ownership and architecture

`Sidebar` presents current navigation and delegates gestures to `useTreeDrag`. `TabStrip` projects existing workbench state; the new combined workbench header composes those controls instead of owning another tab list. `PageHeader` and existing presentation/property owners retain metadata writes. Shared `Cell` remains the property-value owner across data views/records/ordinary properties. Shared overlay primitives own portal/focus/position behavior.

Add a cohesive `appearance` capability with shared override validation, authenticated preference persistence in Identity, one root-store slice, pure CSS projection and one scoped customizer/font picker. Page presentation extends its existing owner rather than copying theme state into documents. Existing Documents/DocumentSession retain collaboration, generation, durable status, recovery and history ownership. All app styles stay in `apps/web/src/styles.css`; edit/remove obsolete authoritative rules instead of appending competing theme sheets. No new starter, hosting migration or implementer subagents.

## Preservation and verification

For every audited surface, record the new corresponding state and fix the documented structural issue. Compare selected concept and fresh implementation at the same logical viewport with `view_image`, recording intentional compactness/customization corrections. Verify actual main workflows on desktop/tablet/390/360, keyboard/focus and native pointer/touch where relevant. Maintain readable content and working controls under a user-chosen alternate font/palette/scale, and verify reset, account isolation, failed-save recovery and reload.

Keep the table-modal pointer defect and working-note stuck-Saving failure visible in the ledger until their causes are fixed with meaningful regressions. The earlier 69/72 browser result is not a green full gate. The canvas caret correction has five passing focused repeats and passed its full-run scenario, but the entire pending collaboration batch still needs a verified milestone commit. Do not increase test timeouts, hide controls or rewrite seeded content to manufacture acceptance.

Completion requires the full preserved capability matrix, original unresolved spatial work and one final independent whole-change review. The new appearance and web-authoring requirements remain part of the objective until implemented and verified; concepts, a theme picker or this document alone do not complete them.
