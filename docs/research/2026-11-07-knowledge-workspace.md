# Knowledge workspace: initial research

Date: 2026-11-07
Status: operating model selected; proposed technical design reviewed and awaiting user approval; implementation not started.

## Product intent

Build an English-language knowledge application, starting with the web, with a reusable foundation for desktop and mobile. The requested capabilities include rich content capture, nested pages, structured databases and editable table views, indexed search, linked knowledge, and a polished responsive interface.

The objective of exceeding established products must become testable workflows and quality criteria. A feature list alone cannot establish that the product is better than Notion, OneNote, Coda, or Obsidian.

### Confirmed clarification

The user confirmed that the product will support multiple people and will be sold commercially. Chat communication is Brazilian Portuguese; project code, documentation, and interface content remain English. Simultaneous collaboration is part of the design scope. The user selected vendor-hosted SaaS with online collaboration and local recovery of changes. Subscription pricing and customer positioning remain undecided. Full offline operation is not the initial operating model.

## Workspace findings

- The supplied directory is empty.
- There is no existing application, dependency manifest, Git repository, or applicable AGENTS.md in the inspected workspace and ancestor paths.
- No product code or dependencies have been created.

## Interpreting the architectural requirements

These are proposed interpretations, not approved technology decisions:

- **One source of truth:** each document, record, attachment, and relationship has a stable identity and one authoritative representation. Search indexes, backlinks, graph layouts, and table views are rebuildable projections rather than independently editable copies.
- **One owner:** a capability has one public API and one module responsible for its mutations and invariants. A feature may contain a model, commands, adapters, and focused UI components; forcing all of it into one file would create the god files the request rejects.
- **One state management strategy:** one application state boundary with explicit commands and selectors. Editor cursor/selection, transient component interaction, and persisted domain data have distinct lifecycles. Do not maintain competing writable document copies in a global store and an editor or CRDT.
- **Cohesion:** organize around capabilities, with a small shared domain. UI components do not bypass commands to write storage directly. Avoid speculative abstractions and dozens of files that merely forward calls.
- **One authored CSS entry point:** tokens, base rules, layout, components, utilities, responsive rules, and accessibility rules can use named CSS layers within one stylesheet. Feature logic remains outside styling. Third-party editor styles must be accounted for explicitly.
- **JSON:** use versioned, validated structures for interchange and document schemas where appropriate. JSON export is not a database, and large media should use binary attachment storage with references from documents. If CRDTs are chosen, their persisted updates are authoritative and JSON becomes an export/projection.
- **Nested pages:** support arbitrary practical depth through parent references, lazy navigation, and cycle prevention. Do not promise literally infinite storage, rendering, or recursion.

## Lessons from the reference products

| Reference | Useful principle | Proposed product consequence |
| --- | --- | --- |
| Notion | Database pages can have multiple filtered, sorted views | Editing a record in a table should update the same record shown elsewhere |
| Coda | Connected views reflect changes to their base table | Views hold presentation configuration, not duplicated row data |
| OneNote | Capture combines text, files, images, and other media | Attachments and rich capture need a real lifecycle, not temporary preview URLs |
| Obsidian | Internal links underpin backlinks and graph navigation | The graph should derive from the same resolvable page links used by the editor |

