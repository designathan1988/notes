# Collaborative Knowledge Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved collaborative web beta with real persistence, rich capture, structured records, indexed discovery, and a faithfully implemented visual design.

**Architecture:** A modular TypeScript web/server workspace with one client state store and explicit server capability ownership. PostgreSQL owns relational state and durable Yjs updates; binary attachments use a storage adapter. Search and links are rebuildable, access-filtered projections.

**Tech Stack:** React, Vite, TypeScript, Zustand, Tiptap, Yjs, Hocuspocus, Fastify, Better Auth, Drizzle, PostgreSQL, TanStack Table, Vitest, Playwright. Use PGlite (actual PostgreSQL in WASM) with filesystem persistence for portable local development because Docker/PostgreSQL binaries are unavailable; production requires a PostgreSQL connection. Local filesystem attachments and a local invitation outbox implement development adapters; production requires object storage and email configuration.

**Spec:** `docs/superpowers/specs/2026-11-07-knowledge-workspace-design.md`

## Global Constraints

- Code, documentation, and interface copy are English; chat communication is Brazilian Portuguese.
- Hosted SaaS with online collaboration and local recovery of changes.
- Full offline workspace operation and native installers are not initial-release requirements.
- One Zustand application store; no second general-purpose application state library.
- One authored CSS entry point.
- A temporary blob URL is not a persisted asset.
- JSON is a versioned export/rendering projection, not a competing document autosave.
- No live sales, external invitation delivery, production deployment, or paid provider provisioning in this implementation checkpoint.
- Explicitly authorized sequence: plan followed by implementation. Execute inline, with an independent whole-change review at the end.

## Review Focus

- Permission changes during an active socket or stale index must immediately stop unauthorized reads/writes (tasks 2, 3, 5).
- A network echo or local recovery write must never be reported as a durable server save (task 3).
- Nested-page moves and record-parent constraints must remain valid under competing requests (task 2).
- Unsupported paste and interrupted attachment uploads must preserve available source input and show a recoverable state (task 4).
- Out-of-order projection work and import ID remapping must not lose links or expose another workspace (tasks 5, 6).

## File map

- Root configuration: package scripts, strict TypeScript, workspace config, ignored runtime data, development launcher, README.
- `packages/contracts/src/index.ts`: shared runtime schemas, identifiers, page/record/access responses and error codes.
- `packages/editor/src/schema.ts`: one editor extension registry, internal-link/media nodes, JSON/text/link projection helpers.
- `apps/server/src/platform/database.ts` and `migrations/001-initial.sql`: one database gateway, portable local PostgreSQL, external PostgreSQL, schema/migration lifecycle.
- `apps/server/src/identity/{schema,auth}.ts`: Better Auth integration and organization membership mapping.
- `apps/server/src/access/service.ts`: authorization and role/visibility decisions.
- `apps/server/src/pages/service.ts`: page invariants, mutation transactions, hierarchy, trash.
- `apps/server/src/documents/{service,collaboration}.ts`: durable Yjs persistence, acknowledgement protocol, live authorization.
- `apps/server/src/attachments/{service,storage}.ts`: metadata and development/S3 binary lifecycle.
- `apps/server/src/databases/service.ts`: typed properties, record revisions, saved table views.
- `apps/server/src/knowledge/service.ts`: versioned search/link projections and queries.
- `apps/server/src/transfer/service.ts`: versioned ZIP export/import.
- `apps/server/src/{app,main,seed}.ts`: route composition, lifecycle and isolated development fixtures.
- `apps/web/src/state/{store,api}.ts`: sole application state manager and HTTP boundary.
- `apps/web/src/documents/{Editor,session,capture}.tsx/ts`: document UI, Yjs/recovery session owner, paste handling.
- `apps/web/src/navigation/Sidebar.tsx`, `workspace/Workspace.tsx`, `databases/DatabaseView.tsx`, `knowledge/{Search,Graph,ContextPanel}.tsx`, `settings/Settings.tsx`: focused capability surfaces.
- `apps/web/src/ui/{Dialog,IconButton}.tsx`, `App.tsx`, `main.tsx`, `styles.css`: accessible primitives, composition and all authored styling.
- `tests/{access,pages,documents,attachments,databases,knowledge,transfer}.test.ts`, `e2e/workspace.spec.ts`: behavior and cross-session verification.

