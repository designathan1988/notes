# Root corrections and local commit

User objective: identify and fix remaining interface/functional defects at their cause, verify the application, then create a local commit.

## Remaining confirmed defect

A newly created template can acquire an IndexedDB pending marker during initial document synchronization. Leaving before its WebSocket acknowledgement destroys the active session. The next copy sees the retained marker and asks the user to reopen a template whose contents may already be fully durable. Waiting in the test masks that product limitation.

## Implementation and verification

1. Write regression cases for pending recovery bytes already covered by a durable server snapshot, genuinely unsent bytes/deletions, mismatched generations, concurrent local changes, denied/offline requests and identity changes.
2. Expose the existing authorized document acknowledgement through a read-only API route. Preserve page authorization and generation information.
3. Before rejecting a copy solely because of a retained pending flag, verify the exact retained bytes against the server snapshot. Clear the flag only through the existing compare-and-acknowledge IndexedDB transaction. Never upload, overwrite or discard an unconfirmed draft.
4. Reproduce immediate template exit and reuse in a real browser, including delayed acknowledgement. Remove the extra saved-state wait from the original scenario so the product behavior is exercised directly.
5. Review the full current diff and audit coverage, run code checks and the entire browser suite with frozen application source, document limitations, then commit only task files locally. Preserve pre-existing .claude files and runtime data.

## Completion evidence

Implementation and focused verification:

- New read-only acknowledgement endpoint delegates existing page authorization.
- Exact snapshot proof plus IndexedDB compare-and-acknowledge resolves a stale pending marker without publishing or dropping unsent work.
- Ten client tests and one server authorization test pass. Before the implementation, the already-durable and concurrent-write cases failed and the new route returned 404.
- New real-browser regression drops actual socket acknowledgements, observes a pending IndexedDB marker, leaves the template, copies it through the UI, verifies HTTP proof and checks the marker cleared. Passed with no saved-state wait.
- Original canvas snapshot scenario also passes after removing the additional saved-state wait.
- Independent read-only review found no important issue in the root fix.
- Catalog inspection found three additional untranslated public error/warning messages; all corrected. The expanded source-coverage regression failed on those exact three messages before the fix, then passed.
- Focused verification: 22 tests across the durability, authorization and locale cases, plus lint, pass.

Final verification:

- `npm run check`: exit 0; 293 tests in 58 files, typecheck, lint, formatting and production build passed. Largest JavaScript chunk 388.12 kB; no threshold increase.
- `npm run test:e2e`: exit 0; all 107 scenarios passed in one complete run (6.5 minutes), including the original template flow with no added saved-state wait and the new dropped-ack regression.
- Application source remained unchanged during these final runs. Only completion documentation was updated afterward.
- `git diff --check` and staged diff checks passed. Pre-existing `.claude/` files and all runtime data remain outside the commit.
- The local commit records this verified working tree using the repository's existing author identity; it does not alter global Git settings or push to a remote.