Sources: [Notion database views](https://www.notion.com/help/views-filters-and-sorts), [Coda connected views](https://help.coda.io/hc/en-us/articles/39555897467021-Create-connected-table-views), [OneNote basic tasks](https://support.microsoft.com/en-us/onenote/onenote-help-and-learning/basic-tasks-in-onenote-on-windows), [Obsidian backlinks](https://obsidian.md/help/plugins/backlinks), [Obsidian graph](https://obsidian.md/help/plugins/graph).

## Editor and capture research

Tiptap is a candidate rather than a final choice. Its documentation recommends JSON persistence for flexibility. Its strict schema can remove unsupported pasted elements and attributes. That makes an editor-only paste handler insufficient for the preservation requirement.

Proposed capture policy:

1. Inspect available clipboard representations and files.
2. Preserve supported text, formatting, lists, tables, code, and media as typed content.
3. Store binary attachments durably; document nodes reference attachment IDs.
4. Preserve unsupported source material as a recoverable attachment or explicit fallback instead of silently dropping it.
5. Treat imported HTML and interactive embeds as untrusted content; use controlled rendering and sandbox boundaries rather than executing pasted scripts inside the application.
6. Report fidelity limits, processing status, missing external assets, and persistence failures visibly.

Browser clipboard access depends on the available data formats, browser behavior, secure contexts, and user activation. Copying a web page cannot guarantee that its original application logic, private assets, or every interactive behavior can be reproduced. Preserve available source material and provide supported interactive block types.

Sources: [Tiptap persistence](https://tiptap.dev/docs/editor/core-concepts/persistence), [Tiptap schema and invalid content](https://tiptap.dev/docs/editor/core-concepts/schema), [MDN Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API), [W3C Clipboard API](https://www.w3.org/TR/clipboard-apis/).

## Storage, search, and cross-platform research

- Yjs supports IndexedDB persistence through a provider and can combine it with network providers. It is a candidate if local editing and concurrent synchronization are part of the chosen architecture. Persisting documents offline does not by itself make the application shell available offline; that also requires an asset caching strategy.
- SQLite FTS5 supports ranked full-text search, phrases, prefix indexes, Boolean and proximity queries, and tokenizer options. It is a candidate for search behind a platform adapter; selecting a browser SQLite runtime requires a separate feasibility check. Fuzzy typo matching and semantic retrieval must not be claimed merely because FTS5 is installed.
- TanStack Table provides framework-agnostic table logic without prescribing markup or styling. Virtualization requires a separate rendering integration. It is a candidate for editable, accessible, styled views of domain records.
- Capacitor can reuse a web application within native mobile containers and expose native capabilities through adapters. Native integration, platform-specific UX, device storage, signing, and distribution remain real follow-up work.
- A desktop container must be selected after reviewing filesystem, attachment, security, and packaging requirements. No desktop framework has been selected.

Sources: [Yjs offline support](https://docs.yjs.dev/getting-started/allowing-offline-editing), [SQLite FTS5](https://www.sqlite.org/fts5.html), [TanStack Table](https://tanstack.com/table/v8/docs/overview), [TanStack virtualization](https://tanstack.com/table/latest/docs/framework/react/guide/virtualization), [Capacitor](https://capacitorjs.com/docs).

## Proposed acceptance scenarios

These are inputs for the design, not claims of implemented functionality:

- Create and edit a page, reload, and recover the exact saved content.
- Paste a representative corpus of rich HTML, Markdown, source code, tables, images, and unsupported content; inspect round trips and verify that fallbacks preserve available source material.
- Create deeply nested pages, move a branch, prevent cycles, and retain stable links.
- Edit a database record through one view and observe the same value in every other view.
- Find content by title and body with ranked results, snippets, filters, and keyboard navigation; measure latency against a documented corpus and device.
- Create, rename, move, and delete linked pages; verify graph and backlink consistency and index recovery.
- Recover from failed saves, interrupted attachment writes, quota errors, and application reloads without misleading saved indicators.
- Export and reimport the documented interchange format, including attachments.
- Complete the main workflow using a keyboard and a narrow touchscreen layout.
- If collaboration is selected, test concurrent edits, offline reconnection, authorization, and schema compatibility.

## Commercial collaboration implications

The following are proposed requirements derived from the commercial multi-user scope:

- A workspace is the customer-data isolation boundary. Membership and explicit roles govern access; billing accounts and identities are separate concepts.
- Check authorization on API requests, collaboration connections and updates, attachment access, exports, search results, and background work. A workspace ID supplied by a client is not authorization.
- Page-level sharing and inherited permissions need an explicit policy. Revocation must cover existing collaboration sessions and new fetches. Previously downloaded content cannot simply be erased from an offline device by a server-side permission change.
- Persist collaborative editor updates through one document authority. Do not run a second JSON autosave writer against the same document. JSON exports, search documents, and backlinks are derived projections.
- CRDT convergence does not enforce business rules: page moves, membership, entitlements, and structured-record invariants still need authoritative validation and transactions.
- Commercial readiness includes invitation lifecycle, account recovery, durable media, recoverable deletion, backups with tested restore, schema migrations, observable save failures, and measured usage limits. Billing must have one owner for plan entitlements; UI visibility alone cannot enforce a paid feature.
- Audit dependencies and extension licenses before choosing them for distribution. No provider purchase, paid service, or pricing plan is assumed authorized.
- Test tenant isolation and concurrent editing with independent sessions, including permission changes during a connection, interrupted saves, and reconnects. A single-browser local-state demo does not verify collaboration.

Research basis: Hocuspocus provides authentication hooks, read-only connections, and message interception; these are mechanisms for implementing policy rather than a complete permission system. Yjs documents converge when all updates are received, which is distinct from application-level authorization and invariants. PostgreSQL row security can add a database isolation layer, but table owners and privileged roles can bypass it unless configured appropriately.

Sources: [Hocuspocus hooks](https://tiptap.dev/docs/hocuspocus/server/hooks), [Yjs document updates](https://docs.yjs.dev/api/document-updates), [PostgreSQL row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

## Approaches to discuss

| Approach | Product shape | Main tradeoff |
| --- | --- | --- |
| Hosted collaborative SaaS, online-first with local recovery | The vendor runs the service; customers use accounts and shared workspaces. Collaborative documents can use CRDTs while server transactions govern workspace structure and access. | Best initial path to a commercial web launch; full offline creation, media, search, and structural changes are not automatically guaranteed. |
| Hosted collaborative SaaS, fully local-first | Previously available workspace content and a defined set of operations remain usable offline, then reconcile on reconnect. | Stronger offline independence, with considerably more work on selective replication, attachment availability, authorization changes, and non-text conflicts. |
| Customer-hosted licensed product | Customers operate their own service and storage. | More deployment, upgrade, support, backup, and licensing complexity across customer installations. |

Selected by the user: start with the hosted collaborative SaaS and local recovery. Keep platform adapters and document synchronization boundaries compatible with expanding offline guarantees. This is about release sequencing, not a claim that offline and collaboration are mutually exclusive.

## Open decision

Review and approve the [proposed technical design](../superpowers/specs/2026-11-07-knowledge-workspace-design.md), including engineering defaults and delivery checkpoints. The personal-versus-multi-user question and initial operating model are resolved.

## Workflow checklist

- [x] Read using-superpowers and its Codex adaptation.
- [x] Read brainstorming before implementation.
- [x] Inspect the existing workspace.
- [x] Research reference-product principles and technical candidates in primary documentation.
- [x] Ask the highest-impact unresolved product question.
- [x] Discuss viable approaches and select one with the user.
- [x] Write the design document and perform the builder check required by brainstorming.
- [ ] Obtain approval of the concrete design document.
- [ ] Read writing-plans and prepare the implementation plan.
- [ ] Apply frontend-app-builder and Image Gen to the complete primary interface and necessary responsive states.
- [ ] Implement and verify functionality, persistence, architecture, and design fidelity.
