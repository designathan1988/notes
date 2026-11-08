# Portable canvas interchange

Continue original Task 6 inline, under the existing no-question authorization. Do not reset its base or substitute native workspace ZIP for JSON Canvas acceptance. Keep verified milestones in local commits; no push. This supplement follows connection-presentation and concurrent-topology acceptance.

## Contract and ownership

Support the [JSON Canvas 1.0 format](https://jsoncanvas.org/spec/1.0/): text, file, URL and group nodes; coordinates and stacking; labelled connections with attachment sides, arrow ends and colors. A `.canvas` JSON file can reference files absent from the upload. A ZIP can supply those files. No import may read host filesystem paths or fetch external resources on the server.

The existing document remains canonical. A format adapter derives native content on import and portable output on export. Transfer retains authorized imports, archive validation/budgets, staged ownership and resumable jobs; Pages/Documents/Attachments retain creation, persistence, media and ACL. No parallel editable canvas JSON is stored in application state.

## Implementation sequence

1. Add shared Markdown-to-block and block-to-Markdown conversion for text interoperability. Preserve common headings, emphasis, lists/tasks, quotes, code, tables and safe links. Unsupported source remains recoverable instead of disappearing. Do not execute imported HTML/JavaScript in the host.
2. Add a canonical resource-reference representation for file nodes whose bytes are absent. It must show the original relative path/subpath and an actual attach/resolve action, rather than a broken image or a fake download. Resolved media reuse Attachments and original-file failure recovery. Native clone/history/template/ZIP paths must retain/remap the same reference.
3. Implement a bounded JSON Canvas adapter. Map external IDs to valid local identities and remap edge endpoints; preserve node order, geometry, source paths, labels, colors and group/background metadata. Infer containment deterministically from geometry when the format provides none. Preserve exact rich Note blocks through an optional versioned native extension while supplying standard Markdown/resource fallbacks readable by other apps.
4. Reuse one bounded archive-entry reader for native and canvas packages. Resolve relative resource paths only against entries inside the uploaded archive; traversal outside the archive, duplicate names/IDs, invalid references, unsupported versions and expansion bombs fail before mutation. A missing file remains an explicit resolvable reference. Include owned image/video/audio/background bytes in portable ZIP output; never export a private foreign attachment through an authored reference.
5. Integrate Transfer routes and existing canvas catalog/page actions: direct file selection for import; direct `.canvas`/ZIP download for export. Process the existing durable import workflow automatically and navigate to the imported canvas only when complete. Keep the original file and a retryable, account/workspace-scoped intent after an unknown response. No mandatory configuration form or sharing change.
6. Verify Markdown/rich-content fidelity, all four node kinds, missing/resolved files, background treatment, nested groups, colors/sides/arrows and remapped media. Exercise import/export in a browser, reopen the resulting canvas, inspect the ZIP independently and round-trip it through the native format. Recheck permissions, invalid archives, original recovery and no duplicate import after retry.
7. Inspect desktop/mobile controls in the current neutral workbench, compare actual rendering with existing canvas concepts, run affected type/behavior/browser/build checks and commit. Keep containment/resize, stage capture, read-only previews, metadata navigation and the whole-product gate open until their own acceptance is proved.

## Required evidence

- Tests observed failing before each behavior is implemented.
- Exact source/Unicode retention for the versioned native extension; honest documented limits of the standard Markdown fallback.
- An exported package that loads its own media in an independent context without expired preview URLs or another page's credentials.
- Native-browser import, edit, reload and re-export using one canonical document, including failure/retry and a read-only account.
- No server-side fetching, path escape, hidden permission expansion or silent deletion of unresolved resources.
