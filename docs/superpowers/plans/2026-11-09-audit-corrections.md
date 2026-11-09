# Audit corrections implementation plan

Later scope update: the user's request to finish the remaining work authorized full i18n, CSS consolidation and bundle splitting. Current results and remaining validation limits are consolidated in [the final report](../../relatorio-auditoria-2026-11-09.md) and [the supplementary plan](2026-11-09-audit-remaining.md). Historical entries below describe their stage of the work.

Goal: correct the reproducible interface and workflow defects from the current audit while preserving the Mosaic design.
Architecture: shared accessible selection control; scoped workspace error handling; final responsive rules and bounded recovery lists.
Spec: the two audit reports in this chat, authorized by the request to correct all identified problems.

- [x] Shared themed select and multiselect; migrate native controls, preserve form events and keyboard access.
- [x] Correct active-page deletion and recovery list search, ordering, pagination and labels.
- [x] Correct search, graph accessibility, recent pages, calendar, template and history empty/help states; responsive canvas framing.
- [x] Correct mobile header, visible keyboard focus, date affordances, target sizes and explicit workspace invitations.
- [x] Run typecheck, lint, formatting, behavior tests and build. Verify changed interactions in the in-app browser at desktop/mobile sizes.

Ruling: reuse current checkout per desktop default; preserve existing .claude directory. Full translation is a product expansion, not an established interface language requirement; retain current language and explain remaining scope honestly.

Validation: in-app browser desktop and 390x844; custom select pointer/keyboard selection inside dialogs, themed dropdown, trash search, mobile actions, immediate rename+delete with no residual alert, fresh-tab console clean. Focused regression tests pass. Full final check recorded on completion.

Final verification: npm run check passed (53 files / 264 tests, typecheck, lint, formatting, production build). node --check passed for migrated visual QA scripts. Immediate rename+trash browser repro and subsequent navigation: no alerts. Fresh browser tab console: no errors/warnings. Build retains existing SourceView chunk-size advisory. Full E2E suite not run; select-focused E2E regression passed and browser interactions verified through CUA.

## Extended regression audit (active goal)

The previous completion claim was provisional: the full E2E suite had not run. Reopened verification against all reported defects.

Additional fixes: workspace bootstrap ignores stale responses; Select reports required validation, focuses correctly inside dialogs, retains multiselect focus across pending saves, and uses a top-layer popup to escape transformed/clipped containers; debounced canvas wheel saves capture the outgoing camera/viewport.

Exploratory full suite started before all test locator migrations settled. Observed obsolete img graph role and Restore button expectations in cached test workers; migrated to group and named restore controls without weakening behavior assertions. The themed selection helper now waits for the visible control before reading backing options, preserving native locator auto-wait behavior. Added real calendar property-creation and mobile hit-area regression tests.

Isolated verification: calendar + database controls + database layouts + responsive productivity: 6/6 passed. Canvas navigation and pinch passed fresh; pinch repeated five times passed. Select/modal/validation/multiselect/transformed popup targeted scenarios passed. Final source freeze and full rerun still required.

Cleanup: policy rejected removal of generated .runtime-select-review. Folder retained unchanged and locally excluded from Git; production runtime remains untouched.

## Requirement-to-evidence map

- Select visual consistency: shared Select/select.css across all former native controls; pointer/keyboard/modal tests; dark/light browser screenshots 29/30. Required fields show validation; busy multiselect retains focus; transformed containers use top-layer popup.
- Mobile header, targets and focus: final responsive rules; interface-productivity checks nonoverlapping header hit areas and one visible Saved indicator; Select keyboard and drawer focus tests.
- Page deletion/errors: page-scoped errors; atomic reload cleanup; serialized pending metadata writes; navigation-recovery-state tests and real immediate rename+delete reproduction.
- Workspace races: request/identity/workspace guards tested against late bootstrap success/failure.
- Trash: newest-first hierarchy roots, descendant-title search, 50-row render pagination, per-restore pending guards and named buttons; trash-state tests plus full database restore workflow.
- Search/graph/recent pages: Canvas filter, exposed SVG link descendants, retained untitled work; graph/browser and recent-page behavior tests.
- Calendar: direct missing-date CTA creates a Date property and selects it; audit-calendar E2E verifies the real API definition and rendered grid.
- History/templates/explorer: checkpoint cadence explained separately from continuous saving, explicit empty template guidance, Clear filters action; discovery and browser workflow tests.
- Canvas: compact/wide camera preferences and fitted initial compact viewport; captured wheel-save camera and size prevent delayed-save crossover; spatial and touch/browser tests.
- Language: the user specified that any localization must use i18n. No ad-hoc translation introduced; original interface language retained. Initial audit classified this as a product opportunity, not a broken behavior.
- Existing source-editor chunk advisory remains an optimization opportunity; current editor is already lazy-loaded. No claim that the original build warning was removed.

Authoritative final gates pending at this entry: stable full 103-case E2E completion. Current npm run check passes all 267 tests, lint, typecheck, formatting and production build.

## Final completion audit

- Stable full E2E run: 103/103 passed, exit 0, 6.8 minutes, with no concurrent source edits. Includes all prior failures: canvas Details, endpoint selects, mobile pinch, database restoration/layouts, graph camera/navigation; additional calendar and multi-select cases included.
- npm run check: exit 0; 53 files / 267 behavior tests passed; TypeScript, ESLint, formatting and production build passed.
- git diff --check: clean. Test-run result file reports passed and no failed test IDs.
- In-app browser: final native top-layer themed popup verified by :popover-open; screenshots 29 (light) and 30 (dark); original System theme restored. Local dev services restarted and serve the existing workspace normally.
- No detected regressions remain in the full current suite and focused checks. This is bounded verification, not a claim that unknown defects can never exist.
- Optional localization was not added; the user's condition that any implementation must use i18n is preserved.