## Pre-flight interface ledger

| Producer → consumer | Shared interface | Ruling |
| --- | --- | --- |
| Task 1 → all | `Database.query<T>(text, params): Promise<T[]>`, `transaction<T>(fn): Promise<T>`; shared schemas | One SQL gateway for both PostgreSQL runtimes; no capability reads another runtime directly. |
| Task 2 → 3–6 | `Access.requirePage(actor, pageId, mode)`, `requireWorkspace(actor, workspaceId, role)` | Server access checks remain authoritative, including collaboration and projections. |
| Task 3 → 4–6 | `Documents.open/save/project`, `DocumentSession` and durable acknowledgements | Zustand stores status and read models, never a second writable body. |
| Task 4 → 6 | Finalized attachment IDs and controlled editor media nodes | Export includes only authorized finalized bytes; unfinished uploads retain retry state. |
| Task 5 → 6 | Record revisions, derived search/link revisions | Imports use owning services and stable ID remapping; indexes are rebuilt. |

---

### Task 1: Durable workspace foundation and visual specification

**Files:** Root configuration, shared contracts/editor packages, server platform/identity files, `tests/foundation.test.ts`, `docs/design/*`.

**Interfaces:** Produces `Database.query<T>(sql: string, params?: unknown[]): Promise<T[]>`, `Database.transaction<T>(fn: (tx: Database) => Promise<T>): Promise<T>`, `createApp(options): Promise<FastifyInstance>`, runtime request schemas and error envelope `{ code, message }`.

- [ ] Generate complete editor concept and coordinated table/mobile references; record approved technical design, exact visual copy, tokens, icons, and layout inventory before UI coding.
- [ ] Initialize Git in the existing supplied directory; no extra worktree is necessary for this new empty project. Commit the approved documents and plan. Create the minimal package/test configuration needed by the first test.
- [ ] Write `persists_workspace_across_database_reopen` and `rejects_invalid_contract_payload`; reopen a real disk-backed database and expect the stored workspace title; invalid page titles and oversized payloads must fail validation.
- [ ] Run `npm test -- tests/foundation.test.ts`; expected RED for the unimplemented gateway/contracts.
- [ ] Implement the database gateway, idempotent SQL migration, shared schemas, Better Auth schema integration and a health endpoint. Production must reject missing database/auth/storage configuration rather than silently use local development adapters.
- [ ] Run the focused test and `npm test`; expected all implemented foundation tests PASS. Commit with `feat: add persistent workspace foundation`.

### Task 2: Identity, access, and nested pages

**Files:** Server identity/access/pages modules, auth/page routes, seed fixtures, web API/store and login/navigation; `tests/access.test.ts`, `tests/pages.test.ts`.

**Interfaces:** Consumes task 1 database/contracts. Produces `Actor { userId: string }`, `Access.requireWorkspace(actor, workspaceId, minimumRole)`, `Access.requirePage(actor, pageId, mode: 'read' | 'write')`, `Pages.create/move/update/trash/restore`, typed `Page` read models with `revision`.

- [ ] Write RED tests: wrong workspace denied; viewer writes denied; private subtree hidden from admin; final owner removal denied; cycle-producing moves rejected; record pages cannot leave owning database; conflicting revisions return `CONFLICT`; auth session persists through a real request cookie.
- [ ] Run `npm test -- tests/access.test.ts tests/pages.test.ts`; expected failing behavior assertions before implementing the owners.
- [ ] Implement membership/visibility policy, transactional page operations, stable IDs, bounded navigation queries and REST routes. Reuse Better Auth organizations for membership; development fixtures use real identities, never a production demo bypass.
- [ ] Add the one Zustand store with API commands, entity selectors, route/selection state and normalized updates. Add authentication and workspace selection flows and focused navigation components matching the concept.
- [ ] Run focused tests and `npm test`; expected PASS. Commit with `feat: add workspace access and nested pages`.

