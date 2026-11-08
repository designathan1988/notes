# Knowledge application experience implementation plan

> **For agentic workers:** Use superpowers:executing-plans for continuous inline execution. The user explicitly opted out of further questions and approval stops.

**Goal:** Implement and verify the application workflows identified by the competitor comparison, preserving the complete gap inventory.
**Architecture:** Capability-owned React/TypeScript surfaces, one Zustand store, canonical PostgreSQL/Yjs persistence and one CSS entry point.
**Tech Stack:** Existing React, Vite, Tiptap, Yjs, Fastify, PostgreSQL, Zustand, Vitest and Playwright.
**Spec:** `docs/superpowers/specs/2026-11-08-application-workbench-design.md`.

## Global constraints

English UI/code/docs, Brazilian Portuguese chat. Continuous blocks. No user data rewriting for demonstrations. Tabs contain references only. Persisted content goes through existing owning services. Keep the supplied checkout and no remote publish/push. Explicit no-question authorization supersedes skill approval prompts.

## Review focus

1. Changing identity/workspace must not restore another account's tabs or private titles.
2. Closing/switching a tab with pending edits must retain its actual Yjs recovery data.
3. Shortcuts must respect editable controls and native browser shortcuts.
4. Several database layouts must never become competing copies of record data.
5. Restoring history and resolving discussions must enforce fresh permissions and survive failure/reload.

### Task 1: Working context and commands

**Files:** `apps/web/src/workbench/{state,preferences,commands,TabStrip,CommandPalette}.ts/tsx`; store, App, Workspace, Sidebar, Editor link handling and CSS. Tests: `tests/workbench.test.ts`, `e2e/workbench.spec.ts`.
**Interfaces:** Workbench IDs/view/pinned state and scoped preference gateway, store `createQuickPage`, command definitions, title focus request.
- [x] RED: open/activate/close/reopen/reorder tabs, scope isolation and removed references; browser Ctrl Alt N creates directly and focuses title, modifier-click opens a tab, palette navigates by keyboard.
- [x] Implement scoped tabs and one command registry; integrate direct create, context menus, back/forward and recent working context. Keep advanced creation optional.
- [x] Verify focused tests plus full behavior suite and browser flows; commit verified milestone.

### Task 2: Editor depth

**Files:** Shared editor schema/block helpers; `apps/web/src/documents/{SelectionToolbar,FindInPage,Templates,ToggleSection}.tsx`; block menu and formatting owner. Tests: rich schema/blocks and editor E2E.
- [x] RED: collapse/reopen toggles, template insertion, selection formatting, in-page find and keyboard insertion, durable rich-node round-trip.
- [x] Implement contextual formatting, highlights/strike/code/link, searchable command keys, templates, toggles, statistics and focus modes without a competing body source.
- [x] Verify real pointer/keyboard editing, collaboration and recovery plus full suite; commit.

### Task 3: Connected data application

**Files:** Databases UI/state/service view configuration and computed values; `BoardView`, `ListView`, `CalendarView`, `RecordInspector`, property management. Tests: schema/value/view invariants and data-layout E2E.
- [x] RED: record changes propagate across table/board/list/calendar, drag updates group field, saved layouts persist, field editing preserves valid data and computed values never execute code.
- [x] Implement layouts, inline record creation, record inspector, property editing, saved-view management and safe data actions/computed fields.
- [x] Verify multiple views and identities, stale schema/record conflicts, permissions and pagination; commit.

### Task 4: Discussion and revision history

**Files:** Server `discussion` and `history` owners/routes/migrations; client capability slices and docked panels; access and document service integration. Tests: real database and collaboration E2E.
- [x] RED: threaded replies/resolution persist, unauthorized reads/writes denied, history previews immutable, restore retains pre-restore state and is a new authorized durable edit.
- [x] Implement discussions, history browse/preview/restore and contextual page discussion entry points with reliable error handling.
- [x] Verify two identities, revocation, reload and failed restore behavior; commit.

### Task 5: Page identity and reusable knowledge

**Files:** Page metadata/contracts/service, templates/properties UI and indexed tag filters; record-page property surface. Tests: metadata concurrency, permissions, transfer and UI.
- [ ] RED: icons/covers/tags survive reload/export/import, record properties edit the canonical record, templates instantiate independent content and internal links.
- [ ] Implement page presentation, structured page properties/tags, reusable templates and record metadata editing directly in the inspector/page.
- [ ] Reuse canonical page instantiation to recover obsolete local drafts as private pages. Verify exact-state acknowledgement, idempotency, newer-draft preservation, current permissions, durable content and successful sign-out after recovery. Exporting alone must not silently discard drafts.
- [ ] Verify all shared schema and transfer paths and browser workflows; commit.

### Task 6: Spatial knowledge tools

