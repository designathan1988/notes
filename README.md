# Note

A collaborative knowledge workspace with rich documents, structured records, indexed search, and connected knowledge. The web beta is the first checkpoint of the approved product design. It is not a live billing launch or a native desktop/mobile release.

## Run locally

Requirements: Node.js 24 LTS and npm. Docker is not required for the local development adapters.

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. The API runs at **http://127.0.0.1:3001**. The frontend proxies API and collaborative WebSocket requests to the backend.

The development sign-in screen provides **Open demo workspace**. Two test identities are seeded for collaboration testing:

| Identity                  | Email              | Development-only password |
| ------------------------- | ------------------ | ------------------------- |
| Jonathan, workspace owner | jonathan@note.test | Note-local-demo-2026      |
| Amelia, workspace editor  | amelia@note.test   | Note-local-demo-2026      |

These are disposable local fixture credentials. Production mode does not run the seed routines or render the development demo button.

## What the beta does

- Real account sessions, shared workspaces, owner/admin/editor/viewer roles, recipient-bound invitations, and email verification through a local development inbox.
- Pages and nested subpages with stable IDs, cycle-safe moves, private roots with inherited access, favorites, and recoverable branch trash/restore.
- Concurrent Tiptap/Yjs document editing, live collaborator cursors, durable database persistence, and explicit **Saving**, **Saved**, **Saved locally**, and **Read only** states.
- Rich paste, Markdown and JSON/code handling, document tables, checklists, links, attachments, image/audio/video playback, and controlled video embeds. Unsupported rich elements retain their available original source in a downloadable attachment.
- Typed database records, editable tables, filtered/sorted named views, record-page navigation, and inline views of the same records.
- PostgreSQL full-text search and title similarity, access-filtered snippets, backlinks, a navigable graph, and rebuildable versioned projections.
- Spatial canvas foundations: rich notes, owned media, authorized page references, grouping, labeled connections, drag/resize, undo and scoped pan/zoom. The canvas acceptance work below is still in progress.
- Versioned ZIP export/import containing JSON, structured records, links, and available media bytes. Imports use new IDs, bounded batches, durable progress, and resumable staged source files. Plain text Markdown export is also available with stated fidelity limits.
- Responsive navigation and editing controls, semantic forms/dialogs, keyboard navigation, and reduced-motion support.

## Architecture

```text
apps/web           React application, capability UI, one Zustand store, one authored styles.css
apps/server        Fastify composition and capability-owned server services
packages/contracts Shared identifiers, read models, limits, validation, and error vocabulary
packages/editor    One rich-document schema and projection/import helpers
tests              Database-backed behavior tests
e2e                Isolated multi-context browser workflows
docs               Approved design, research, plan, visual concepts, and execution evidence
```

The server owns authorization and business invariants. UI controls call commands; they do not write the database directly. The client store composes capability-owned state slices. A document session owns its Yjs document and local recovery; the application store holds status and derived metadata, not another writable copy of its body.

Relational metadata and records have revisions. Yjs updates/snapshots are the document authority; JSON is interchange and rendering data. Durable acknowledgements include Yjs snapshot coverage, including deletion sets, and are sent after database transactions commit. Search, graph edges, and backlinks are derived projections with monotonically increasing revisions. Current permissions filter every read, independent of index freshness.

Canvas pages use the same document session and persistence owners: `doc → canvasRoot → canvasCard / canvasGroup / canvasEdge`. Rich children and spatial attributes live in that single shared fragment. Camera preferences belong to the existing scoped workbench owner. Batched linked-page titles are authorized read projections, separate from user-authored reference labels.

## Local persistence and recovery

Ignored `.runtime/` contains:

- `postgres/`: disk-backed PGlite, an embedded PostgreSQL engine for portable development.
- `attachments/`: private attachment bytes and incomplete import staging objects.
- `mail/`: local verification/invitation messages. No external email is sent by the development transport.
- `auth-secret`: a locally generated persistent session-signing secret.

Browser IndexedDB stores document recovery data partitioned by identity, workspace, page, and generation. Logout refuses to erase unsynchronized drafts, including documents that are no longer open. Settings → Data → Download local drafts exports structured JSON and exact collaborative recovery data without needing the network. This recovery archive is separate from Workspace ZIP import and does not contain media bytes. After synchronization, logout clears the active identity's recovery cache. Local recovery is not a backup against device loss or cleared browser storage. Initial account/workspace loading, structural commands, and new uploads need the server; this is not a fully offline workspace.

