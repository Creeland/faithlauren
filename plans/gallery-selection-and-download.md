# Plan: Gallery Selection, Lightbox, and Download Experience

> Source PRD: `prd/gallery-selection-and-download.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: No new routes. The existing `/gallery/[slug]` page and `/api/gallery/[slug]/download` endpoint are extended in place.
- **Schema**: No schema changes. Selection is ephemeral client-side state only.
- **Key models**: `Gallery` and `Photo` (Prisma) — unchanged. Photos are identified by their `id` (cuid) for selection and selective download.
- **Authentication**: Existing cookie-based gallery access (`gallery-${slug}-access`) is unchanged. The download API already checks this cookie.
- **Download API contract**: The existing GET endpoint at `/api/gallery/[slug]/download` gains an optional `photoIds` query parameter (comma-separated cuid list). When present, only those photos are zipped. When absent, all photos are zipped (preserving current behavior).
- **Z-index layering**: Sticky toolbar < Lightbox overlay. The toolbar is always visible except when lightbox is open.
- **Color**: Blue accent (`#3b82f6` / Tailwind `blue-500`) for all selection UI — checkmarks, borders, active buttons. Distinct from the site's terra cotta branding.
- **Client boundary**: The gallery page is currently a server component. The interactive gallery content (photo grid, toolbar, lightbox) will be extracted into a client component that receives the photo array and gallery metadata as props from the server component.

---

## Phase 1: Sticky Toolbar + Download All Migration

**User stories**: 3, 5, 15, 16

### What to build

Replace the current inline "Download All" link with a slim sticky toolbar fixed to the top of the viewport. The toolbar sits above the gallery content and contains:

- Brief instructions explaining that photos can be tapped to view, and that a "Select" button enables multi-select for download.
- A "Download All" button.
- A "Select" button (non-functional in this phase — it will be wired up in Phase 3).

When "Download All" is clicked, the toolbar transitions to a downloading state: buttons are replaced by a loading spinner and "Preparing download..." text. The download is triggered via `fetch` to the existing API endpoint, and the resulting blob is saved as a file. Once the download completes (or fails), the toolbar returns to its default state.

This requires extracting the authenticated gallery view into a client component, since the toolbar needs interactive state (downloading vs. idle).

### Acceptance criteria

- [ ] The inline "Download All" link is removed from the gallery page
- [ ] A slim sticky toolbar is fixed to the top of the viewport, visible at all times while scrolling
- [ ] The toolbar displays brief instructions and a "Download All" button
- [ ] A "Select" button is visible in the toolbar (does nothing yet)
- [ ] Clicking "Download All" shows a spinner with "Preparing download..." in the toolbar
- [ ] The zip file downloads successfully via fetch + blob (not a direct link navigation)
- [ ] After download completes, the toolbar returns to its default state
- [ ] The toolbar is responsive and works well on mobile viewports
- [ ] Password protection continues to work — unauthenticated users see the password form, not the toolbar

---

## Phase 2: Lightbox

**User stories**: 1, 2, 18

### What to build

Add a lightbox overlay that opens when a customer taps/clicks a photo in the gallery. The lightbox displays the photo at full resolution (using the original Uploadthing URL, not the Next.js optimized version) centered on a dark backdrop.

The lightbox can be closed via:
- An X button in the top-right corner
- Clicking/tapping the dark backdrop outside the photo
- Pressing the Escape key
- Swiping down on mobile (touch gesture)

While the lightbox is open, body scrolling is prevented. The lightbox renders via a React portal to avoid z-index conflicts, and sits above the sticky toolbar in the stacking order.

### Acceptance criteria

- [ ] Tapping a photo in the gallery opens a full-screen lightbox overlay
- [ ] The lightbox displays the photo at full resolution using the original URL
- [ ] Dark semi-transparent backdrop behind the photo
- [ ] X button in the top-right corner closes the lightbox
- [ ] Clicking the backdrop closes the lightbox
- [ ] Pressing Escape closes the lightbox
- [ ] Swiping down on mobile closes the lightbox
- [ ] Body scroll is locked while lightbox is open
- [ ] Lightbox renders above the sticky toolbar (higher z-index)
- [ ] Photos in the grid remain clickable and open the correct photo in the lightbox

---

## Phase 3: Selection Mode + Selective Download

**User stories**: 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 19

### What to build

Wire up the full selection mode experience end-to-end.

**Selection state hook**: A React hook that manages selection mode (on/off), the set of selected photo IDs, and actions: toggle a photo, select all, clear all. The gallery component consumes this hook.

**Selection mode activation**: Clicking the "Select" button in the sticky toolbar enters selection mode. The toolbar transitions to show "Select All," "Download Selected (N)," and "Cancel."

**Photo grid in selection mode**: When selection mode is active, tapping a photo toggles its selection instead of opening the lightbox. Selected photos display a blue checkmark badge in the corner and a blue border. Unselected photos have no overlay.

**Toolbar state transitions**:
- Default (view mode): Instructions + "Select" + "Download All"
- Selection mode (no photos selected yet): "Select All" + "Download Selected (0)" (disabled) + "Cancel"
- Selection mode (photos selected): "Select All" + "Download Selected (N)" + "Cancel". Instructions are hidden. "Download All" is not shown.
- Downloading: Spinner + "Preparing download..."

**Selective download API**: Extend the existing download route to read an optional `photoIds` query parameter. When present, filter the gallery's photos to only include those IDs before zipping. Validate that all requested IDs belong to the gallery.

**Post-download behavior**: After a successful selective download, clear the selection and return to view mode automatically.

### Acceptance criteria

- [ ] "Select" button in toolbar enters selection mode
- [ ] In selection mode, tapping a photo toggles its selected state (lightbox does not open)
- [ ] Selected photos show a blue checkmark badge and blue border
- [ ] Toolbar shows "Select All," "Download Selected (N)," and "Cancel" in selection mode
- [ ] "Download All" button is hidden when in selection mode
- [ ] Instructions disappear when in selection mode
- [ ] "Select All" selects every photo in the gallery
- [ ] "Cancel" exits selection mode and clears all selections
- [ ] "Download Selected (N)" triggers a zip download of only the selected photos
- [ ] The download API accepts a `photoIds` query parameter and zips only those photos
- [ ] The API validates that requested photo IDs belong to the specified gallery
- [ ] After download completes, selection clears and view mode is restored automatically
- [ ] Spinner with "Preparing download..." shows during selective download
- [ ] Selection works via tap on mobile devices
- [ ] Password protection remains enforced for the download API with photo IDs