**Files:** Graph layout/interaction owner and persistent canvas owner/schema/UI; shared references and interchange. Tests: layout safety, canvas persistence/ACL and pointer E2E.
- [ ] RED: graph nodes can be moved without editing page data; canvas note/media cards and connections persist, obey ACL and round-trip; touch/pointer pan and zoom remain correct.
- [ ] Implement readable graph discovery and a separate persisted spatial canvas with note links, grouping, connections and export.
- [ ] Verify actual native/browser pointer gestures, keyboard access and live permission changes; commit.

### Task 7: Whole application acceptance

- [ ] Reinspect every row of the comparison matrix against current code and rendered behavior. Repair missing interactions instead of hiding them behind setup forms.
- [ ] Run desktop/mobile visual comparison and mouse/keyboard scenarios, full typecheck/behavior/E2E/build/audit. Record measured evidence and remaining coverage limits.
- [ ] Obtain one independent final whole-change review; fix material findings with regressions and rerun checks. Keep the goal active while any required matrix item remains incomplete.

## Execution ledger

Initial authoritative state: clean main at 0d18807; local ports 5173 and 3001 live. Starting assessment: current source has no workbench tabs, command registry, discussion surface or alternate database layouts. IAB confirmed ordinary content insertion still uses a central configuration dialog. The initial research and design are recorded before implementation. The plan retains the full goal rather than treating the first milestone as completion.

