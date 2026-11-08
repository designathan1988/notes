# Knowledge application workbench

## Intent

Replace the form-driven beta experience with a coherent knowledge application. Preserve continuous content blocks, collaborative durability, hierarchy, private data boundaries and one state manager. The user opted out of questions and approval stops; implementation proceeds under that explicit authorization.

## Chosen approach

Evolve the current React/TypeScript application by capability. A rewrite would discard verified persistence and access behavior; a CSS-only restyle would leave the interaction gaps intact. Tabs, commands and contextual actions form the shell; richer editor, data, collaboration and spatial tools share that shell.

The generated reference `C:/Users/Jonathan/.codex/generated_images/01a1b7b6-be13-7823-ace0-da731e95b11e/exec-45c17f60-af87-4707-9fd9-f41277a9e2b0.png` guides application hierarchy: tab strip, compact breadcrumb controls, light sidebar, continuous white document and docked inspector. It is a builder-selected reference, not a falsely claimed user approval. Actual stored copy and readable 16/24 document typography take precedence over generated content. Native operating-system window buttons are excluded from the web shell. No page body cards or added paragraph gaps.

## Ownership and interfaces

- Workbench slice: `WorkbenchTab { id, pageId, view, pinned }`, `openTab(pageId, view?)`, `activateTab(id)`, `closeTab(id)`, `reorderTabs(source, target)`, `restoreWorkbench(identity, workspace)`. References only; canonical pages remain `WorkspaceState.pages`. Persist scoped IDs/UI preferences, validate references against current authorization on reopen and remove unauthorized tabs on refresh/logout.
- Command registry: immutable command definitions with title, keywords, shortcut, availability and execution. Palette and global shortcuts consume the same definitions. Commands invoke owning store actions; they do not duplicate domain mutations.
- Direct creation: `createQuickPage(parentId?, kind?)` delegates to `createPage`, navigates and requests title focus. Advanced create remains available for explicit privacy/location choices. Ordinary sidebar + and Ctrl Alt N create immediately.
- Editor: one shared schema and one Yjs owner. Add toggle sections and reusable templates, selection formatting and find. No second writable Markdown/JSON body.
- Databases: layout/group/date options are view configuration only; records stay in the existing normalized entity map. Board movement edits the owning record value. Record inspector and page metadata share those entities.
- Computed properties: canonical formula definitions refer to stable property IDs and the UI presents property names. One bounded arithmetic interpreter owns evaluation. `records.computed_values` is a rebuildable read projection for sorting/filtering, updated atomically with its inputs and schema; it is never an editable competing source. Schema recalculation and search outbox updates use bounded batches within one transaction.
- Record titles remain owned by page metadata. Record value revisions and page metadata revisions travel together so a stale table title cannot overwrite a newer page-header edit. Shared row refreshes preserve schema references and focused cell controls.
- Saved-view preferences contain only view IDs, scoped through the workbench preference owner. A database change remounts its local tools; it cannot retain a record panel from the preceding database. Background removal reconciliation preserves overlays opened while the request was pending.
- Discussion and history: separate server owners, current ACL checks within transactions, author/role rules and retained edit history. Restore uses the canonical document pipeline and produces a new durable state.
- Restore advances the document generation after retaining its previous state. Older local drafts remain separate and exportable. The canonical page-instantiation command used for reusable templates must also recover these drafts as independent private pages, clear only a matching retained draft after the new copy is durable, and allow sign-out without discarding newer edits.
- Discovery: graph remains a derived read model; spatial canvas is a separately owned persistent document capability with stable page references. Tags/properties remain structured metadata rather than duplicated document prose.

## Acceptance

Application-level actions work from mouse and keyboard without mandatory setup forms. Working tabs survive reload and remain scoped to the current account/workspace. Creating, navigating, closing and reopening documents never loses unsynchronized content. All view types mutate the same records. Discussion/history are real persisted data. Rich nodes round-trip through collaboration, recovery, interchange and indexing. Desktop/mobile interaction, accessibility, privacy changes, concurrent edits and failure/retry paths must be exercised in the rendered app.

The full gap matrix in `docs/research/2026-11-08-application-gap-analysis.md` is the completion inventory. No green subset or cosmetic redesign substitutes for the remaining rows.