The documents service records recovery checkpoints at most once per ten-minute interval during writes. Workspace ZIP exports are the user-facing full-content backup. For an operator-level local backup, stop the server and copy the entire `.runtime/` directory together; restore the directory before restarting. External PostgreSQL/object storage requires a coordinated database and object-version backup procedure before commercial launch.

## Development limits

Use Canvases → New canvas, or the New canvas command, to open a spatial page directly. The current foundation has browser coverage for editing, durable geometry, grouping/connections, independent duplication, undo, scoped keyboard selection, mobile content-started pinch/scroll and cancellation. Concurrent canvas topology changes, offline/revocation edge cases, remaining scene controls and preview/capture paths, portable JSON Canvas interchange and whole-product acceptance remain unfinished. Native workspace ZIP already retains canvas content and media; it is not JSON Canvas interchange.

Templates are available from the sidebar and command palette. Page actions → Save as template copies a page, database or record into the library; New template opens a blank definition directly for writing. Definitions use the normal editor and keep their own subpages and media. Use template creates a separate private page tree or database immediately and focuses its title. Internal references remap; links to external pages and databases stay connected. Editing a linked external database still changes that existing database.

Record templates create records in their original database and follow its access settings. They keep starting values outside its live records; property definitions come from that database. Changed or archived properties can make a saved default invalid; the application keeps that value for review and requires an explicit reset before use. Workspace ZIP carries template definitions, media and defaults.

Copying waits for pending page, record and document writes. A closed source with unsynchronized local text must be reopened and synchronized first. An unknown copy result is retained in Templates → Check your recent copies for the current account, workspace and browser window. Retry uses the same request identity; a confirmed copy with a later opening failure is not offered as an unconfirmed creation.

Files: 25 MiB each. Document state: 4 MiB. ZIP input: 64 MiB compressed, 128 MiB expanded, at most 5,000 pages and 1,000 exported attachments. Imports process up to 50 metadata/document records or one attachment per batch. A workspace may have up to three unfinished imports. The beta attachment allowance is 1 GiB per workspace. These engineering safeguards are not commercial plan pricing.

A single template/copy operation supports up to 200 owned pages, 16 MiB of structured content and 500 files totaling 64 MiB. These bounded operations do not impose a stored page-hierarchy depth rule.

Page storage has no fixed hierarchy-depth rule. Navigation responses and graph queries are bounded; global indexed search can open a page outside the initial navigation window. The graph renders bounded node/edge sets rather than loading an unlimited workspace into the browser.

Pasted web applications cannot be cloned by the clipboard. Their scripts do not execute in Note. Remote media bytes absent from the clipboard cannot be guaranteed recoverable: keep the available original source and upload the media file when needed. Controlled external embeds still depend on their providers being reachable.

## Verify

```powershell
npm run typecheck
npm test
npm exec playwright -- install chromium
npm run test:e2e
npm run build
```

Browser tests cover pointer-only block dragging, page-tree dragging, durable reorder, block transformations, root creation, inline editable databases, table row/column operations, typed records and relation selection, sorting/filtering/saved views/columns, favorites, trash restoration, rapid metadata edits, retry states, mobile keyboard focus, two-identity editing, rich-paste safety and source preservation, exact uploaded bytes, body search, graph navigation, ZIP transfer, verified invitation acceptance, live access revocation, disconnected recovery, and offline recovery export. Behavior tests use an actual PostgreSQL engine rather than a mocked persistence layer.

The current continuous-block document interface and visual evidence are documented in `docs/design/verification.md`. The user rejected the early separated-paragraph-card directions. Ordinary documents retain continuous Notion-style blocks; the separate spatial canvas intentionally contains movable cards. The newer canvas concept is an implementation reference selected by the developer, not a user-approved final design. Current canvas decisions and remaining acceptance are recorded in `docs/superpowers/plans/2026-11-08-application-workbench.md`.

## Before commercial launch

The approved next checkpoint includes payment-provider test integration, verified subscription events and server entitlements, pricing/currency decisions, production email transport, production hosting, operational monitoring, load testing, coordinated backup/restore drills, dependency/license checks, and current product/legal copy. This beta intentionally provides no fake checkout or payment-success state.

Production configuration requires an external `DATABASE_URL`, a strong `AUTH_SECRET`, the public `APP_ORIGIN`, and private S3-compatible storage (`S3_BUCKET`, region/endpoint as appropriate, and credentials through the AWS SDK's normal environment/identity chain). Local adapters are rejected for production storage. Production invitation delivery is disabled until a real email transport is connected.

Desktop and mobile containers are the subsequent checkpoint. Shared contracts/editor code and the storage/network boundaries are reusable; device-specific UX, native storage/share integration, packaging, signing, and device testing remain separate work.
