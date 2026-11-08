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
- [ ] RED: open/activate/close/reopen/reorder tabs, scope isolation and removed references; browser Ctrl Alt N creates directly and focuses title, modifier-click opens a tab, palette navigates by keyboard.
- [ ] Implement scoped tabs and one command registry; integrate direct create, context menus, back/forward and recent working context. Keep advanced creation optional.
- [ ] Verify focused tests plus full behavior suite and browser flows; commit verified milestone.

### Task 2: Editor depth

**Files:** Shared editor schema/block helpers; `apps/web/src/documents/{SelectionToolbar,FindInPage,Templates,ToggleSection}.tsx`; block menu and formatting owner. Tests: rich schema/blocks and editor E2E.
- [ ] RED: collapse/reopen toggles, template insertion, selection formatting, in-page find and keyboard insertion, durable rich-node round-trip.
- [ ] Implement contextual formatting, highlights/strike/code/link, searchable command keys, templates, toggles, statistics and focus modes without a competing body source.
- [ ] Verify real pointer/keyboard editing, collaboration and recovery plus full suite; commit.

### Task 3: Connected data application

**Files:** Databases UI/state/service view configuration and computed values; `BoardView`, `ListView`, `CalendarView`, `RecordInspector`, property management. Tests: schema/value/view invariants and data-layout E2E.
- [ ] RED: record changes propagate across table/board/list/calendar, drag updates group field, saved layouts persist, field editing preserves valid data and computed values never execute code.
- [ ] Implement layouts, inline record creation, record inspector, property editing, saved-view management and safe data actions/computed fields.
- [ ] Verify multiple views and identities, stale schema/record conflicts, permissions and pagination; commit.

### Task 4: Discussion and revision history

**Files:** Server `discussion` and `history` owners/routes/migrations; client capability slices and docked panels; access and document service integration. Tests: real database and collaboration E2E.
- [ ] RED: threaded replies/resolution persist, unauthorized reads/writes denied, history previews immutable, restore retains pre-restore state and is a new authorized durable edit.
- [ ] Implement discussions, history browse/preview/restore and contextual page discussion entry points with reliable error handling.
- [ ] Verify two identities, revocation, reload and failed restore behavior; commit.

### Task 5: Page identity and reusable knowledge

**Files:** Page metadata/contracts/service, templates/properties UI and indexed tag filters; record-page property surface. Tests: metadata concurrency, permissions, transfer and UI.
- [ ] RED: icons/covers/tags survive reload/export/import, record properties edit the canonical record, templates instantiate independent content and internal links.
- [ ] Implement page presentation, structured page properties/tags, reusable templates and record metadata editing directly in the inspector/page.
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
