# Block workspace — revision 2

> Superseded visual direction. The user explicitly rejected separated block cards and the heavy chrome. The current requirement is continuous Notion-style content: zero paragraph card borders, zero artificial inter-block gaps, contextual gutter controls, neutral navigation, and details closed by default. `workspace-v2.png` and `mobile-v2.png` are historical rejected concepts, not implementation acceptance references. The correction and actual rendered evidence are recorded in `verification.md`.

The user rejected the original visual direction and requested an immediate rebuild of weak implementation, with every page built around real manipulable content blocks. This request supersedes the original green editorial visual specification; the approved backend architecture and delivery sequence remain in force. The user explicitly requested execution, so this correction does not introduce another approval gate.

## Interaction ownership

The shared Tiptap schema owns content types. A Yjs document remains the only canonical editable document; React does not mirror block content in an array. ProseMirror transactions move, duplicate, remove, and transform complete nodes. Decorations expose block boundaries without altering the document. The official Tiptap drag handle supplies drag and drop, including collaboration-aware position handling. Block actions are available from a persistent touch-accessible control as well as the desktop handle. Menus support search, keyboard navigation, and Escape. Non-text structures cannot be silently flattened by a conversion.

## Visual system

The new reference is `concepts/workspace-v2.png`, generated using the built-in Image Gen tool. Graphite navigation (`#191b21`), neutral canvas (`#f6f7f9`), white independent content surfaces, cool fine borders, restrained blue (`#5865e8`). Inter is used throughout. Page title 34 px, headings 23 px, body 14–15 px, controls 12–13 px. No serif typography, green treatment, gradients, or decorative analytics. One authored stylesheet remains the single source of visual tokens and rules.

The alternatives considered were continuing the unframed document, a large freeform canvas, and a structured block workspace. The explicit user correction selects the structured block workspace. Freeform canvases change navigation and editing semantics; repainting the document would leave the actual interaction problem unresolved.

## Deliberate implementation choices

Existing page text and user-authored content are preserved. Concept demonstration copy, dates, authors, rows and backlinks do not overwrite stored content. Real workspace names, save state, permissions and membership remain authoritative. The mobile reference repeats a toolbar on every block; implementation uses one selected-block control to avoid excessive touch chrome while retaining per-block operations. Right-hand details are accessible through a drawer on smaller screens. Insert and transform menus are searchable contextual popovers, rather than a full-screen block dialog.

## Verification

Regression tests cover structural moves, nested content and marks, duplicate/delete, safe transformations, durable browser reload and mobile operations. Full collaboration, access, recovery, capture, database, graph and transfer tests must still pass. Visual checks cover desktop, mobile, table and menu states, plus console errors, overflow and keyboard focus.
