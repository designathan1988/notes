# Canvas outline and metadata integration

Continue inline under the existing authorization. The current Details outline calls global DOM scrollIntoView, which cannot navigate a transformed canvas. Connect an idea searches for the ordinary editor's Insert link button, absent on canvas. Compact canvas headers also hide the existing tags/property controls, and mobile Page actions lacks direct Details access.

1. Reproduce outline navigation to a distant, internally scrolled note through the real Details panel. Assert readable camera framing and an unchanged durable document version.
2. Extend the existing account/page-scoped workbench editor-request channel with heading and link commands. Keep each editor's navigation with its controller. Ordinary document scrolling is scoped to that editor; canvas navigation uses its camera and note scroll container. No new command store, document body or global DOM event bus.
3. Reuse PageTags and PageProperties inside canvas Details, with existing Pages revisions and ACL. Add a direct Page details action for mobile. Keep these contextual controls off the main spatial stage.
4. Route Connect an idea through the existing LinkPicker. Canvas page/URL insertion must create its own note rather than write into an unrelated selection. Preserve normal inline linking. Read-only users can navigate but cannot create links or edit metadata.
5. Test desktop/mobile navigation, internal scrolling, no body writes, viewer access, metadata persistence and link creation/reload; recheck ordinary document commands. Inspect actual rendering, run appropriate gates and commit locally. Interchange and whole-product acceptance remain open.
