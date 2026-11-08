# Collaborative web page authoring implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans for inline implementation. The user has explicitly opted out of further questions and approval stops. This supplemental track does not replace unfinished tasks in the application-workbench plan. Keep the existing checkout and make regular local commits; do not push.

**Goal:** Create interactive HTML/CSS/JavaScript components and complete custom web layouts inside knowledge pages, with the same collaboration, recovery and content ownership as ordinary notes.

**Architecture:** Source text lives in the existing ProseMirror/Yjs `default` document, with CodeMirror as an editing view. A separate content-site renderer owns disposable preview revisions and browser isolation; it never owns editable source. Existing Pages, Documents, Attachments, Transfer, History and root Zustand retain their current responsibilities.

**Tech Stack:** Existing React/TypeScript, Tiptap/ProseMirror, Yjs v13, Hocuspocus, Fastify, PostgreSQL and Vitest/Playwright. Add stable CodeMirror 6 language/view packages and an HTML parser only after verifying the integration spike and current package documentation. Lazy-load source editing.

**Spec:** `docs/research/2026-11-08-web-page-authoring.md` (researched implementation direction under autonomous-work authorization, not a claimed user-approved specification).

## Global constraints

- English UI, code and documentation; Brazilian Portuguese chat.
- Neutral application chrome, Inter/system sans-serif, no dominant brand hue. User-authored content can use its own styles.
- One canonical Yjs body; no independently writable HTML/CSS/JS copy in Zustand or React, no new document session and no double collaborative binding.
- Single application stylesheet: `apps/web/src/styles.css`. Authored CSS is document content.
- Never execute authored code in the host DOM or Node.js server. Do not relax the ordinary rich-paste sanitizer.
- Treat current unfinished canvas/whole-product requirements as open. Tests for this feature do not complete them.
- Preserve existing notes on creation/conversion, identity changes, permission changes, failed requests and history restore.

## Review focus

1. An IME composition or remote source update during selection must preserve text and caret, without echo transactions or whole-source replacement.
2. An obsolete preview after navigation, role revocation or source deletion must lose its host connection and media capability; saved source must remain recoverable.
3. HTML parser edge cases, closing script/style text and module imports must preserve source and cannot escape into application markup.
4. Untrusted frame messages, resize floods and runtime errors must not navigate, mutate or exhaust the host's state/log UI.
5. Exported web content must preserve owned media and internal page links without leaking private-page data or depending on expired preview URLs.

## File and ownership map

- `packages/editor/src/web.ts`: source node schema, structural validation and read-only source accessors. Shared by server and client.
- `apps/web/src/web/SourceView.ts`: CodeMirror-to-ProseMirror editing/selection adapter, not a second persistence layer.
- `apps/web/src/web/WebAuthoring.tsx`: coherent editing workspace and source-channel/view controls; delegates runtime lifecycle to Preview.
- `apps/web/src/web/Preview.tsx`: one frame instance, revision/run/stop lifecycle and bounded diagnostics protocol.
- `apps/server/src/web/{service,renderer}.ts`: authorized revision creation versus isolated content delivery. Separate responsibilities within the same capability, with no general app-session access from the renderer.
- Existing schema, richExtensions, page composition, creation commands, projection and transfer owners integrate this capability without duplicating its content.

### Task 1: Verify the canonical source adapter before integration

**Files:** external disposable spike in the session visualization directory; `tests/web-source.test.ts`, `e2e/web-source.spec.ts` for retained behavior once the model is implemented. Inspect installed ProseMirror/Tiptap sources and stable CodeMirror documentation first.

**Interface decision:** One `webSource` text node per language, edited through granular ProseMirror transactions. Local undo delegates to the existing collaborative undo owner. Do not bind `y-codemirror.next` to the same text.

