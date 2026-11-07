# Note: collaborative knowledge workspace

Date: 2026-11-07
Status: approved by the user on 2026-11-07; implementation planning in progress.
Working product name: Note.

## 1. Intent and confirmed decisions

Create a commercial knowledge application that brings rich capture, structured information, and linked knowledge into one coherent workspace. Start with a real web application, then reuse its domain model and application contracts for desktop and mobile.

The user requires nested pages, rich paste, code and media, structured databases with data tables, JSON interoperability, indexed search, backlinks and a knowledge graph, a modern responsive interface, and clear architectural ownership. The product will support multiple people, including simultaneous editing. Code, documentation, and interface copy are English; chat communication is Brazilian Portuguese.

The user selected a vendor-hosted SaaS with online collaboration and local recovery of changes. Full offline operation and customer-hosted distribution are not initial-release requirements.

This document proposes implementation defaults where the user delegated technical judgment. Approval of this document accepts those defaults and the delivery checkpoints below. It does not claim that research, a prototype, or a feature checklist establishes superiority over mature products.

## 2. Approaches considered

| Approach | Benefit | Tradeoff | Decision |
| --- | --- | --- | --- |
| Hosted SaaS with online collaboration and local recovery | One operated service, shared workspaces, a practical web launch, room for native clients | Requires service operations; recovery is narrower than complete offline use | Selected by the user |
| Hosted SaaS with complete local-first operation | Offline availability and reconciliation across devices | Larger scope for replication, media availability, structural conflicts, and revoked access | Preserve extension points; defer full guarantees |
| Licensed customer-hosted deployments | Customer-operated infrastructure and storage | More deployment variants, upgrades, licensing, and support work | Defer |

## 3. Goals, exclusions, and anti-goals

### Goals

- Capture supported content without silent loss, and preserve recoverable originals when conversion is unsupported.
- Edit together, persist accepted changes durably, and distinguish local recovery from server-confirmed saving.
- Organize pages at arbitrary practical depth; move and rename them without breaking identity-based links.
- Treat tables, backlinks, search, and graph navigation as views or projections of authoritative content.
- Provide typed records, sorting, filtering, and editable data tables.
- Enforce workspace isolation and explicit permissions on the server.
- Make export, restore, accessibility, error handling, and maintainability part of delivery.

### Initial exclusions

Full offline workspace operation; native installers; handwriting and pen input; an unrestricted OneNote-style spatial canvas; a Coda-compatible formula language or automation marketplace; arbitrary executable pasted scripts; external-source web clipping services; OCR and transcription; semantic AI search; public publishing; enterprise SSO; and customer-hosted deployment. These remain possible subsequent capabilities, not hidden promises of the initial release.

### Anti-goals

A screenshot-only application; fake collaboration or saved indicators; storing production data only in browser storage; independent copies of the same document in several stores; microservices without an operational need; a giant application component; an entire feature forced into one giant file; or a large abstraction framework built before a working user flow.

## 4. Delivery checkpoints

### A. Usable collaborative web beta

Deliver a runnable frontend and backend with account/session handling, workspaces and roles, invitation acceptance, nested page CRUD and trash, collaborative rich editing, local draft recovery, durable attachments, structured databases and table views, indexed search, internal links/backlinks, a navigable graph, export/import, and responsive accessible workflows. Run multi-session and cross-workspace verification against real persistence.

Development uses reproducible local services and test identities. Development email goes to a local mail inbox; production email delivery is connected before inviting actual customers. A UI preview may be available earlier, but is not completion of this checkpoint.

### B. Commercial launch readiness

Complete subscription checkout and customer billing management in a payment provider's test environment; signed, idempotent billing events; server-enforced entitlements; usage limits; verified production email; production deployment configuration; monitoring; backup/restore drills; and release checks. Real prices, currency, payment provider, legal copy, and production destination are founder decisions before enabling live sales. They do not block building checkpoint A, and the product must not be called sale-ready before B.

### C. Platform expansion

Introduce desktop and mobile containers after web workflows stabilize. Reuse contracts, schema, commands, editor extensions, and synchronization logic; add native storage/filesystem/share integrations through adapters. Native builds need their own device testing and packaging work.

## 5. Proposed technical baseline