### Task 3: Collaborative editor with truthful durability and recovery

**Files:** Shared editor registry; documents service/collaboration; web document session/editor; `tests/documents.test.ts` and collaboration browser tests.

**Interfaces:** Consumes access and page identities. Produces `Documents.load(pageId): Promise<Y.Doc>`, durable update persistence and `{ pageId, generation, stateVector }` acknowledgements; client `DocumentSession` owns Y.Doc, provider, recovery and save status.

- [ ] Write RED tests: concurrent Yjs edits survive reopen; rejected viewer or revoked-member update cannot persist; no acknowledgement before commit; acknowledgement covers all persisted local clocks; outdated generation cannot replay; recovery failure produces degraded state.
- [ ] Run `npm test -- tests/documents.test.ts`; expected RED.
- [ ] Implement one server persistence pipeline, generation-aware local recovery, schema checking, presence, update authorization and durable acknowledgement. Reject new socket writes after membership changes. Add rich blocks, formatting, links, undo/redo and slash/block insertion commands from the shared registry.
- [ ] Exercise two independent browser contexts editing the same real document, reconnect and backend reload; expected convergent content and honest save states.
- [ ] Run `npm test`; expected PASS. Commit with `feat: add durable collaborative documents`.

### Task 4: Rich capture and durable media

**Files:** Web capture pipeline; shared media/fallback nodes; attachment service/storage/routes; `tests/attachments.test.ts`, paste corpus fixtures.

**Interfaces:** Consumes document commands and access. Produces `Attachments.begin/finalize/read` and `CaptureResult { content, preservedSources, warnings }`; finalized document media references use attachment IDs.

- [ ] Write RED tests: oversize uploads rejected at 25 MiB; arbitrary paths rejected; cross-workspace bytes inaccessible; pending objects not downloadable; interrupted uploads retry; unsupported HTML retains available original; pasted script cannot execute in application origin.
- [ ] Run `npm test -- tests/attachments.test.ts`; expected RED.
- [ ] Implement private local filesystem storage for development and S3-compatible production storage, resource-linked authorization, bounded uploads and lifecycle states. Implement rich HTML/text/Markdown/file capture, explicit ambiguous-paste modes, recoverable fallback blocks and controlled media playback.
- [ ] Test paste fixtures and real image/file upload then reload and download; expected preserved bytes, source fallback and no silent content loss.
- [ ] Run `npm test`; expected PASS. Commit with `feat: preserve rich paste and attachments`.

### Task 5: Structured tables, search, and linked knowledge

**Files:** Server databases/knowledge modules; web DatabaseView/Search/Graph/ContextPanel; `tests/databases.test.ts`, `tests/knowledge.test.ts`.

**Interfaces:** Consumes page/access/document projections. Produces record mutation commands with revisions, named view configurations, `search(actor, workspaceId, query, filters)`, `backlinks(actor, pageId)` and bounded `graph(actor, workspaceId, center?)`.

- [ ] Write RED tests: invalid typed values rejected; two views read the same edited record; stale field revision rejected; relationships cannot reveal private records; stale projection cannot replace a newer one; search counts/snippets and graph immediately exclude revoked/private content.
- [ ] Run `npm test -- tests/databases.test.ts tests/knowledge.test.ts`; expected RED.
- [ ] Implement database/record ownership and typed fields, server sorting/filtering/pagination and saved table views. Add weighted PostgreSQL text indexes, title trigram fallback, versioned outbox consumption, rebuild operation and permission-filtered links/search.
- [ ] Implement accessible editable TanStack table, search palette, backlinks and an SVG graph with real query results, bounded layout, zoom and page navigation. Lazy-load heavy secondary UI.
- [ ] Run focused tests and `npm test`; expected PASS. Measure a documented search corpus and record actual budgets rather than fabricate performance claims. Commit with `feat: connect structured data and knowledge discovery`.