- [x] Build a labelled disposable spike with two independent Yjs replicas of one canonical document and the actual adapter pattern. No product action or public route is exposed by the spike.
- [x] Verify concurrent edits in one channel and different channels, selection mapping during remote changes, local-only undo, browser composition simulation, focused-node removal and read-only transitions. Assert exact source after encoding/reopening the Yjs update. OS-level IME certification remains a product-integration coverage limit.
- [x] Record observed results and compatibility limits. IAB concurrency/undo/round-trip checks and all four automated composition/caret/deletion/read-only cases passed. No product dependencies were added. The transaction bridge remains the selected implementation direction; do not replace it with a snapshot-overwrite or string-attribute approach during integration.

### Task 2: Shared source model and durable round trips

**Files:** create `packages/editor/src/web.ts`; modify `packages/editor/src/schema.ts`; tests `tests/web-source.test.ts`, `tests/documents.test.ts`, `tests/canvas-service.test.ts` as needed for existing invariants.

**Interfaces:** `WebLanguage = 'html' | 'css' | 'javascript'`; `WebSource = Readonly<Record<WebLanguage, string>>`; `webExtensions()`, `readWebSource(node: JSONContent): WebSource`, `createWebContent(source: WebSource, mode: 'component' | 'page'): JSONContent`, `validateWebContent(content: JSONContent): void`. `webRoot` is an exclusive document root child, not a member of the ordinary `block` group. `webComponent` is an isolating block. Both contain exactly one `webSource` text child per language. Use stable component IDs and limits of 512 KiB UTF-8 per channel and 1 MiB total per component; reject duplicate/missing channels and unsupported marks/children.

- [ ] RED: write tests preserving whitespace, Unicode, full HTML documents, `</script>` text, empty channels and source larger than a single line. Reject duplicate languages, malformed roots, mixed full-page/prose roots and oversize content. Observe the failures before implementation.
- [ ] Implement the shared nodes/accessors/validator and extend the existing schema/validateDocument entry point. Keep ordinary/canvas document rules unchanged.
- [ ] Test create/save/load, concurrent Yjs edits, local update recovery, named history/restore and generation validation using the existing document owner. Run focused source/document/canvas tests and typecheck, then commit the independently verified model milestone.

### Task 3: Authorized immutable previews and isolated content delivery

**Files:** create `apps/server/src/web/service.ts`, `apps/server/src/web/renderer.ts`; integrate `apps/server/src/app.ts` and `main.ts`; tests `tests/web-runtime.test.ts`, `e2e/web-isolation.spec.ts`. Use a real HTML parser rather than regex substitution.

**Interfaces:** `WebPreviews.create(actor: Actor, pageId: string, componentId: string, source: WebSource): Promise<{id: string; url: string; expiresAt: string}>`; `revoke(actor, id)`; separate renderer serves revision-local `index.html`, `styles.css`, `main.js` and authorized asset mappings. Read current page permissions before creation and capability-backed media delivery. The source payload is a snapshot from the canonical editor, not another editable server body.

- [ ] RED: owner/editor/viewer read-preview access, revoked/cross-workspace access, expiry, guessed capability, absent app cookies, response headers, direct-open sandbox and script/style delimiter payloads. Verify failures.
- [ ] Create cryptographically random, short-lived opaque revision capabilities, immutable derived source files and parser-based managed references. Render origin must be different from the app origin; production requires a separate content site without app cookies. Development uses a distinct host and dedicated listener. Reject a deployment that would expose executable raw HTML on the application origin.
- [ ] Apply response CSP including sandbox without same-origin permission; deny ambient API connections, forms, top navigation, popups and browser-sensitive features. Source includes browser JS/modules and owned assets; external dependencies require a declared resource policy. Do not fetch untrusted external URLs on the server. Bound revision memory/count/TTL by workspace and dispose/revoke explicitly.
- [ ] Test actual browser parent DOM/storage denial, a script and CSS that work inside the frame, attempted host/API mutations and direct route opening. Test runaway code in an isolated browser process and document the measured recovery limit. Do not assert that an iframe timeout guarantees CPU isolation. Commit only after these gates pass.

### Task 4: Native source editing and preview workspace