These are engineering recommendations, not framework choices the user explicitly named:

- TypeScript throughout; React with Vite for the web client.
- A modular Node.js backend using Fastify; Hocuspocus for Yjs document synchronization. Keep these in one deployable backend initially, with explicit lifecycle boundaries.
- PostgreSQL for relational metadata, permissions, structured records, collaborative persistence, and search. Use migrations and typed database access; choose the concrete query/migration library during planning after checking integration compatibility.
- Better Auth for identity/session mechanics and organization invitations; the application's access module remains the only authority for content permissions. Map its organization identity to the workspace identity instead of maintaining duplicate memberships.
- Tiptap/ProseMirror for schema-based rich editing, with Yjs as the collaborative document model.
- One Zustand application store, composed of capability-owned slices, with commands and selectors. No second general-purpose application state library.
- TanStack Table for table behavior. It does not own records or provide an alternative write path.
- S3-compatible private object storage for attachment bytes; PostgreSQL owns attachment metadata and lifecycle.
- IndexedDB through a recovery adapter for local document updates and explicitly recoverable input. Browser storage is not the production backup.
- One authored CSS entry point using layers for tokens, base, layout, components, utilities, and responsive/accessibility rules.
- Vitest for focused logic tests; backend integration tests against PostgreSQL; browser verification and multi-context end-to-end tests. Lock compatible dependency versions during planning/implementation rather than assuming versions from this document.

No paid provider account, live payment, email to another person, or production deployment is authorized by this design document alone. Normal local implementation and testing proceed after design approval.

## 6. Architecture and ownership

Use a small workspace repository with `apps/web`, `apps/server`, and shared `packages/contracts` and `packages/editor`. Add packages only when there is a real consumer boundary. Keep features cohesive within their owning application/module; the frontend and backend are separate trust boundaries, not duplicate business-rule owners.

| Capability | Sole rule/write owner | Consumers |
| --- | --- | --- |
| Identity and sessions | Identity module integrating Better Auth | API and collaboration authentication |
| Membership and content authorization | Access module | Every resource boundary, workers, search, media |
| Page hierarchy and metadata | Pages module | Navigation, breadcrumbs, editor header |
| Collaborative page body | Documents module and its Yjs persistence pipeline | Editor, export, projection workers |
| Capture and attachments | Capture module for conversion; attachments module for binary lifecycle | Paste, upload, document nodes |
| Database schemas, records, and view configuration | Databases module | Table UI, record pages, export |
| Search projection and query ranking | Search module | Search UI and command navigation |
| Link projection and neighborhood queries | Knowledge module | Backlinks and graph |
| Subscription and usage policy | Billing module | Server entitlement checks and usage UI |
| Client application state | One application store | Focused UI selectors and application commands |

Shared contracts define identifiers, command payloads, response schemas, revisions, and error codes. Runtime validation and types come from the same definitions where feasible. Authorization and invariants are server rules, even when client validation improves feedback.

UI components call application commands rather than repositories. Server routes and collaboration handlers delegate to owning modules. Cross-module communication uses explicit services and a transactional outbox for asynchronous projections. Avoid an unrestricted event bus and avoid passing entire stores into every component.

## 7. Data authority and persistence

### Relational model

Core entities are identities, workspaces, memberships, invitations, pages, database definitions, fields, records, saved views, attachments, document snapshots/updates, link projections, search projections, and outbox jobs. All tenant-owned resources carry a workspace ID; composite keys/constraints prevent references across workspaces. IDs are stable and opaque.

A page owns navigation metadata and one collaborative document identity. A database record uses a page ID as its identity; its typed properties belong only to the databases module. The page body remains a collaborative document. A table row references that record and page rather than copying either. Initial property types: text, number, checkbox, select, multi-select, date, URL, and same-workspace record relation. Formulas, rollups, and additional view families are later work.

Hierarchy clarification, an engineering default added during builder review: every database is a page of kind `database`, with its definition keyed by that page ID. Every record page is a direct child of its owning database page and inherits the database's visibility root. A database may itself be a root or a child of an ordinary page. Records may have ordinary subpages, which inherit the same visibility. A database never aggregates differently owned record pages from unrelated roots in the initial release. Record reordering is allowed; moving a record out of its database, moving it between databases, and converting it to an ordinary page are deferred until explicit conversion rules exist. Moving a database moves its entire subtree atomically under the existing visibility-change policy.

