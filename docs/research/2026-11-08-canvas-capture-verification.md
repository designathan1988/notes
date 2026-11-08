# Canvas stage capture

## Corrected behavior

Pasting into the canvas background creates a new rich note. Dropping text, HTML, a URL or files onto the background uses the drop's world coordinates. Existing note text remains unchanged. Pasting inside a rich note retains the ordinary editor behavior.

The original native Ctrl+V regression was reproduced before the repair: the canvas consumed V as the Select shortcut, so no paste event arrived and the card count remained one. Tool shortcuts now require no Ctrl, Meta or Alt modifier. Stage capture runs before the editor's ordinary paste/drop handlers and excludes rich-note and form targets.

The existing clipboard converter, sanitizer, attachment uploader and canonical document retain ownership. A small canvas insertion adapter resolves the new note by stable ID for every asynchronous insertion. It neither follows a later selection nor rewrites the complete document. Selection updates are conditional on the destination still having focus.

If a pending destination is removed or becomes read-only, the source remains available through Save original and Retry. The existing failed-file presentation distinguishes upload failure from insertion failure. Retry remains disabled for a read-only editor. Uploading from the media chooser, file drop and retry share one canvas insertion path.

## Native-browser evidence

Three regression scenarios cover actual clipboard HTML plus native Ctrl+V, file drop with an owned image, delayed embedded-image conversion while typing in another note, and deletion of a pending destination followed by saving/retrying the retained original. Each scenario verifies Saved and durable reload. The deletion case verifies a usable downloadable original rather than only an error message.

During test development, pressing a key through a locator on an inherited contenteditable child blurred the real editing host. The typing scenario now clicks the note and sends keyboard input through the page, matching native interaction. No nested editing host was introduced to accommodate the test.

The complete behavior suite passed 212 tests across 42 files in 72.15 seconds. All 86 browser scenarios passed in 5.0 minutes, including the three new capture cases. Typecheck and the production build passed for this batch. The build still reports the existing initial/source-editor chunk-size warnings (788.01 kB and 531.32 kB minified); those warnings were not suppressed. The final source check reported no whitespace errors.

A separate read-only release review inspected this batch together with connection presentation and concurrent topology. It reported no concrete new Critical or Important finding. That source inspection is supplementary evidence, not a replacement for the browser gate or a declaration that remaining product requirements are implemented.

The integrated visual browser was unavailable during final closure: `getBrowser({id: 'iab'})` returned `Browser is not available: iab`, and the surface inventory contained no browsers. The user-authorized Playwright workflow remained the validation path. It captured the existing Product direction page at 1487×1058 and 390×844 with no page errors or horizontal overflow; both resulting images were inspected. Earlier canvas desktop/mobile design evidence remains in the presentation report and is not relabelled as a fresh stage-capture screenshot.

## Limits

Pending originals are held by the existing mounted editor's failure queue. This batch does not introduce durable, cross-page storage of arbitrary in-flight file blobs. Canvas containment/resize, spatial history/template previews, JSON Canvas interchange, metadata navigation and the remaining whole-product acceptance matrix retain their explicitly open status in the original plan.
