# Execution ledger

Plan: `plans/2026-11-07-knowledge-workspace.md`

- User approved the design and explicitly authorized plan and implementation. Inline execution preserves that authorization; an independent review will run at the end.
- Pre-flight: shared interfaces and ownership are recorded in the plan. No conflicts found.
- Ruling: develop in the supplied initially empty directory rather than creating a worktree — no existing checkout or user changes require isolation; cost if wrong: less branch isolation, mitigated by local commits and no push.
- Ruling: use disk-backed PGlite for local PostgreSQL and local private filesystem storage for attachments, while production requires external PostgreSQL/object storage — Docker and PostgreSQL binaries are unavailable; cost if wrong: production-specific behavior still requires deployment-environment verification.
- Ruling: development remains local under the approved staged design; the Sites deployment path is not used because production hosting is a later founder-selected checkpoint.
- Task 1: foundation verified with disk reopen, repeatable migration, rollback, real database health and strict title validation; 4 tests passed, typecheck passed. Commit f9133cc.
- Task 2: real Better Auth cookie session, workspace isolation, viewer/private access, final-owner protection, cycle/stale move handling and branch trash/restore verified; 12 tests passed, typecheck passed. Commit 42b29c5.
- Task 3: found and reproduced an acknowledgement bug in the two-identity browser test. State-vector coverage alone misses deletion sets; durable acknowledgements now carry Yjs snapshots and verify snapshotContainsUpdate against local state. Regression tests include unchanged clocks with a new deletion and a real delayed transaction commit. Two independent identities now converge and reopen the persisted content in Playwright. Browser/IAB is working and was used for the first visible screen; Playwright is the isolated automated E2E harness, not a browser-control fallback.