Saved table views initially belong to their database page. Any later embedded/linked views must reference the database and enforce its access; embedding cannot grant access. Relation values may target another permitted same-workspace record, but creating a relation requires access to the target, and reading an inaccessible target returns an unavailable reference without its title or metadata. Table counts, relations, search, graph, and export follow these same visibility boundaries.

### Collaborative document authority

The documents module owns the versioned editor schema, Yjs lifecycle, accepted update persistence, snapshots, and projections. Persist collaborative state as Yjs binary updates/snapshots, not a competing JSON autosave. JSON is a versioned export/rendering projection. Sharing the same schema registry across client, server projection, and import prevents different interpretations.

An update being received or echoed over a WebSocket is not evidence of durable storage. Surface `Saved` only after a persistence acknowledgement covering the client's document state, using a document generation and an acknowledged state vector or equivalent durable protocol. Before that, distinguish `Saving`, `Saved locally`, and failure/retry. Persisted update order and snapshot compaction must not discard concurrent changes.

The client Zustand store holds navigation, UI state, normalized server read models, and operation status. It does not hold a second writable copy of the editor body. A document session owns its Yjs document and exposes commands/status to the application. Editor selection and undo internals remain editor-local. This is one application state strategy with clear specialized ownership.

### Structured writes and events

Page moves and metadata, record values, membership, and billing changes are server-authoritative transactions with revisions and idempotency keys. Concurrent edits to the same non-CRDT field produce an explicit revision conflict rather than an unnoticed overwrite. Accepted mutations and their outbox events commit atomically. Connected clients receive normalized entity revision events; they resync after an event gap. Editor text convergence does not automatically resolve hierarchy or record invariants.

## 8. Core behavior

### Pages and navigation

Create root pages and subpages, rename, move, favorite, move to trash, and restore. Use parent references, cycle checks, deterministic sibling ordering, and lazy tree loading. No fixed application depth limit; rendering and pagination remain bounded. The server serializes conflicting moves so concurrent requests cannot create a cycle. Deleting a branch is a recoverable operation; links to deleted pages show an unavailable state.

### Rich editing and capture

Initial blocks: paragraphs, headings, lists, tasks, quotes, dividers, code with a language identifier, simple document tables, images, audio/video attachments, files, internal links, and controlled embeds. Rich document tables are distinct from structured database views and use different clearly named commands.

Accept text, rich HTML, Markdown, files, and tabular clipboard data through a single capture pipeline. Give code and Markdown explicit paste modes when automatic detection would be ambiguous. Preserve available source representations for unsupported conversion using a downloadable original/fallback block and disclose conversion limits. Do not silently discard unsupported nodes. Imported scripts never execute in the application origin; approved external embeds use sandboxed rendering and restricted policies.

Binary attachment flow: create an authorized pending attachment, upload to a private staging key, validate size/type and inspect content according to the deployment policy, then finalize before exposing it as available. Failed or interrupted uploads remain retryable; a temporary blob URL is not a persisted asset. Attachments reference owning resources, so final download authorization uses current page access. Initial configurable engineering limits: 25 MiB per file, bounded document/import payload sizes and batch sizes; these are not proposed commercial plan limits.

### Structured database tables

Create a database and typed fields, add/edit/archive records, open each row's page, filter and sort, configure visible columns, and save named table views. Store view configuration separately from records. Handle empty, loading, conflict, error, and read-only states. Paginate on the server; virtualize rendering when appropriate. Keyboard cell editing must not trap focus or silently discard a rejected value.

### Search and knowledge navigation

Use PostgreSQL weighted full-text indexes for title/body/properties, plus trigram matching for title similarity. Provide phrase queries, snippets, workspace/type/date filters, keyboard navigation, and a visible indexing state. Use a language-neutral text index initially to avoid English-only stop-word assumptions; tune language handling with a multilingual test corpus. Fuzzy title matching is separate from semantic search.

Search and link projections consume durable document revisions and can be rebuilt. Maintain monotonic projection versions so a delayed worker cannot overwrite a newer result. Apply current access policy before exposing titles, snippets, facets, counts, graph nodes, or edges. Revocation cannot wait for an indexing job. Deleted/private content is excluded according to current relational access state even if its text remains in a stale index.

