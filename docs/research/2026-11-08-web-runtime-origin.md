# Full website runtime: origin compatibility investigation

The latest requirement rejects rigid presets and self-contained-only HTML. Ordinary website behavior must include external CSS/fonts/media, module scripts, dependencies and interactive controls. The canonical-source spike is complete; this investigation concerns the browser execution boundary, not a second source store.

## Primary references revisited

- [MDN iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe): script and origin permissions have different effects. Giving executable content the application's own origin is unsuitable. An opaque origin also restricts browser storage and some dependency behavior.
- [MDN CSP sandbox](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox): a response header can retain sandbox restrictions when a rendered document is opened outside the original iframe.
- [MDN FontFace](https://developer.mozilla.org/en-US/docs/Web/API/FontFace/FontFace): a family and URL can define a user-provided face; loading and cross-origin response requirements still apply.

## Candidate to prove

Use a separate user-content origin, unique to each disposable preview revision. For local development, `preview-<unguessable-token>.localhost:<renderer-port>` is distinct from the application at `127.0.0.1:5173`. Production needs a dedicated user-content domain, outside the application's registrable domain. Do not silently fall back to executable same-origin previews when configuration is absent.

The iframe and renderer response may allow scripts, same-origin browser capabilities, forms, downloads and modals because this origin has no application authority. They retain sandbox/top-navigation restrictions. Normal public HTTP(S) resources follow browser/CORS rules, rather than a per-domain approval wizard. A shared renderer origin for all pages is not equivalent: storage and script-origin capabilities would cross between authored sites.

The authenticated application creates a short-lived preview capability from the committed canonical document. The renderer exposes only that revision's derived source and page-owned assets. It must not expose application session endpoints or accept a generic authenticated proxy request. Every private asset request rechecks the capability actor's current page access/generation; revocation retires the frame. Exact source remains in Documents; preview output is disposable.

HTML assembly should use a real parser, and CSS/JS should be served as separate files. This prevents closing-tag text from changing the app document and permits normal relative module imports. Do not execute code in Node.js. A small, origin/window-checked and bounded diagnostics protocol may report errors; it is not a workspace command/API bridge.

## Acceptance before product integration

Run an isolated browser probe for module imports, source text containing closing script/style strings, fonts, forms, media, local storage isolation, parent-DOM denial, application API denial, cross-preview isolation and capability revocation. Record actual failures and supported behavior. A successful probe does not implement the product runtime, persistence, ACL, export or history integration.

## Visual workspace

`docs/design/concepts/workspace-reform-web-authoring.png` is the selected implementation companion under autonomous-work authorization, not user-approved artwork. Match its compact source/split/preview workspace and file tabs. Correct generated defects: remove the duplicate Saved status, do not expose an X that deletes the mandatory HTML channel, and do not mislabel the source as code-free note content. The reading-room site is optional authored sample content, not a restriction on page layouts. Its serif/navy styling is deliberately confined to user-authored content; app defaults remain neutral sans-serif. No plant image is required in a blank user page.
