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

| Identity | Email | Development-only password |
| --- | --- | --- |
| Jonathan, workspace owner | jonathan@note.test | Note-local-demo-2026 |
| Amelia, workspace editor | amelia@note.test | Note-local-demo-2026 |

These are disposable local fixture credentials. Production mode does not run the seed routines or render the development demo button.

## What the beta does

- Real account sessions, shared workspaces, owner/admin/editor/viewer roles, recipient-bound invitations, and email verification through a local development inbox.
- Pages and nested subpages with stable IDs, cycle-safe moves, private roots with inherited access, favorites, and recoverable branch trash/restore.
- Concurrent Tiptap/Yjs document editing, live collaborator cursors, durable database persistence, and explicit **Saving**, **Saved**, **Saved locally**, and **Read only** states.
- Rich paste, Markdown and JSON/code handling, document tables, checklists, links, attachments, image/audio/video playback, and controlled video embeds. Unsupported rich elements retain their available original source in a downloadable attachment.
- Typed database records, editable tables, filtered/sorted named views, record-page navigation, and inline views of the same records.
- PostgreSQL full-text search and title similarity, access-filtered snippets, backlinks, a navigable graph, and rebuildable versioned projections.
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

## Local persistence and recovery

Ignored `.runtime/` contains:

- `postgres/`: disk-backed PGlite, an embedded PostgreSQL engine for portable development.
- `attachments/`: private attachment bytes and incomplete import staging objects.
- `mail/`: local verification/invitation messages. No external email is sent by the development transport.
- `auth-secret`: a locally generated persistent session-signing secret.

Browser IndexedDB stores document recovery data partitioned by identity, workspace, page, and generation. Logout clears the active identity's accessible recovery cache. Local recovery is not a backup against device loss or cleared browser storage. Initial account/workspace loading, structural commands, and new uploads need the server; this is not a fully offline workspace.

The documents service records recovery checkpoints at most once per ten-minute interval during writes. Workspace ZIP exports are the user-facing full-content backup. For an operator-level local backup, stop the server and copy the entire `.runtime/` directory together; restore the directory before restarting. External PostgreSQL/object storage requires a coordinated database and object-version backup procedure before commercial launch.

## Development limits

Files: 25 MiB each. Document state: 4 MiB. ZIP input: 64 MiB compressed, 128 MiB expanded, at most 5,000 pages and 1,000 exported attachments. Imports process up to 50 metadata/document records or one attachment per batch. A workspace may have up to three unfinished imports. The beta attachment allowance is 1 GiB per workspace. These engineering safeguards are not commercial plan pricing.

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

Browser tests cover two-identity editing, reload persistence, rich-paste safety and source preservation, exact uploaded bytes, record editing, body search, graph navigation, ZIP transfer, verified invitation acceptance, live access revocation, and disconnected-edit recovery. Behavior tests use an actual PostgreSQL engine rather than a mocked persistence layer.

The visual references are in `docs/design/concepts/`; their tokens, copy inventory, and fidelity evidence are in `docs/design/visual-system.md`.

## Before commercial launch

The approved next checkpoint includes payment-provider test integration, verified subscription events and server entitlements, pricing/currency decisions, production email transport, production hosting, operational monitoring, load testing, coordinated backup/restore drills, dependency/license checks, and current product/legal copy. This beta intentionally provides no fake checkout or payment-success state.

Production configuration requires an external `DATABASE_URL`, a strong `AUTH_SECRET`, the public `APP_ORIGIN`, and private S3-compatible storage (`S3_BUCKET`, region/endpoint as appropriate, and credentials through the AWS SDK's normal environment/identity chain). Local adapters are rejected for production storage. Production invitation delivery is disabled until a real email transport is connected.

Desktop and mobile containers are the subsequent checkpoint. Shared contracts/editor code and the storage/network boundaries are reusable; device-specific UX, native storage/share integration, packaging, signing, and device testing remain separate work.
