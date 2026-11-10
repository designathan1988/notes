# Sinapta interface audit, 2026-11-10

Tested as a real user in headless Chrome (1440×900 and a 390×844 phone), signed in as the seeded demo user on the local dev server. Every step was photographed; photo paths are listed per finding. Notion is the reference for layout and behaviour.

Severity: **P1** broken or data at risk · **P2** wrong or confusing · **P3** visual polish.

## Findings log

| # | Area | What happens | Severity | Photo |
|---|------|--------------|----------|-------|
| 1 | Sign-in | Submitting empty fields shows the browser's native bubble, not an inline message in the app's style | P3 | 003-click.png |
| 2 | Sign-in | A wrong password shows the message but the whole form jumps 17px upward | P3 | 01-signin-wrong-password.png |
| 3 | Sign-in | No "forgot password" route | P2 | 01-signin-wrong-password.png |
| 4 | Page | Checkboxes are grey filled squares in dark mode; Notion draws an outlined square | P3 | 02-home-dark.png |
| 5 | Page | Page-link rows ("Explore this space") are 13px bold, smaller than the 16px body; Notion keeps page links at body size | P3 | 02-home-dark.png |
| 6 | Page | Connection rail knots use arbitrary orange/blue colours | P3 | 02-home-dark.png |
| 7 | Sidebar | Row "…" menu has 18 entries mixing workspace (invite), page-panel (find, focus, details, comments, history) and row actions; Notion's row menu is short | P2 | 04-row-menu.png |
| 8 | Sidebar / editor / graph / canvas | "Open in new tab" and Ctrl+click only navigate in place (in-app tabs were removed); Notion opens a browser tab | P1 | 04-row-menu.png |
| 9 | Sidebar | Row menu opens far above its row (top 229 for a row at 364) | P3 | 04-row-menu.png |
| 10 | Search | "1 resultados": wrong plural | P2 | 05-search-empty.png |
| 11 | Search | Backdrop blurs the whole app; Notion dims without blur. Title header above the field; Notion has none | P3 | 05-search-empty.png |
| 12 | Search | Date filter is a raw native date input | P3 | 05-search-empty.png |
| 13 | Search | Results show no location (parent path) and no highlight of the match; a page and a record with the same title look identical | P2 | 06-search-results.png |
| 14 | Command palette | Each row repeats its group as a subtitle instead of grouped sections; order is arbitrary ("Reset app appearance" 4th); "New document" creates the visual web Document, easy to confuse with a page | P3 | 07-command-palette.png |
| 15 | New page | A four-field form (title, type, location, visibility) before anything exists; Notion creates the page at once and offers choices on the empty page | P2 | 08-new-page-dialog.png |
| 16 | New page | Type picker is a bare dropdown (Página / Documento / Banco de dados / Quadro) with no icons or descriptions; "Página" vs "Documento" is unclear | P2 | 09-new-page-type.png |
| 17 | Focus | After a dialog closes, focus returns to the clicked button with a thick 2px ring even for a mouse click | P3 | 10-new-page-created.png |
| 18 | Empty page | No starters on an empty page (Notion: table, board, list, templates…) | P2 | 10-new-page-created.png |
| 19 | Page footer | "0 palavras · 0 min de leitura", a find / template / expand icon row and an "Adicionar um bloco" row sit under every page; Notion shows none of it | P3 | 10-new-page-created.png |
| 20 | Slash menu | "Seção recolhível" is listed before "Texto"; Notion starts with Text, Page, To-do, headings | P3 | 11-slash-menu.png |
| 21 | Table | Cell text is 12px (body is 16px; Notion tables 14px); header cells centred; cells 51px tall with 10px padding | P2 | 13-table-filled.png |
| 22 | Editor | Italic text renders upright everywhere: only Inter's upright face is loaded and `font-synthesis: none` blocks a slanted fallback | P1 | 16-blocks-and-selection.png |
| 23 | Editor | Inline code is 12px dark blue (rgb 85,92,153) on dark grey: tiny and low contrast; Notion uses 85% size, red-tinted text, grey background | P2 | 16-blocks-and-selection.png |
| 24 | Editor | Selection toolbar lacks "turn into" and text/background colour, which Notion has | P2 | 16-blocks-and-selection.png |
| 25 | Editor | Block actions menu has no colour, no "copy link to block", no comment; it opens over the block it acts on instead of beside the handle | P2 | 17-block-actions.png |
| 26 | Editor | To-do checkbox has an English accessible name ("Task item checkbox for …") in the Portuguese interface | P3 | 065-eval |
| 27 | Editor | One run: after typing a to-do and pressing Enter the page stopped answering and the next Enter landed on the Home button. Not reproducible afterwards (no long task, focus stayed); likely the test tool's own capture timing out | — | 052/054 captures |
| 28 | Details pane | Empty 40px gap under "Conexões 0"; "Prévia do grafo" uses a different disclosure triangle | P3 | 18-details-pane.png |
| 29 | Capture | The corner capture button sits over the side pane when it is open | P3 | 18-details-pane.png |
| 30 | Comments | With the Comments tab open, the bar still highlights the Details button, not Comments | P3 | 19-comments-pane.png |
| 31 | Comments | No keyboard way to post: Enter adds a line, Ctrl+Enter does nothing (Notion: Enter posts, Shift+Enter breaks the line) | P2 | 20-comment-posted.png |
| 32 | Comments | Pane tabs and filters have no `type`, so they are submit buttons; avatar is a bare letter; "↳ 0 respostas" instead of a reply field; textarea shows a resize grip; 10px hint | P3 | 20-comment-posted.png |
| 33 | History | Six lines of explanation above the version list | P3 | 21-history-pane.png |
| 34 | Page menu | Missing Notion's page-level toggles (full width, small text, font style) | P2 | 22-topbar-page-menu.png |
| 35 | Share | "Convidar pessoas" is a workspace-level modal; no list of who has access, no "copy link"; Notion's Share is a popover anchored to the button | P2 | 23-invite.png |
| 36 | Account menu | Popover is 8px wider than the sidebar and spills over its border; theme switch touches the edge; no signed-in account line | P3 | 24-account-menu.png |
| 37 | Home | "Continue de onde parou" uses bordered cards (against the standing "no block cards" rule); five outlined create buttons crowd the greeting row | P2 | 26-home-light.png |
| 38 | Home / search | Plurals ignore count: "1 bancos de dados", "1 resultados" | P2 | 26-home-light.png |
| 39 | Graph | Loading state: white text on a pale wash, unreadable; several nodes have no label; title repeats the breadcrumb | P2 | 27-graph.png, 28-graph-loaded.png |
| 40 | Database | No property-type icons in headers, no vertical grid lines, three unlabelled toolbar icons, helper sentence at the bottom | P3 | 29-database.png |
| 41 | Database | View types limited to table, board, list, calendar; Notion also has gallery and timeline | P2 | 30-db-view-picker.png |
| 42 | Database | Board group names are plain text, not coloured pills; cards repeat "Status/Priority" labels; card grips always visible | P3 | 31-db-board.png |
| 43 | Database | Calendar cannot use created/edited time when no date property exists | P3 | 32-db-calendar.png |
| 44 | Database | "Inspecionar" (side peek) appears only when hovering the name cell, not the row | P3 | 33-db-row-hover.png |
| 45 | Canvas | Loading text sits flush in the top-left corner with no margin; title repeated (breadcrumb and toolbar) | P3 | 35-canvas.png |
| 46 | Defaults | New items get English names in the Portuguese UI ("Untitled", "Untitled canvas", "Untitled template") while pages get "Sem título" | P2 | 36-canvas-loaded.png |
| 47 | Templates | "Voltar aos modelos" shown beside the list it returns to; no built-in templates | P3 | 37-templates.png |
| 48 | All pages / filters | Filters are outlined boxes; Notion uses borderless text buttons | P3 | 38-all-pages.png |
| 49 | Capture | The corner capture button covers content on several screens (last row's open arrow, side panes, phone drawer backdrop) | P2 | 38-all-pages.png, 48-phone-drawer.png |
| 50 | Document builder | Floating block toolbar covers the text of the block above (same class of bug as the old page toolbar) | P2 | 43-appearance.png |
| 51 | Document builder | Saved content shows lost characters ("linhcurta", "hamada"); not reproducible with real typing now, likely older damage | — | 39-document-builder.png |
| 52 | Settings | Small modal with horizontal tabs; Notion uses a large settings window with a side list | P3 | 41-settings.png |
| 53 | Trash | No permanent delete or "empty trash" (3,213 pages accumulate); entries show no deletion date or original location | P2 | 42-settings-trash.png |
| 54 | Appearance | Escape does not close the panel; "Seleção" value overflows; "Tamanho da interface" wraps | P3 | 43-appearance.png |
| 55 | Phone | Opening Appearance from the drawer leaves the drawer open on top; `.app-shell` scrolls sideways (scrollLeft 84), shifting the whole app; the panel cannot be closed | P1 | 44-46 phone captures |
| 56 | Phone | Text column is 294px with 22px left / 74px right margin (the desktop 708px rule leaks onto phones) | P2 | 47-phone-home.png |
| 57 | Phone | Drawer rows are 28px (too small for touch); capture button floats over the drawer backdrop | P2 | 48-phone-drawer.png |
| 58 | Title | Hovering the title shows only a "…"; Notion shows "Add icon · Add cover · Add comment" above it | P2 | 49-title-hover.png |
| 59 | Table | The table's corner button shows while the text is not focused | P3 | 49-title-hover.png |
| 60 | Icon | Icon picker has 12 emoji and a text field (Notion: searchable full picker); icon sits beside the title instead of above it; breadcrumb omits the icon | P2 | 51-icon-picker.png, 52-icon-set.png |
