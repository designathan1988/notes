# Sinapta interface audit: report

Audit of 2026-11-10, done as a real user in headless Chrome at 1440×900 and on a 390×844 phone, in dark and light themes. Sixty findings, each with a photo, are logged in [2026-11-10-interface-audit.md](2026-11-10-interface-audit.md); photos are in `.runtime-audit/audit/` and the browser session folder named there.

This report groups the findings by cause, gives the fix for each, and records what was done. Status: **Fixed** (changed and verified in the browser), **Planned** (needs a feature of its own; design below), **Not reproduced**.

## 1. Broken (P1)

| # | Problem | Cause | Solution | Status |
|---|---------|-------|----------|--------|
| 22 | Italic text renders upright everywhere | Only Inter's upright face is bundled; `font-synthesis: none` forbids a slanted fallback | Load Inter's italic variable face next to the upright one | |
| 8 | "Open in new tab" and Ctrl+click only navigate in place | Both still call `openTab`, which now just navigates since in-app tabs were removed | Open a real browser tab at the page's URL (the app routes by URL hash) | |
| 55 | Phone: the whole app slides 84px sideways; Appearance cannot be closed | `.app-shell` can scroll horizontally and focus moves into an off-screen element; opening a panel from the drawer leaves the drawer open on top of it | Clip the shell (`overflow: clip`); close the drawer whenever a panel or dialog opens from it | |
| 27 | Page stopped answering once after Enter in a to-do | Not reproduced: no long task, focus stayed in the text on every retry; the browser tool's own capture timed out | — | Not reproduced |

## 2. Wrong or confusing (P2)

| # | Problem | Solution | Status |
|---|---------|----------|--------|
| 10, 38 | Plurals ignore count ("1 resultados", "1 bancos de dados") | Count-aware wording for every counted label | |
| 31, 32 | Comments: no keyboard way to post; pane buttons default to `submit` | Enter posts, Shift+Enter breaks the line; every pane button gets `type="button"` | |
| 23 | Inline code tiny and low contrast | Notion's treatment: 85% of the text size, red-tinted text, neutral tinted background | |
| 21 | Table text 12px, centred headers, 51px rows | 14px text, headers aligned left in the regular weight with a tint, ~33px rows | |
| 56 | Phone text column off-centre (22px / 74px) | The 708px column rule applies from tablet width up; phones use the full width minus equal margins | |
| 57, 49, 29 | Capture button covers content (last rows, side panes, phone backdrop); phone rows 28px | Hide the corner button while a side pane, the phone drawer or a dialog is open, and leave room under scrollable lists; phone rows 40px | |
| 39 | Graph loading text unreadable; unlabelled nodes | Loading text uses the stage's own text colour; every node shows its title | |
| 46 | English default names in a Portuguese workspace | Show the server's English defaults ("Untitled", "Untitled canvas", "Untitled template") in the reader's language | |
| 37 | Home uses bordered cards (against the standing rule); crowded create row | Flat rows for "continue where you left off"; quiet text buttons for creating | |
| 13 | Search results show no location; same-title page and record look identical | Show each result's parent path and kind | |
| 50 | Document builder's block toolbar covers the block above | Put the builder's block toolbar in the left margin like the page handle | |
| 58 | Title hover shows only "…" | Notion's quiet row above the title on hover: Add icon · Add cover · Add comment | |
| 7 | Sidebar row menu has 18 entries across three levels | Notion's row menu: favourite, copy link, duplicate, rename, move, open in new tab, trash; page-panel actions stay in the page's "…" menu | |
| 15, 16, 18 | New page is a four-field form; type is a bare dropdown; empty pages offer no starters | Type chosen as visual options with icon and one line each; empty page offers starters | |
| 24, 25 | Selection toolbar lacks "turn into" and colour; block menu lacks colour and "copy link to block" | Planned: needs text and block colour marks in the schema | Planned |
| 34 | No full-width / small-text page toggles | Planned: page-level layout settings next to Appearance | Planned |
| 35 | Share is a workspace modal | Planned: anchored Share popover listing who has access, with "copy link" | Planned |
| 41 | No gallery or timeline database views | Planned: two new layouts on the existing view model | Planned |
| 53 | No permanent delete or empty trash (3,213 trashed pages) | Planned: server purge of a page tree (document, records, files, links) behind a confirmation | Planned |
| 60 | Small icon picker; icon beside the title | Planned: searchable emoji picker; icon above the title | Planned |
| 3 | No forgot-password route | Planned: needs outgoing email | Planned |

