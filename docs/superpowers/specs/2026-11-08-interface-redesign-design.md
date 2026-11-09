# Interface redesign: Prism

Date: 2026-11-08. Supersedes the "Quiet Workbench" visual treatment in `docs/design/*`. The user delegated all visual decisions ("don't ask, surprise me"). Their complaint about the old UI: neutral had become lifeless, boring, without personality.

## Standing constraints (from earlier user decisions)

No green palette, no serif type, no heavy graphite/blue chrome, continuous Notion-style document blocks (never block cards), page details closed by default. Appearance customization keeps working: `--canvas --ink --sidebar --soft --accent --selected --muted --rule --ui --prose --heading --code --ui-size --body-size --body-leading --density` stay the public token names.

## Direction

**A luminous studio.** The app frame is a soft ambient backdrop; work happens on one floating sheet. Neutral surfaces carry the content, and a single signature — the *Prism* spectrum (iris → violet → rose) — gives the product its identity. Color is used to mean something: what kind of thing a page is, what is selected, what needs attention.

Why this direction: knowledge tools are used for hours, so the base must stay calm and legible (neutral zinc surfaces, high text contrast). Personality comes from three places that don't fatigue: a distinctive brand gradient used sparingly, per-kind color coding that also aids recognition, and depth (sheet elevation, soft shadows, translucent bars) instead of flat gray boxes.

## System

- **Type:** Geist Sans (variable) for UI and prose, Geist Mono for code, keyboard hints and tabular numbers. UI 14px; document body 16px / 1.7; page title 40px / 700 / −0.03em; headings 28/22/18px.
- **Neutral scale:** zinc-based, slightly cool. Light: backdrop `#f4f4f6`, sheet `#ffffff`, ink `#18181b`, muted `#71717a`, rule `#e7e7ea`. Dark: backdrop `#09090b`, sheet `#131316`, ink `#ececf0`, muted `#9a9aa5`, rule `#26262c`.
- **Accent:** iris `#6d5dfc` (dark `#8b7dff`), soft tint for selection; spectrum gradient `#6d5dfc → #a855f7 → #ec4899` for brand mark, primary call to action, active-tab indicator and hero surfaces only.
- **Kind colors** (icon tiles): document iris, database amber, canvas rose, record sky, website violet, template orange. Never green.
- **Shape and depth:** radius 6 (controls) / 10 (menus, cards) / 14 (sheet) / 18 (dialogs). Shadows xs–xl, tinted with ink at low alpha. Topbar and dialogs use backdrop blur.
- **Motion:** 120–200ms ease-out for hover/press/panels; respects `prefers-reduced-motion`.
- **Themes:** light, dark and system, chosen from the account menu; stored per browser.

## Layout

- **Sidebar (264px)** sits directly on the backdrop with no border: brand workspace switcher, prominent search pill with ⌘K, destinations (Home first), favorites and page tree with colored kind icons, account footer. The active item is a raised white pill.
- **Sheet:** main column inset 8px with radius 14px, hairline border and soft shadow. The translucent topbar holds history, pill tabs, breadcrumb, status and actions.
- **Home (new destination):** greeting with date, quick-create tiles (page, database, canvas, template), "Jump back in" cards for recently edited pages, favorites, workspace counts. Landing after sign-in is unchanged.
- **Document:** 720px measure, generous vertical rhythm, large page icon tile, colored cover band fallback, quiet gutter controls.
- **Indexes (all pages, databases, canvases, templates):** card-like rows with kind tiles, clear hierarchy, hover elevation.
- **Sign-in:** split screen. Spectrum hero with animated light fields and the product promise on one side, a focused form on the other.

## Non-goals

No change to data, commands, routes or accessible names: the 90 browser scenarios are the regression net. No new runtime dependencies besides the two font packages.

## Verification

Desktop and mobile screenshots of sign-in, home, document, database, graph, canvas, templates, settings and dialogs, in light and dark. Full `npm run check` and browser suite.