### Task 6: Transfer, settings, and beta completeness

**Files:** Transfer service/routes, settings/membership dialogs, README, development scripts, `tests/transfer.test.ts` and complete e2e flows.

**Interfaces:** Consumes all owning services. Produces versioned workspace ZIP import/export with stable remapping and bounded reports; account/workspace/invitation/role settings; startup and restore instructions.

- [ ] Write RED tests: archive round trip retains attachments and internal links; import remaps IDs without overwriting another workspace; malformed/version-mismatched or excessive archives fail safely; unauthorized exports denied; invitation recipients/expiry and last-owner protections hold.
- [ ] Run `npm test -- tests/transfer.test.ts`; expected RED.
- [ ] Implement bounded import/export, resumable per-batch reports, invitation acceptance and local email outbox, settings, logout cache cleanup and transparent beta entitlements. Document development adapters and production prerequisites; do not add fake billing controls.
- [ ] Run complete E2E flows for auth, pages, collaboration, capture, table editing, search/graph navigation, transfer and membership change. Expected real state changes and durable reloads.
- [ ] Run `npm test`; expected PASS. Commit with `feat: complete collaborative workspace beta workflows`.

### Task 7: Visual fidelity, accessibility, and release verification

**Files:** Focused fixes to owning modules, `apps/web/src/styles.css`, browser tests, durable verification notes, README.

**Interfaces:** Consumes every beta workflow and the generated concept inventory; produces a verified local application with documented evidence and explicit remaining launch requirements.

- [ ] For observed bugs, write a reproduction test and observe RED before the fix; do not add tests mirroring CSS or prose.
- [ ] Verify using the Browser/IAB path first; if unavailable/unreliable, record the reason and use Playwright. Inspect at concept-native dimensions plus 360px mobile. Check console, nonblank content, identity, responsive overflow, keyboard focus, dialogs, and all primary controls.
- [ ] Use `view_image` on the concept and latest browser screenshots. Compare copy, structure, typography/chrome, palette, spacing, borders, icons and media; record at least five points and resolve material drift.
- [ ] Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`. Expected zero compilation errors, passing behavior tests, built web/server output and passing real browser flows. Repeat only for relevant fixes.
- [ ] Request an independent whole-change review with the spec, plan, tests and ledger. Fix material findings with RED→GREEN regression tests and rerun the suite. Record defensible deviations and deferred minor findings.
- [ ] Commit verified changes, mark only proven tasks complete, show the runnable local application and report exact verification results and commercial/native work still outstanding. No merge, remote push, production publish or live billing activation.

## Self-review

Spec sections 1–4 map to staged scope and the delivery constraints. Sections 5–7 map to tasks 1–3; rich capture to task 4; tables/search/graph to task 5; transfer/access/settings to tasks 2 and 6; recovery to task 3; interface/fidelity and acceptance to task 7. Commercial launch readiness and native distribution are recorded follow-up checkpoints rather than silently included in the beta claim. The five Review Focus conditions have explicit owning tests. Shared interfaces use one database gateway, access service and document persistence owner throughout.

## Execution decisions

- The user explicitly approved proceeding to the plan and implementation. Execute inline under executing-plans without another permission request; perform one independent final review.
- Reuse the supplied directory; there is no existing branch or checkout requiring a worktree.
- Local services must be runnable without Docker. PGlite and private filesystem storage are explicit development adapters, not a change to production data ownership.
- Implementation evidence and rulings are recorded in `docs/superpowers/execution-ledger.md`; skill task scripts may keep temporary briefs/logs in their ignored workspace.
