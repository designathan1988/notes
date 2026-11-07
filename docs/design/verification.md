# Web beta verification

## Current acceptance reference

The user's latest explicit correction supersedes both generated directions: blocks must behave and read as in Notion, without independent paragraph cards or artificial inter-block gaps. The authoritative reference is that correction and the [official block interaction documentation](https://www.notion.com/help/what-is-a-block). The original `concepts/workspace.png` and subsequent `concepts/workspace-v2.png` / `mobile-v2.png` were inspected, but are **rejected historical concepts**, not approved current visuals. No claim of fidelity to those rejected images is made.

The implemented system uses continuous 16 px / 24 px Inter content, a white canvas, neutral sidebar, semantic heading spacing, contextual gutter controls, and a single shared document model. The extra Document/Database/Graph tab row was removed. The details panel starts closed and remains available from the header. Lists, paragraphs, media, tables and callouts are actual document nodes, not independent React text values.

## Browser method and evidence

The ChatGPT in-app browser was used first to inspect the visible application, navigate between pages, focus content and inspect real gutter controls. Playwright provides isolated multi-identity regression tests and repeatable screenshot artifacts; it is not a fallback for an unavailable in-app browser.

Run `node scripts/visual-qa.mjs <output-directory>` against the local development server. Artifacts for this run live under `C:/Users/Jonathan/.codex/visualizations/2026/11/07/01a1b7b6-be13-7823-ace0-da731e95b11e/`:

- `workspace-desktop.png`: 1536 × 1024, native desktop concept dimensions.
- `workspace-block-menu.png`: contextual operations on a real selected block.
- `workspace-mobile-390.png`: 390 × 844.
- `workspace-mobile-360.png`: 360 × 800.
- `workspace-database.png`: 1536 × 1024, real records.
- `verification.json`: viewport, overflow, computed typography and console evidence.

Both desktop and mobile rendered screenshots were inspected with `view_image`. The first mobile artifact caught a screenshot taken during the responsive sidebar transition. Capture now uses the app's supported reduced-motion mode so it records the settled layout. The actual app still respects user motion preferences.

## Comparison ledger

| Point | Observed problem | Correction and render evidence |
| --- | --- | --- |
| Block container | Separate white cards, borders, padding and 8 px gaps misinterpreted the user request | Paragraphs now have zero borders, zero outer margins and no independent surface. Browser regression checks adjacent paragraph bounds and border width. |
| Content typography | Serif editorial title and prose, then undersized app body | Inter throughout; actual computed document body is 16 px with 24 px line height. Desktop title 34 px, mobile 27 px. |
| Palette | Rejected green direction, followed by rejected heavy graphite/blue chrome | White canvas, neutral sidebar and restrained gray controls. Specialized code, callout and selected-text treatments retain their semantic roles. |
| Chrome | Persistent details and redundant view tabs competed with the document | Tabs removed, details closed by default, header owns page operations. |
| Block operations | Content looked like generic prose and operations were hidden in a modal | Contextual + / six-dot gutter, searchable insertion/transform menu, actual node move/duplicate/delete, native drag and drop. |
| Mobile | Hover-only operations would be inaccessible | Touch formatting toolbar includes block actions and insertion; sidebar and details become dismissible drawers. No horizontal document overflow at 390 or 360 px. Wide tables scroll within their own container. |
| Persistence | A callout selected as a whole was replaced by typing | Insertion now focuses its inner text position. The browser test types into a callout, saves, reloads and verifies its structure and text. |
| Network recovery | Hot-restart gateway responses could expose JSON parser errors | Safe reads retry a transient failure. Mutations are not automatically replayed. Transport errors have a readable message; interrupted uploads retry their original reserved attachment ID. |

Above-the-fold copy was checked against the current stored content and existing product labels. Page title, description, date, links, records and save state come from actual data. The removed view-tab labels and details heading are intentional simplifications requested by the user. No demonstration copy, synthetic teammates, metrics, fake activity or image-generated table rows were inserted into stored pages.

The current implementation was visually checked against the **latest user requirements**, rather than asserted to match an AI concept the user rejected. Functional tests are separate from visual evidence. The user remains the judge of the visual result.

## Search measurement

`npx tsx scripts/benchmark-search.ts` uses an isolated PGlite 0.5.15 PostgreSQL WASM database with 10,000 pages and weighted full-text projections, five warm-up queries and 25 measured searches. The measured mix covers a common term, phrase, exact-looking title, typo and missing term. This run measured p50 **80.36 ms**, p95 **188.57 ms** against a 300 ms local target. This is a small synthetic warmed local corpus, not a production concurrent-user performance claim. Commercial environment load testing remains in the approved next checkpoint.