**Files:** create `apps/web/src/web/SourceView.ts`, `WebAuthoring.tsx`, `Preview.tsx`; integrate `apps/web/src/documents/richExtensions.tsx`, `Editor.tsx` and authoritative CSS; tests `e2e/web-source.spec.ts`, `e2e/web-isolation.spec.ts`.

**Interfaces:** `SourceView` consumes a live ProseMirror node/view/getPos and emits only document transactions; `WebAuthoring` consumes the existing editor and web node identity; `Preview` consumes a read-only `WebSource` snapshot/revision and current access, with no generic workspace mutation bridge.

- [ ] RED: native typing/paste/indentation, source tabs, selection search, code/split/preview switching, retained editor selection, Run/Stop/Reset, source saving after a syntax/runtime error and no unsolicited rerun during remote typing. Include the five review-focus conditions in real browser tests.
- [ ] Implement the verified adapter with syntax/indent/completion, remote transaction mapping, composition handling and current write-access checks. CodeMirror history must not compete with collaborative undo. Lazy-load only when editing source.
- [ ] Build neutral authoring chrome in the selected workspace system. Desktop supports split preview; mobile uses one view at a time. Render-only reading hides code controls while keeping an accessible edit path.
- [ ] Implement the current-frame-only diagnostics protocol: validate source window, instance, message shape/size/count, bounded resize and output. Drop messages after stop/navigation/revocation. No workspace commands or credentials cross the boundary.
- [ ] Verify two browser identities, closed offline drafts, role downgrade/upgrade, focused deletion, restore and component duplication. Run type/build and relevant original note/canvas regressions; commit.

### Task 5: Whole-page layouts, creation and content capture

**Files:** existing page composition/creation owners, `apps/web/src/documents/BlockMenu.tsx`, `capture.ts`, workbench command registry and web-authoring feature; tests `e2e/web-pages.spec.ts`, `tests/commands.test.ts`.

- [ ] RED: create a whole web page and an inline component without setup forms; normal page tree, subpages, tabs, sharing and metadata remain reachable. A wide responsive site does not inherit ordinary reading-width/title controls. Existing notes are not silently converted.
- [ ] Add actual **New web page** and **Web component** actions and a small set of useful source-backed layout starters. Explicit web-source paste/import preserves HTML/CSS/JS; ordinary paste retains its sanitizer and unsupported-original recovery behavior.
- [ ] Add page-result presentation with code/split/preview access, meaningful keyboard focus and 360/390/1024/desktop behavior. Preserve a pre-conversion history version for any offered conversion action. Internal web-page links resolve through page identity and current ACL.
- [ ] Compare fresh rendered screenshots against a complete authoring design in the neutral system; verify actual interactive controls/media and layout behavior, then commit. Source-only nodes without this usable experience do not complete the feature.

### Task 6: Discovery, owned media and portable websites

**Files:** shared `projection.ts`; existing Attachments, PageInstances, Templates and Transfer owners; tests `tests/web-transfer.test.ts`, `tests/web-discovery.test.ts`, relevant template/instance tests and browser import/export flows.

- [ ] RED: search HTML prose/headings without executing scripts; source-code search stays distinguishable. Export/import exact Unicode/whitespace/source, relative media, internal links, mixed components and nested pages. Cross-page private references do not leak. Reject archive traversal, malformed nodes, unsupported versions and oversize sources.
- [ ] Extend shared projections and ingress validation; keep runtime-generated text disposable. Remap IDs/assets in cloning, templates and archives without rewriting arbitrary source using regex.
- [ ] Add portable website ZIP output with `index.html`, `styles.css`, `main.js` and relative owned assets, plus native full-fidelity JSON/ZIP retention. Markdown export preserves an explicit web-source reference rather than silently dropping it. Published public hosting is a separate later workflow, not implicit in preview/export.
- [ ] Verify real upload/viewer/revoked media, history preview and template instantiation; inspect exported files in an independent browser context. Run full original and new acceptance gates, document actual limits and commit. Keep the original application's final independent review and commercial/native stages open until their own requirements are proved.
