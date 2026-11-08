# Current web delivery

## Implemented

- Quiet Workbench navigation, working tabs, continuous block writing, compact contextual page tools, page explorer filtering/sorting and responsive record inspection.
- Personal app and shared page appearance with arbitrary font families, remote font sources, semantic colors, sizes/density, custom CSS, live preview, autosave and reset. Neutral sans-serif is the default, not a restriction on authored content.
- Complete website pages and inline web components, expandable source files, CodeMirror editing, real Code/Split/Preview and Run/Stop, modules, JSON and ordinary external website resources.
- Canonical Yjs collaboration, independent undo, offline close/reopen recovery, live access changes and identity guards. Code and rich notes share the existing document owner.
- Isolated separate-site executable previews, current-access checks, owned logical media, failed upload original retention/retry, duplication and native transfer remapping.
- Static HTML discovery without executing authored code; website ZIP export containing exact source and owned media, independently served and opened without Note authentication.

All application styles remain in `apps/web/src/styles.css`; authored CSS remains document content. The root Zustand store owns application state. Preferences, Pages, Documents, Attachments and Transfer keep their existing persistence responsibilities.

## Verification

The complete behavior suite passed 205 tests across 40 files. Typecheck and production build passed. A broad browser run passed 78/79; its single metadata focus failure was repaired, and all 12 affected browser scenarios then passed. Two independently reviewed Important findings were reproduced and repaired, with real CSS and atomic collaborative-source regressions. The full browser suite was not repeated after these localized fixes. IAB desktop/mobile captures and direct concept/render comparisons are documented in `2026-11-08-web-authoring-verification.md`.

## Explicit limits

This is a usable local web build, not a declaration that the complete commercial product is finished. Production deployment/domain setup, billing, operational hardening and native mobile/desktop packaging remain the previously deferred stages. Initial and source-editor bundle size warnings remain. Advanced canvas interchange/topology acceptance and the remaining whole-product comparison matrix in the original plan are still open. OS-level IME certification and guaranteed recovery from CPU-heavy authored scripts have not been established. The original goal and unfinished plan tasks must not be marked complete on the strength of this delivery.

No code was pushed or deployed. Local commits record the verified milestones.