- Task 1 verified: 62/62 behavior tests across 17 files, 20/20 browser tests, typecheck and web/server build passed. Native IAB verified Ctrl Alt N title focus, direct typing and palette navigation. Screenshot QA at 1536x1024, 390x844 and 360x800 found no errors/overlays or horizontal overflow. Scoped window preferences fixed a reproduced two-window restoration failure. A reproduced null-selection refresh bug no longer replaces global database navigation. Closing a disconnected tab preserves and later synchronizes its draft.
- Test correction: the original collaboration test refocused the contenteditable root after positioning two carets. It now asserts DOM caret paragraphs and uses each page keyboard directly; three focused repetitions and the full suite passed. This tests actual simultaneous typing in distinct paragraphs rather than accidentally interleaving both writers at the root.
- Task 1 visual comparison: the reference and current desktop/mobile screenshots were inspected. Preserved white continuous content, restrained neutral app chrome, real document copy, Inter 16/24 body and compact controls. OS window buttons are excluded; inspector remains closed by default under the earlier user requirement; only genuinely opened pages appear as tabs. The generated drawing is a builder reference, not a claim of user approval or final whole-product visual sign-off.
- Task 2 verified: 22/22 browser flows, including structured toggles, keyboard insertion, contextual highlight/link, literal find across marks, temporary reveal of collapsed matches, replace/undo, templates without extra spacer blocks, reload, focus mode, and 390/360px layouts. Shared schema/Yjs round-trip and Unicode statistics tests passed. The earlier complete behavior run passed 65/65; the added fourth editor test passed in the focused run and the task-done gate records the final whole-suite count. Typecheck/build passed; the lazy editor chunk remains approximately 598 kB minified and is an explicit final acceptance performance item.
- Task 2 regressions found and fixed: selection toolbar intercepted the collapse button; URL insertion replaced selected text; paste sanitization flattened supported sections/highlights; replace grouped into the preceding paste undo item; template append kept an unwanted empty insertion paragraph. Each relevant browser regression was observed failing before its fix. Corrected the spacing test to inspect the ProseMirror node-view wrapper, then reproduced the old empty paragraph and restored the candidate for a green full run.
- Task 2 visual evidence: `editor-depth/editor-desktop.png`, `editor-mobile-390.png`, `editor-mobile-360.png`, and `editor-depth/workspace/verification.json` under the session visualization directory. Current screenshots inspected; continuous body blocks remain unboxed. Clean-page QA reported no console errors/warnings, framework overlay or horizontal overflow. Development HMR during source formatting interrupted an existing session; a clean reload and native typing verified the actual search flow. This milestone does not complete the remaining database, collaboration, metadata and spatial inventory.
- Task 3 implementation: connected table/board/list/calendar layouts, real pointer and keyboard grouping, calendar date dragging, inline record creation, a docked record editor with per-document save status, property editing/archive/restore, saved-view edit/delete/automatic reopening, bounded formulas and schema-defined property buttons. Calendar date filtering happens before pagination; the mobile calendar shows all seven columns and a readable agenda. Record IDs and canonical entities remain shared across views.
- Task 3 data invariants: stable property IDs survive readable formula-name changes; computed query/search projections update atomically with values and definitions. Schema recalculation uses 500-row batches, with an explicit 501-record rollback regression. Record titles check the page owner's revision, record values check the record revision, and response merging prioritizes monotonic revisions over transaction timestamps. Scoped preferences store saved-view IDs only.
- Task 3 verification before commit: the complete 80-test behavior suite and all 26 browser flows passed. The additional malformed-schema regression then passed with the full focused database experience suite (10/10), and typecheck passed. The task-done gate records the final complete behavior suite including that new regression. Desktop/mobile QA at 1536/390/360 reported no application errors/warnings, framework overlay or page overflow. Browser assertions cover both identities, durable record bodies, typed formulas/actions, view lifecycle, recovery, ACL changes and real drag gestures. The lazy editor bundle remains approximately 598 kB minified; performance acceptance stays in Task 7.
- Task 3 fixes found by rendered verification: row refreshes no longer remount an active relation picker; same-name lookup results show their accessible database context; pending property writes cannot clear a newly opened editor; changing databases clears the old record panel; asynchronous trash reconciliation preserves settings opened during the request. Regressions were observed failing before their fixes. The test runner now checks the real API health endpoint before sign-in so Vite availability alone does not mask an API watcher restart. No test timeouts were increased to hide failures.
- Task 3 visual artifacts: `data-layouts/{board-desktop,record-inspector-desktop,calendar-desktop,board-mobile-390,board-mobile-360,calendar-mobile-390,calendar-mobile-360}.png` and `data-layouts/workspace/verification.json` in the session visualization directory. The existing Research collection was captured read-only; its note content was not rewritten for the screenshots. Only identified temporary test pages were moved to recoverable trash.
- Task 3 final gate: commit `3fa4153`, 81/81 behavior tests across 20 files, 26/26 browser scenarios, typecheck, build and clean diff checks passed. The final malformed-schema guard rejects null entries, missing IDs, non-string names and non-text formulas with an INVALID domain result. The remaining Tasks 4–7 and original commercial/native stages stay open.
- Task 4 verified before commit: 99/99 behavior tests across 22 files, 31/31 browser scenarios, typecheck, build and clean diff checks passed. The final scoped preview refinement also passed the real two-editor history scenario. Native IAB verified posting a comment, saving a named version and opening its isolated preview. Fresh read-only Product direction captures at 1536/390/360 show no application errors or horizontal overflow; the existing note content was not rewritten for the screenshots.
- Task 4 behavior: persisted page discussions with replies and resolve/reopen compare-and-swap, captured selection context, current ACL checks, paged lists that retain their position during refresh, earlier-message cursors and account-scoped unposted drafts. Commands, page actions and record selections use the same panel entry point. A confirmed mutation and a failed subsequent list refresh have separate outcomes, preventing the UI from inviting a duplicate retry of a confirmed post.
- Task 4 history: named and periodic snapshots with author/version metadata, immutable read-only previews using the shared schema and block styles, explicit restore confirmation and a frozen comparison revision. Restore atomically saves the previous document, advances the document generation, commits the replacement through Documents, and reopens affected live clients. Stale writes, revoked roles, cross-page snapshot IDs and insufficient snapshot capacity cannot change the document. Shared storage accounting bounds snapshots and attachments; ordinary edits still persist when automatic history has no capacity.
- Task 4 regressions reproduced and fixed: old-generation recovery replay, two local generations colliding in an export, older IndexedDB writes falsely reporting the newest text as saved, unchanged synchronization invalidating history comparisons, dropping an out-of-order dependent Yjs update, unrelated page moves/trash evicting another live editor, a record selection commenting on its parent database, loss of a newer or panel-switched comment draft, mobile selection toolbar overflow, hidden collapsed content in previews, enabled and misaligned historical task controls. The local recovery case passed three consecutive focused browser runs and the full browser suite. No test timeout was increased.
- Task 4 recovery interchange: local recovery ZIP version 2 has distinct generation filenames and explicit manifest file references. Older checkpoints with no trustworthy version metadata are displayed as earlier checkpoints rather than falsely labelled Version 1. Workspace ZIP remains a separate interchange format. Retained draft instantiation and sign-out resolution are mandatory Task 5 acceptance work; exporting does not silently erase or acknowledge those drafts.
- Task 4 visual artifacts: discussion-history/{discussion-desktop,history-preview-desktop,history-mobile-390,history-mobile-360}.png and discussion-history/workspace/{workspace-discussion-desktop,workspace-history-desktop,workspace-history-mobile-390,workspace-history-mobile-360}.png, plus workspace/verification.json in the session visualization directory. Only identified temporary Discussion test roots were moved to recoverable trash.
- Performance acceptance stays open in Task 7: the initial application chunk is approximately 511 kB minified (157 kB gzip) and still emits Vite's size warning. The editor and shared schema are split into lazy chunks; the warning has not been hidden by changing its threshold. No final independent whole-application review has been claimed; it remains required after Tasks 5–7.
- Task 4 final gate: implementation commit `783f990`; the post-commit task-done gate passed 99/99 behavior tests across 22 files in 43.45 seconds. All 31 browser scenarios passed; the final preview padding refinement also passed the focused two-editor history scenario. Typecheck/build and diff checks passed. The initial bundle warning and all remaining Tasks 5–7, including retained-draft instantiation and sign-out resolution, remain open.
