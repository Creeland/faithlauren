# QA Report: Portfolio Groups (Issue #7)

**Date:** 2026-07-05
**Method:** End-to-end verification against a locally running app (`next dev`, port 3100) backed by an isolated SQLite copy of the schema (`TURSO_DATABASE_URL=file:./qa.db`). The production Turso database was never touched. Admin flows were driven as a real authenticated HTTP client: login via the credentials form (progressive-enhancement server-action POST), form-based actions via their `$ACTION_REF`/`$ACTION_KEY` hidden fields, and JS-invoked actions (assign/remove/reorder) via `Next-Action` header POSTs with React flight encoding — i.e., the exact wire protocol the browser uses.

**Seed dataset:** groups "Weddings" (2 portfolios, cover, `aspect-3/4`), "Portraits" (1 portfolio, cover, `aspect-4/5`), "Empty Group" (0 portfolios, cover), "No Cover" (1 portfolio, no cover); portfolios with 1–3 photos each plus one ungrouped portfolio ("Wanderer").

## Results — all testable items PASS

### Admin: Group Management

- ✅ Create group with title + description via `/admin/portfolio-groups/new` — 303 redirect, slug auto-generated (`qa-test-group`), appears in admin list with correct title and **0 portfolios**
- ✅ Cover image + aspect ratio set via `setGroupCoverImage` — persisted to DB (`coverImageUrl`, `aspectRatio: aspect-2/3`) and rendered on edit page
- ✅ Edit title/description via edit form — persisted in admin and reflected on the public group page
- ✅ Reorder groups (`reorderGroups`) — front-page order flipped accordingly, then reverted
- ✅ Delete group containing portfolios — **blocked**, error message "Cannot delete a group that still contains portfolios" rendered, group intact
- ✅ Remove all portfolios from a group, then delete — succeeds with 303 redirect, group gone

### Admin: Portfolio Assignment

- ✅ Assign portfolio to group — appears in the group's admin portfolio list and on the public group page
- ✅ Portfolio list shows group name (accent color) for grouped portfolios: Weddings/Portraits/No Cover all correct
- ✅ Ungrouped portfolio shows "Ungrouped"
- ✅ Reorder portfolios within group (`reorderPortfolios`) — sortOrder persisted in DB and public group page order updated
- ✅ Remove portfolio from group — becomes ungrouped, disappears from group page, still reachable at its direct URL

### Front Page

- ✅ Only non-empty groups with a cover image appear in "Selected Work" (Weddings, Portraits)
- ✅ Empty group hidden; group without cover image hidden (the not-null cover filter is intentional per commit 815cb46)
- ✅ Correct cover image, title, and aspect-ratio class per group
- ✅ Ordered by sortOrder (verified before and after reorder)
- ✅ Group descriptions NOT shown on cards
- ✅ Cards link to `/portfolio/[group-slug]`
- ✅ Individual portfolios not listed on the front page

### Group Page

- ✅ Shows group title, description, SEO `<title>`
- ✅ Portfolios in masonry grid with first-photo covers
- ✅ Ordered by sortOrder
- ✅ Portfolio cards link to `/portfolio/[group-slug]/[portfolio-slug]`
- ✅ Empty group page shows "No portfolios in this group yet."

### Portfolio Page

- ✅ `/portfolio/[group-slug]/[portfolio-slug]` renders all photos in order, SEO title
- ✅ Back link → group page, labeled "Back to {Group}"
- ✅ Direct URL works
- ✅ Bonus: old flat URL `/portfolio/[portfolio-slug]` 307-redirects to the canonical nested URL
- ✅ Bonus: ungrouped portfolio renders at `/portfolio/[slug]` with "Back to site" → `/`

### Edge Cases

- ✅ 404 for non-existent group slug
- ✅ 404 for non-existent portfolio slug within a valid group
- ✅ 404 for a valid portfolio under the wrong group slug
- ✅ Empty group hidden from front page; appears immediately after gaining a portfolio; hidden again after it's removed

### Responsive

- ✅ Front page and group page grids use `columns-1 sm:columns-2 lg:columns-3`; portfolio photo grid uses the same breakpoints
- ✅ Compiled Tailwind CSS contains all utilities the DB can emit (`columns-1`, `sm:columns-2`, `lg:columns-3`, `aspect-3/4`, `aspect-2/3`, `aspect-4/5`) — important since aspect classes come from the database at runtime

## Not covered (environment limits)

- **Pointer drag gestures** (dnd-kit) — no browser in the sandbox; the underlying `reorderGroups`/`reorderPortfolios` server actions and their persistence + public-page effects were verified instead.
- **Actual file upload through UploadThing** — external service; the `setGroupCoverImage` action that persists the upload result was verified with a URL.
- **Visual viewport rendering** — responsive behavior verified at the CSS-class level, not by resizing a real browser.

## Bugs found

None.
