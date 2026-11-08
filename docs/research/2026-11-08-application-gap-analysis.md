# Application experience gap analysis

Date: 2026-11-08. Starting checkpoint: 0d18807. The user explicitly requested investigation and implementation without further questions or approval stops. Previous green tests prove their covered flows, not product completeness.

## Evidence and comparison

| Capability | Reference behavior | Current implementation evidence | Required change |
| --- | --- | --- | --- |
| Working context | [Obsidian tabs](https://obsidian.md/help/tabs) keep several pages open and support modifier-click navigation | `Workspace.tsx` renders one selected route; no tabs or retained page working set | Identity/workspace-scoped tabs, reopen/close/reorder, modifier-click, back/forward and recent pages |
| Direct creation | [Notion](https://www.notion.com/help/keyboard-shortcuts) supports quick page creation and contextual block commands; [OneNote](https://support.microsoft.com/en-au/onenote/take-and-format-notes) provides direct note entry and page organization | A sidebar plus opens a multi-field Create a page form | Create immediately, focus the new title, choose advanced location/type only when requested; contextual tree actions |
| Command surface | [Obsidian command palette](https://obsidian.md/help/plugins/command-palette) provides searchable keyboard actions | Ctrl K only searches pages; other commands scattered among dialogs | One command registry, keyboard palette, shortcuts and discoverable command hints |
| Editor ergonomics | Notion uses contextual formatting and slash commands; OneNote supports mixed rich content and annotations | Basic toolbar and empty-paragraph slash menu; no collapsible sections, highlights, template chooser or in-page find | Selection toolbar, complete formatting, searchable keyboard block menu, toggles, templates, find and document statistics |
| Connected data | [Coda views](https://help.coda.io/hc/en-us/articles/39555897467021-Create-connected-table-views) present the same records in several visual layouts | A table is the only available layout; record creation and schema changes use central forms | Table, board, list and calendar layouts with canonical shared entities; inline row creation, record inspector and property management |
| Operational data | [Coda controls](https://help.coda.io/hc/en-us/articles/39555865536013-Canvas-control-basics) connect interactive actions to structured records | No computed fields or document actions | Safe computed values and explicit record actions without JavaScript evaluation |
| Discussion | [Notion discussion](https://www.notion.com/help/comments-mentions-and-reminders) supports threaded conversations and resolution | Presence exists, but no actual discussion model/UI | Persisted, permission-scoped page discussions, replies, resolve/reopen and live refresh |
| Recovery/history | Established editors provide accessible revision history | Server checkpoints exist, but no user-facing browse/restore workflow | History list/preview, safe restore as a new durable edit and retained previous state |
| Connected knowledge | Obsidian links, properties and [Canvas](https://obsidian.md/help/plugins/canvas) distinguish graph discovery from spatial arrangement | Backlinks exist; graph is a fixed circular layout and has no node manipulation | Readable graph layout, node dragging, filtering and connection context; a separate persisted visual canvas |
| Page identity | Mature workspaces distinguish documents, collections and record metadata visually | Same generic file glyph, minimal metadata; record pages hide editable database properties | Page icon/cover/presentation, tags/properties and record details on the page; reusable templates |
| Application shell | Desktop apps preserve working state and expose contextual controls | Web form dialogs interrupt ordinary writing | Compact tabbed chrome, contextual anchored menus and a docked inspector; responsive mobile tools |

## Priorities and invariants

Implement the working context and direct interaction first, then editor depth and data views, followed by discussion/history, discovery/canvas and cross-surface integration. This order resolves the user's central complaint while preserving the full comparison inventory. Remaining rows stay explicitly unfinished until implemented and verified; completing the shell alone does not complete the goal.

Retain one Zustand application store. Tabs hold page IDs and route state, never body/title copies. PostgreSQL and Yjs remain authoritative for durable data. UI-only layout preferences are identity/workspace scoped. Each capability owns its server service, client slice and UI. Shared editor schema must support every persisted node across editor, import, export and search. All authored CSS stays in `styles.css`. Never alter existing user note content to make screenshots look complete.

The references establish interaction patterns, not a claim of total feature parity. Hosted operations, native packaging and external service provisioning remain tracked by the original staged architecture; no real invitations, payments or publication are authorized by this investigation.
