# Concurrent canvas reference reconciliation

## Observed failure and policy

Two individually valid canvas updates can create an invalid merged graph: one editor deletes a note while another creates a connection to it; one deletes a group while another adds a member; two independent group moves create a cycle. Rejecting the complete merged update also rejects unrelated rich-text edits and prevents durable acknowledgement.

The conflict policy follows the existing delete command: a deleted endpoint removes its incident connections, while deleting a group releases its members instead of deleting their content. A merged group cycle releases the lexically greatest group ID in that cycle, so update arrival order does not determine which content disappears. No note or group is discarded to break a cycle.

## Ownership and transaction boundary

`packages/editor/src/canvas-reconcile.ts` repairs references directly in the existing Yjs fragment. It never rebuilds the document from JSON and retains rich-text object identities. Invalid structure, duplicate/invalid IDs, geometry and unsupported attributes remain subject to the original validator. Imported JSON is still validated before merging; this is not a permissive import sanitizer.

Documents remains the sole durable owner. Its existing `save` facade retains the original acknowledgement shape; `merge` returns the durable acknowledgement and an internal optional Yjs repair delta. Both derive from the same existing locked transaction. The collaboration hook applies the accepted payload and repair atomically only after commit, then broadcasts the ordinary durable acknowledgement. The hub's later application of the original payload is idempotent. No additional database read, alternate persistence store or repair payload in the public acknowledgement was added.

## Verification evidence

- Three new behavior scenarios cover a deleted endpoint plus a new connection and surviving rich text; a deleted group plus a new member; and a cycle created by individually valid group moves. They assert retained Yjs child identities, deterministic outcomes, strict validation and idempotence.
- Disabling only the reconciliation call reproduced the original service failure: the valid concurrent update was rejected as `INVALID`. Restoring it passed the scenario. No browser runner was active during that controlled regression check.
- A real browser plus an independently authenticated, disconnected Hocuspocus client exercised the conflict. The offline client created its connection and edited the surviving note before learning of the deletion. Reconnection preserved the text, removed the orphan on both clients, produced no alert, reached Saved and reopened durably. The focused native scenario passed in 2.5 seconds.
- The complete behavior suite passed 212 tests across 42 files (80.91 seconds). Typecheck and production build passed. Persistent gate logs/status files are retained outside the repository under `workspace-reform-render/final-topology-gate` in this session's visualization directory.
- The complete 83-scenario browser gate passed in 4.8 minutes, including the new topology and connection-presentation scenarios, ordinary editing, two-account collaboration, permissions, history, recovery, templates, data views and website authoring/export. Its terminal output and persistent status record establish this result; it is not inferred from the focused scenario. The original spatial task still has unfinished acceptance.

An earlier broad runner lost its process handles when the execution environment stopped; process inventory and all three listeners were absent, and no terminal report remained. It was not treated as a passing or still-live gate. The development server and gates were restarted only after confirming that state, with persistent logs for the replacement run.

Remaining Task 6 work includes containment/resize, stage capture, rich read-only/history/template previews, portable JSON Canvas interchange and metadata navigation. The interchange sequence is now concrete in `docs/superpowers/plans/2026-11-08-canvas-interchange.md`. Original Task 6 base and the complete product objective remain unchanged.