## 3. Polish (P3)

| # | Problem | Solution | Status |
|---|---------|----------|--------|
| 17 | Thick focus ring after a mouse click when a dialog returns focus | Ring only for keyboard focus (`:focus-visible` after keyboard), not for focus restored after a pointer interaction | |
| 11 | Modals blur the whole app | Dim only, as Notion does | |
| 2 | Sign-in form jumps when an error appears | Reserve the error line | |
| 28, 30, 33 | Details pane gap and mixed disclosure triangles; Comments tab not reflected in the bar; history explanation | Even spacing and one triangle; bar reflects the open tab; one short line of explanation | |
| 36 | Account menu wider than the sidebar | Match the sidebar width | |
| 54 | Escape does not close Appearance; overflowing values | Escape closes it; values ellipsize, labels on one line | |
| 59 | Table corner button visible without focus | Show it only while the text is focused (the button keeps focus in the text when pressed) | |
| 26 | English checkbox label in the to-do | Translated label | |
| 4, 5, 19, 20, 40, 42, 45, 47, 48, 52 | Dark checkboxes, small page links, footer chrome, slash menu order, database header icons, board pills, loading text placement, template back link, outlined filters, settings layout | Aligned with Notion's treatment one by one | |

## Cross-cutting causes

- **Small type creeps in** (10–12px hints, table cells, code). Every label now uses the scale tokens (12/13/14/16px).
- **Outlined boxes where Notion is borderless** (filters, create buttons, invite). Controls are quiet text buttons that tint on hover.
- **Things that float over content** (anchored toolbar, builder toolbar, capture button). Floating controls live in margins or hide while a pane is open.
- **Leftover code paths from removed features** (tabs: `openTab`, "Open in new tab"). Each was traced and given its real meaning.

## Synthesis (user research): themes and priority

Affinity mapping of the 60 observations gives six themes. Each is scored for impact on a person's work (how often they hit it × how badly) and for effort.

| Theme | Findings | What a person experiences | Impact | Effort |
|-------|----------|---------------------------|--------|--------|
| A. Things float over what you are working on | 29, 49, 50, 55, 57, 59 (+ the fixed page toolbar) | A button or toolbar covers the text or row you want to click; on a phone the app slides sideways | High | Low |
| B. Formatting and text you cannot read | 21, 22, 23, 4, 5, 39 | Italic does nothing; table and code text too small; graph loading unreadable | High | Low |
| C. Navigation verbs that lie | 8, 7, 34 | "Open in new tab" does not; the row menu mixes page, panel and workspace actions | High | Low |
| D. Wording that ignores language and count | 10, 38, 46, 26 | "1 resultados", "1 bancos", English default names in Portuguese | Medium | Low |
| E. Notion's affordances are missing or hidden | 15, 16, 18, 24, 25, 35, 41, 58, 60, 53 | Icon/cover hidden in a "…" menu; no colours; no gallery; trash can't be emptied | High | High |
| F. Visual noise and inconsistency | 1, 2, 11, 14, 17, 19, 20, 28, 30, 32, 33, 36, 37, 40, 42, 45, 47, 48, 52, 54 | Outlined boxes, blur, tiny hints, repeated titles, focus rings after clicks | Medium | Low–medium |

Priority, from the impact/effort matrix: **A, B, C, D first** (high impact, low effort), then **F** (cheap polish across many screens), then **E** one feature at a time.

## Design (system design): one rule per theme

Instead of patching each screen, every theme gets one structural rule that all screens follow:

```
Theme A  →  Layer policy        Content layer (text, rows) is never covered.
                                Margin layer: handles, table corner, block toolbars live in the gutters.
                                Overlay layer: menus/dialogs/drawer; while one is open, corner
                                buttons (capture) hide. The shell clips (overflow: clip), never scrolls.
Theme B  →  Type scale          Text is 16px; tables 14px; labels 12–13px; nothing below 12px.
                                Every face that can be requested is loaded (upright + italic).
Theme C  →  Navigation intents  navigate(page) = go here;  openInBrowserTab(page) = new tab.
                                Menus are scoped: row menu = row actions; page menu = page + panels.
Theme D  →  Wording             Counted labels choose singular/plural by count; server defaults
                                ("Untitled…") are shown in the reader's language.
Theme E  →  Feature backlog     Each missing Notion affordance is a feature with its own spec.
Theme F  →  Quiet controls      Controls are borderless text/icon buttons that tint on hover;
                                one focus ring, only for keyboard focus; dialogs dim, never blur.
```

Trade-offs made:
- **Hiding the capture button while a pane is open** loses one click of reach; covering content would be worse, and Ctrl+. still opens capture.
- **Translating server default titles on display**, rather than migrating stored data, keeps old pages readable without a migration. The cost: the stored title stays English until someone renames the page.
- **The desktop page toolbar was removed** in favour of the margin handle plus the selection toolbar (Notion's model). Undo/redo stay on the keyboard, and phones keep the full toolbar.

Revisit as it grows: theme E items need server work (purge, sharing) and schema work (text and block colours). Each gets a spec before code.

## Status after the first round of fixes

Verified in headless Chrome after each change (photos `fix-01…fix-05` in `.runtime-audit/audit/`).

| # | Fix | Evidence |
|---|-----|----------|
| 22 | Italic renders: Inter's italic face is loaded | Italic face loaded, `<em>` slanted (fix-01-page.png) |
| 8 | "Open in new tab" and Ctrl/⌘+click open a real browser tab (sidebar, editor and canvas links, graph, page menu) | `openInBrowserTab` in `workbench/route.ts` |
| 55 | Shell clips (`overflow: clip`); opening the phone drawer closes side panels | Shell scrollLeft stays 0 on the phone |
| 56 | Phone text column centred | 22px / 22px margins |
| 57, 29, 49 | Phone rows 40px (pages and favourites); capture button hides while the drawer, a side pane or a dialog is open | Rows 40px; button `display: none` with the drawer open (fix-05-phone-drawer.png) |
| 23 | Inline code at 85%, red-tinted, neutral tint; scoped to text blocks so the Document builder is untouched | fix-01-page.png |
| 21 | Tables: 14px, headers aligned left, 34px rows | fix-01-page.png |
| 4 | To-do checkbox: 16px outlined square, blue when done | 16×16 measured |
| 26 | To-do checkbox named in Portuguese ("Tarefa: …", "Concluída: …") | `richExtensions.tsx` |
| 31, 32 | Enter posts a comment, Shift+Enter breaks the line; no "0 respostas" | `DiscussionPanel.tsx` |
| 10, 38 | Count-aware labels ("1 resultado", "1 banco de dados") | fix-03-home-after.png |
| 7 | Sidebar row menu reduced to Notion's row actions | `PageActions` variant `sidebar` |
| 11 | Dialogs dim instead of blurring | `.dialog::backdrop` |
| 37 | Home: no boxed cards, quiet create buttons | fix-03-home-after.png |
| 58 | Hover row above the title: Adicionar ícone · Adicionar capa · Adicionar comentário | fix-02-title-hover.png |
| 50 | Document builder block tools sit inside the selected block's corner | fix-04-builder-toolbar.png |
| 59 | Table corner button only while working in the table; pressing it keeps the caret | `TableTools.tsx` |

Reassessed after investigation:
- **#46 English default names** are data created by English-locale test runs on this dev workspace; pages created in Portuguese are already named "Sem título". No product change.
- **#39 graph "unreadable" loading** was a photo of the view's fade-in from white; the node labels are hidden on purpose to avoid collisions.
- **#54 Escape** already closes Appearance when focus is in the panel; in the text, Escape belongs to the editor (block selection).
- **#32 `submit` buttons**: they sit outside any form, so their default type has no effect.