Internal links store target IDs and optional display labels. Backlinks derive from resolved link nodes in the authoritative document. The graph is a bounded neighborhood/workspace query with zoom, selection, and open-page navigation; do not load an unlimited workspace into a force simulation. Graph positions are presentation state, not knowledge relationships.

### Export and import

Export a versioned ZIP package with JSON manifests, document projections, record schemas/values, and referenced attachment bytes. Allow Markdown export as a lower-fidelity convenience format with stated losses. Import validates versions and bounds, remaps IDs consistently, rewrites internal links, and preserves unsupported blocks. Import is transactional per bounded batch with a resumable report; do not imply all-or-nothing atomicity for a very large workspace and object storage together.

## 9. Access and commercial boundaries

Initial workspace roles: owner, admin, editor, viewer. Only owners manage ownership, destructive workspace operations, and billing; owners/admins manage membership; editors modify permitted content; viewers read only. Prevent removal of the final owner. Invitations are expiring, single-use, and bound to verified recipient identity.

Initial page visibility is `workspace` or `private`. A root establishes visibility inherited by its subtree; a child cannot broaden access independently. Private roots are visible to their creator only, including in search and graph; administrators do not silently receive private-content access. Moving between visibility roots requires an explicit access-change confirmation and server authorization for both locations. Fine-grained per-page external guests and public links are deferred.

Check authorization on every API command, collaboration open/update, attachment access, import/export, and worker action. Membership/visibility changes invalidate affected collaboration sessions and server authorization caches. PostgreSQL row policies may add defense in depth; the production role must not accidentally bypass the intended policies. No token granting raw storage access belongs in browser bundles.

Recovery is partitioned by identity/workspace/document generation. Logout clears accessible local caches and in-memory sessions; explicit recovery exports contain user data and require deliberate handling. Revoked users cannot push queued changes, and the UI must not claim such changes were accepted. Recovery copies from removed access are quarantined rather than reattached to an unauthorized session.

Subscription and usage ownership belongs to the billing module. The beta uses an explicit server-side beta entitlement. The commercial launch replaces that with provider-verified subscriptions and idempotent entitlement transitions; it must never trust a client-side success redirect as proof of payment. Pricing and live commercial activation remain separate founder decisions.

## 10. Recovery and availability

Cache recoverable document updates locally while the user edits an already accessible document. Restore after a reload and reconnect against the current generation and permission state. Structural mutations and new uploads require the server in the initial release; disable them clearly offline rather than imply a fully functional offline workspace.

Unsynced local text can be exported if replay is blocked by a document migration/deletion or permission change, subject to the current local-data policy. Browser quota failures and unavailable IndexedDB produce explicit degraded-recovery status. Do not promise protection against device loss, cleared browser data, or private-browsing eviction.

Persist server updates and snapshot generations durably; keep trash retention and version-history policies explicit. Initial beta proposal: 30-day trash, periodic document recovery checkpoints, and deployment-managed database/object backups. A restore drill must reconcile database references and object versions before launch. Retention duration and storage limits remain configurable until commercial plans are decided.

## 11. Interface and design process

Build the actual workspace application. Its required surfaces are page navigation, editor and formatting/capture controls, database tables and record details, search, backlinks/graph, membership/settings, and all material loading/error/permission states. These are functional requirements, not a pre-approved visual arrangement.

After this technical design is approved, use frontend-app-builder and Image Gen to produce the complete primary workspace concept plus readable table/graph details and mobile continuation as needed. Derive tokens, typography, icon rules, copy, component families, and responsive behavior before product code. No visual concept has been generated or accepted yet.

Maintain one authored stylesheet, semantic markup, visible focus, reduced-motion support, accessible dialogs and tables, sufficient contrast, and a usable narrow layout. Mobile adapts navigation and document tools instead of shrinking the full desktop chrome. Verify at a 360px narrow viewport and representative tablet/desktop dimensions; exact screenshot dimensions come from the generated concept.

## 12. Verification and acceptance

The beta is accepted only when these run against real service persistence:

1. Two independent signed-in browser contexts edit one page concurrently, converge, reconnect, and survive a backend restart with the accepted content intact.
2. A second workspace cannot retrieve the first workspace's pages, updates, attachments, search snippets/counts, exports, or graph connections. Role revocation during an open editing session rejects new writes.
3. Saved indicators correspond to acknowledged durable state; dropped connections, failed storage, unavailable IndexedDB, and quota errors surface honest states and preserve recoverable input.
4. Create/move a deeply nested branch, reject concurrent cycle-producing moves, rename linked pages, trash/restore them, and verify stable links and visibility inheritance.
5. Paste a documented fixture corpus covering rich text, HTML tables, Markdown, code, images, files, unsupported nodes, and untrusted embeds; reload/export/import and compare preserved data and declared fallback behavior.
6. Edit a record through two table views; verify one value source, server validation, revision conflicts, pagination, and keyboard usability.
7. Rebuild search/backlink projections, deliver projection jobs out of order, and verify newest-version output and immediate permission filtering.
8. Export/import a workspace package including media, records, and internal links; verify remapping, bounds, failures, and resumability.
9. Complete core workflows with keyboard and narrow touch layouts, inspect browser errors, and run type/lint/build checks.
10. Compare Image Gen concepts and latest rendered screenshots using view_image on both, record at least five concrete fidelity checks and the copy diff, and fix material mismatches.

Performance targets are provisional engineering budgets, not advertised guarantees: measure search p95 under 300ms on a documented 10,000-page text corpus and reference machine, and verify responsive editing with representative large documents and concurrent clients. Keep a relevance fixture set with expected title/body matches. Record actual measurements and bottlenecks before making product claims.

Commercial launch additionally requires test-mode billing lifecycle verification, current licensing review, production credential boundaries, monitoring, usage enforcement, and a demonstrated backup restore.

## 13. Builder discretion and deferred founder decisions

The builder may choose exact compatible dependency versions, query/migration tooling, internal filenames, accessible UI primitives, test fixtures, cursor/presence details, graph layout library, and bounded resource defaults. Use restrained modules and prefer established dependencies to bespoke infrastructure.

Founder decisions deferred until their release checkpoint: final brand, customer positioning, prices/currency, billing provider, production host, sender domain, legal copy, and live commercial activation. None should be invented as a user-approved fact. If a real implementation constraint changes the accepted scope or data guarantees, surface it before substituting a different behavior.

## 14. Research references

- [Initial research and reference-product analysis](../../research/2026-11-07-knowledge-workspace.md).
- [Tiptap persistence](https://tiptap.dev/docs/editor/core-concepts/persistence) and [schema handling](https://tiptap.dev/docs/editor/core-concepts/schema): JSON projections and supported content need an explicit schema strategy.
- [Yjs updates](https://docs.yjs.dev/api/document-updates) and [offline persistence](https://docs.yjs.dev/getting-started/allowing-offline-editing): collaborative updates and local recovery mechanisms.
- [Hocuspocus hooks](https://tiptap.dev/docs/hocuspocus/server/hooks): authentication, update interception, and persistence lifecycle integration.
- [PostgreSQL search](https://www.postgresql.org/docs/current/textsearch-controls.html), [trigrams](https://www.postgresql.org/docs/current/pgtrgm.html), and [row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html): search and isolation mechanisms, not automatic product guarantees.
- [Better Auth organizations](https://better-auth.com/docs/plugins/organization), [Zustand store](https://zustand.docs.pmnd.rs/reference/apis/create-store), [Fastify validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/), and [TanStack Table](https://tanstack.com/table/v8/docs/overview): baseline implementation candidates.

## Approval record

- Operating model: selected by the user.
- Technical defaults and phased scope: proposed in this document.
- Builder review: completed. The reviewer identified one planning ambiguity: how database records fit into page hierarchy and visibility. Resolved with the explicit database-page ownership and inherited-visibility rule above; this is an engineering default proposed for user approval. The reviewer checked the clarification and reported "nothing important left".
- User design approval: approved on 2026-11-07, including the sequence of deliveries; the user explicitly authorized proceeding to the plan and implementation.
- Visual concepts and implementation plan: not started.
- Git commit: pending repository initialization after design approval; the supplied workspace did not contain a Git repository.
