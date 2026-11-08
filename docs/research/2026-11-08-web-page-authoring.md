# Web page authoring and a neutral application shell

Date: 2026-11-08. Status: research and implementation direction; not an implemented capability or a user-approved new specification.

## Intent

The user wants pages that can contain real, responsive, interactive websites, alongside the existing Markdown and rich blocks. A page must be able to escape the fixed document layout. The surrounding application must use a beautiful neutral interface without a dominant brand hue or serif typography. Authored content remains free to use its own colors and fonts.

This supplements the existing workbench plan. It does not declare the unfinished canvas, collaboration or interface acceptance work complete. The user has authorized autonomous investigation and implementation without another question round.

## Sources and implications

| Primary source | Observation | Product implication |
| --- | --- | --- |
| [Notion embeds](https://www.notion.com/help/embed-and-connect-other-apps) | Documents external embeds, including CodePen and other interactive applications. | Embedding is useful, but does not by itself provide native HTML/CSS/JS ownership and editing. |
| [Obsidian HTML](https://obsidian.md/help/Editing%2Band%2Bformatting/HTML%2Bcontent) | HTML is sanitized and has documented Markdown/HTML composition limitations. | Rich-paste handling should remain separate from deliberate executable web authoring. |
| [CodePen full-page view](https://blog.codepen.io/documentation/full-page-view/) | A result-focused view hides code panels; its preview remains sandboxed. | Provide a genuine full-page result and an explicit editing workspace, not three permanent textareas above a note. |
| [ProseMirror CodeMirror example](https://raw.githubusercontent.com/ProseMirror/website/master/example/codemirror/index.js) | A code-editor node view forwards edits and selection into document transactions and reflects external updates back. | A source editor can be a view of the current document instead of becoming another saved body. |
| [Yjs CodeMirror binding](https://raw.githubusercontent.com/yjs/y-codemirror.next/main/README.md) | A direct collaborative binding exists; the main branch currently targets the newer Yjs generation and distinguishes the stable v13 package. | Do not install an incompatible development binding or bind a second collaborative editor over the same source. |
| [MDN iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe) | Sandbox tokens control scripts and origin behavior. Same-origin executable content can defeat isolation when both permissions are granted. | User code must run outside the application's DOM and origin authority. |
| [MDN CSP sandbox](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox) | The CSP sandbox directive requires a response header, not a meta tag. | Commercial rendering needs a dedicated response boundary; a meta tag is not a complete sandbox policy. |
| [MDN postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) | Cross-origin frames can exchange messages, requiring sender validation. | Preview diagnostics are a bounded protocol, never an arbitrary command bridge into the workspace. |
| [W3C use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast) | Meaning and focus cannot depend on hue alone; identifying controls/states needs sufficient contrast. | Neutral selection requires shape, weight, borders, labels and focus indication, not barely different gray backgrounds. |

These are documented behaviors, not hands-on claims about every competitor feature or a claim that this application surpasses them.

## Existing architecture inspected

- `packages/editor/src/schema.ts` owns the shared ProseMirror schema and converts its `default` Yjs XML fragment to/from document JSON. It already supports continuous blocks and a separate canvas root. Server validation uses this same schema.
- `apps/web/src/documents/session.ts` owns collaborative transport, local recovery and durable status. It must also own the lifetime of web-authored page content.
- `apps/web/src/documents/richExtensions.tsx` supplies the shared rich-block rendering integration. A web component would extend that integration rather than fork the editor.
- `apps/web/src/documents/capture.ts` currently removes script/style/iframe elements from rich paste and preserves unsupported original material as an attachment; `paste-policy.ts` identifies such content. This preserves an original file but does not deliver a functioning website. The new capability must add an explicit web-source import/creation path rather than weakening rich-paste filtering.
- `packages/editor/src/projection.ts` derives text, headings and knowledge links without owning editable content. It needs a deliberate web-content projection.
- `apps/server/src/transfer/archive.ts` currently recognizes document/database/record/canvas pages and performs explicit canvas structure validation. Web-source preservation and validation must be added to import, cloning, templates and history paths; existing ZIP behavior is not proof that new nodes are supported.
- Root Zustand remains the application-state owner. Editor state, the CRDT and a running iframe have distinct responsibilities; forcing all of them into a duplicated Zustand text buffer would violate the source-of-truth requirement.
- `apps/web/src/styles.css` remains the sole application stylesheet. User-authored CSS belongs to the user's document, not this stylesheet.

## Approaches evaluated

1. Inject arbitrary markup and scripts into the current rich editor. Rejected: page styles and scripts would acquire application privileges, and the rich schema cannot preserve arbitrary DOM behavior.
2. Require an external CodePen/site URL. Useful as an existing embed option, but insufficient: source, retention, collaboration and portability would depend on another product.
3. Own web source in the existing collaborative document and render it in a separate browser context. Selected engineering direction: it supports complete layouts while retaining current page identity, hierarchy, permissions, recovery and history. This selection is the implementer's recommendation under the user's autonomous-work instruction, not an invented user approval.

## Authoring experience

Support both an inline **Web component** block and a **Web page** presentation. They share one source model and renderer. An inline widget can coexist with normal prose; a web page uses the available content viewport without the ordinary title/metadata/reading-width stack. The workspace's navigation and page actions remain reachable outside the rendered content.

Offer reusable layout starters and plain-language creation actions as well as source editing, so a different layout does not require everyone to begin with blank code. Ordinary rich pages should also gain genuine layout primitives where appropriate. Do not confuse a visual layout editor with a second saved HTML representation: a future block-to-web composition system must derive its output from stable source blocks. Creating a web page must not silently flatten or replace an existing note; any explicit conversion needs a durable pre-conversion version and a reversible result.

The editing workspace provides **HTML**, **CSS** and **JavaScript** source tabs; **Code**, **Split** and **Preview** views; **Run**, **Stop**, **Reset**, runtime diagnostics, asset insertion and desktop/tablet/mobile viewport controls. CodeMirror 6 is the preferred lazy-loaded source editor: syntax support, indentation, completion, search and keyboard operation, with neutral chrome. On mobile, switch views instead of squeezing three columns together.

Saving source and running it are different operations. Edits save through the current document session even when JavaScript fails. Run creates a preview of a specific source revision; later unrun edits are visibly distinguishable. Do not remount a running widget on every remote keystroke or replay its side effects silently. Readers see rendered content rather than a code form. Initial execution should be deliberate; its final behavior needs a browser-tested interaction specification before implementation.

Responsive layouts, CSS Grid/Flexbox, semantic HTML, SVG, media, event handlers, native controls and ES modules are target browser features. Arbitrary private workspace access, server-side Node/PHP execution and a full package build system are separate capabilities. Document this distinction in developer documentation, without cluttering the ordinary reading flow.

## Canonical model and ownership

Proposed structure: a `webRoot` for a whole web page, or a `webComponent` in the block stream, each containing exactly one text source node for each language. Source text is editable text content, not a large JSON attribute replaced on every keystroke. Stable IDs identify components. A shared validator enforces channel uniqueness, source-size limits and structural compatibility. The existing document page kind can retain identity; a new top-level page kind is not necessary merely to change its content root.

Preferred first integration: a CodeMirror node view forwards granular edits/selection to ProseMirror transactions, which the existing Yjs plugin synchronizes. External changes are reflected without echoing them as new local changes. Undo/redo delegates to the existing collaborative document owner. Do not additionally attach `y-codemirror.next` to the same source, create another Y.Doc, or keep an independently writable HTML/CSS/JS state object in React/Zustand.

The adapter requires an evidence-producing compatibility spike before commitment: simultaneous insertions in one channel, changes in different channels, IME composition, remote replacement, deletion while focused, local-only undo, history restore, revoked write access and closed offline recovery. If that bridge cannot preserve these properties, reconsider a direct Yjs binding with explicit schema/undo ownership rather than shipping a snapshot-overwrite workaround.

Feature boundaries: shared source schema/validation/projection in the editor package; source editing and preview lifecycle in one web-authoring feature; preview delivery in one server-owned rendering boundary. Existing Documents, Attachments, Pages, Transfer and History keep their current responsibilities. These are cohesive collaborators, not multiple owners of web source or one giant component.

## Rendering boundary

Use an executable sandboxed iframe without `allow-same-origin`, top navigation, popups or form submission privileges by default. For commercial delivery, serve previews and their resources from a separate registrable content domain with no application cookies; a different port alone is insufficient cookie separation. Use response-level CSP, restrictive Permissions Policy and no-referrer behavior. Never provide a same-origin raw HTML preview endpoint that can be opened outside its sandbox.

Deliver HTML, CSS and JavaScript as separate resources from an immutable preview revision. Parse HTML with an HTML parser when inserting managed resource references; do not concatenate user source into inline script/style strings or rely on regular-expression escaping. Preserve the author's full HTML document, metadata, module semantics and source locations where supported. The rendering service stores only short-lived derived artifacts and does not execute user JavaScript on the server.

Start with self-contained code and owned media. External dependencies/network access need an explicit resource model with declared HTTPS origins, no ambient credentials and visible failures. Sandbox alone is not a network firewall. Authored iframe self-navigation and resource loads must be tested, and private application endpoints must enforce authorization/CSRF independently. Do not promise unrestricted third-party packages, authenticated embeds or browser APIs that conflict with an opaque origin.

An opaque-origin frame reports `origin: null`; that value is not authentication. Accept bounded diagnostics only from the exact current frame window and preview instance. Treat its messages as untrusted, rate-limit and bound output, reject stale frames, and expose no generic workspace API or tokens. Owned asset access uses narrowly scoped, expiring capabilities and current authorization; never ship account credentials to user scripts. Stop/dispose tears down the frame and ignores further messages.

An iframe does not guarantee CPU/memory isolation or let an application reliably kill arbitrary infinite main-thread loops. A separate content site improves the boundary, but process placement remains browser-dependent. Test runaway-code recovery in an isolated browser process; do not claim an in-page timeout solves it. Instrumentation and runtime restrictions require a separate evidence-based decision.

## Persistence, discovery and portability

- Preserve exact source across reload, two-user edits, local recovery, named history, restore, cloning, templates and native ZIP. Server validation applies to every ingress path, not only normal saves.
- Derive searchable human-readable HTML text/headings and explicit internal page references without executing scripts. Keep code discoverable as code, avoiding CSS/JS token noise overwhelming prose relevance. Runtime-generated text is not a second searchable canonical document.
- Keep assets in the current attachment owner. Export portable `index.html`, `styles.css`, `main.js` and relative assets; native JSON/ZIP also retain page hierarchy and web-component metadata. Import must reject path traversal and incompatible structures. Markdown export must explicitly preserve/link web source rather than silently dropping it.
- Internal links between authored web pages must resolve through page identity and current ACL. Preview routes are not public publication. Public domains, SEO and a publish/revoke workflow belong to the later commercial publishing stage unless explicitly brought forward.

## Neutral visual contract

Keep white content, graphite text, gray navigation, subtle dividers, Inter/system sans-serif and monochrome primary actions. No dominant green, violet or blue. Hierarchy comes from type scale, spacing, alignment and surface contrast. Selection uses a visible indicator and weight; keyboard focus uses a contrasting outline. Reserve restrained semantic colors for errors/warnings and user-assigned categories, with labels/icons as well. Measure contrast instead of assuming grayscale is accessible.

The current shell tokens have already been changed to this neutral direction. This document does not claim that every legacy feature surface has been harmonized or visually accepted.

## Acceptance before calling this implemented

1. Create both a mixed note widget and a full-page responsive site; real CSS layout and JS interactions work and survive reload.
2. Granular simultaneous editing, local undo, offline recovery, permission changes, history and template/ZIP round trips preserve exact source.
3. CSS cannot style the host. Scripts cannot read the host DOM, cookies, tokens or private APIs, navigate the workspace, or trigger host commands through forged/stale messages. Test actual requests and headers, not only iframe attributes.
4. Uploaded media renders under its own ACL and exports correctly. Missing dependencies and syntax/runtime errors are actionable; saved source remains intact.
5. Code/split/preview, Run/Stop/Reset, diagnostics, source selection/search, keyboard/IME and 360/390-wide layouts work in the browser.
6. A separate-browser runaway-code experiment establishes supported recovery behavior and limitations. No unsupported universal isolation claim.
7. Neutral shell QA covers navigation, document, data table, inspector, commands, dialogs, graph, canvas and authoring views. A small green test subset does not complete the whole application.

## Next implementation sequence

Finish and commit the verified neutral-shell checkpoint separately. Add a compatibility spike and executable acceptance tests for canonical source integration and renderer isolation. Then implement the shared source model, editing adapter and renderer, followed by whole-page presentation, assets, projections and portability. Keep the existing workbench plan and its unfinished acceptance items authoritative; add this capability as a named supplemental track rather than silently replacing them.
