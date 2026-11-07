# Note visual specification

Source: built-in Image Gen, generated before frontend implementation on 2026-11-07. Technical design approved; visual direction selected under the user's authorization to implement. This is an application, not a landing page.

## Concept inventory

- `concepts/workspace.png`: 1536 × 1024; primary editor, sidebar, inline table, context panel.
- `concepts/database.png`: 1536 × 1024; full-width structured table, view/filter/sort/create controls, eight seeded records.
- `concepts/mobile.png`: portrait reference, 852 × 1846; corresponding logical width 390px, drawer navigation and compact bottom editor controls.

The generation prompts asked for a quiet editorial working environment, English native controls, a true white document surface, pale cool gray navigation, charcoal serif content and clean sans-serif chrome, forest/sage accent, fine borders, no gradients, no decorative dashboard cards, no photos, and no rasterized interactive UI. The database/mobile prompts used the primary concept as a style reference and generated fresh standalone states.

## Color and geometry lock

- Main surface: true white `#ffffff`; navigation: cool gray `#f3f5f6`; text `#242a2e`; muted `#72767d`; rule `#dce1e5`.
- Accent `#39745f`; selected row `#dfeae2`; soft status `#e2eee4`.
- At the native 1536px reference, sidebar 265px; context rail 352px; central document maximum 704px. Header 56px; tabs 44px. Table view closes the context rail and uses 72–80px main gutters.
- The document is open whitespace, not nested cards. Thin rules divide table rows and sections. Buttons have 5px radius; dialogs may use 10px radius and a restrained shadow.

## Typography and icons

- Inter for chrome, controls, tables and metadata, 13–15px with explicit line heights.
- Newsreader for document title (48px, weight600), document body (20px, line-height1.45), headings (29px, weight600), subtitle (23px).
- Mobile title34px, body19px, headings26px, side gutters20–24px.
- Lucide outline icons, generally18px, stroke1.6; document leading icon36px. The simple four-square Note brand is code-native geometry. No standalone raster asset is needed by this design.
- Focus-visible uses an accent outline; selected navigation uses a sage surface and left rule. Respect reduced motion.

## Above-the-fold copy inventory

Brand/workspace: Note; Studio workspace; Search anything; Ctrl K; All pages; Knowledge graph; Databases; WORKSPACE; FAVORITES; Invite people; Settings; Jonathan; Connected.

Seeded navigation: Getting started; Product; Product direction; Research; Design principles; Reading room; Meeting notes.

Chrome: Product / Product direction; Saved; Share; Document; Database; Graph; Page details; ON THIS PAGE; CONNECTIONS; LINKED MENTIONS; Connect an idea.

Document: Product direction; A shared space for ideas that become something.; Updated just now; 3 connections; Good ideas become useful when they connect.; What we’re building; One place to capture what matters, connect the dots, and move ideas forward.; Keep the clarity of a document, the structure of a database, and the context of a connected knowledge base.; The principles; Make space for focused thinking; Keep information connected; Build with care, not complexity; Explore this space; Related notes.

Inline table: Name; Type; Status; User interviews / Research / In progress; Design principles / Document / Evergreen; Reading list / Collection / Active.

Mentions: Research / Our next steps follow the product direction.; Design principles / The thinking behind the product.

Database state: Research; Evidence, observations, and the questions worth asking.; All records; New view; Filter; Sort; New record; Name; Type; Status; Priority; Updated; 8 records; Changes appear in every connected view. Seed rows follow `database.png`.

## Component inventory and responsive continuation

App shell, workspace switcher, sidebar tree/favorites, header/breadcrumb/save status/presence/share, tab navigation, page title/description, editor, contextual outline/backlinks/local graph, structured table, search dialog, page commands, member/settings dialogs. Authentication, error, empty and creation states are necessary functional continuations using the same tokens; they are not marketing sections.

At narrow widths, sidebar is a dismissible drawer; context is an optional drawer. Show the compact brand/header, breadcrumb, tabs and bottom document tools. Keep tables scrollable within their own region and controls reachable. Never create body-level horizontal overflow.

## Intentional semantic differences from the raster concepts

- Presence avatars and connection/save labels must reflect real sessions and status, not the mockup's illustrative people. The initial signed-in identity is Jonathan in development.
- Record counts, update times, snippets and connections are live data. They may change when actual content is edited.
- Database tab navigates to the selected database, or to the workspace database picker for an ordinary document; it never fabricates a table for unrelated content.
- Selection, hover and mobile controls gain accessible labels, tooltips, and focus states without extra decorative visible copy.
- User-created page content and authentication/settings/creation states necessarily extend the initial copy inventory.

## Fidelity verification ledger

Pending rendered implementation: compare native-size screenshots for sidebar/header proportions, document type scale and rhythm, white/cool-gray/sage palette, open container model and thin rules, icon geometry, exact seeded copy, table anatomy, and narrow-screen continuation. Use view_image on both concept and latest render before handoff. Record actual fixes and remaining deviations here.
