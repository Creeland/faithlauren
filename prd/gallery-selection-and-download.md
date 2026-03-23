# PRD: Gallery Selection, Lightbox, and Download Experience

## Problem Statement

Customers visiting a photo gallery can only download all photos at once via a single "Download All" button that zips every image. There is no way to select specific photos for download, no lightbox for viewing individual photos full-size, and no feedback while the zip is being prepared. On mobile, the download button scrolls out of view in large galleries. The experience lacks the polish and control customers expect from a professional photography gallery.

## Solution

Transform the gallery into a two-mode experience — **view mode** and **selection mode** — with a sticky toolbar, a lightbox for full-size photo viewing, and selective download with progress feedback.

**View mode (default):** Tapping a photo opens a lightbox showing the full-size image. A slim sticky bar at the top of the viewport shows brief instructions explaining how to use the gallery, a "Select" button to enter selection mode, and a "Download All" button.

**Selection mode:** Activated via the "Select" button. Tapping photos toggles selection with a blue checkmark badge and blue border. The sticky bar updates to show "Download Selected (N)" and "Cancel." The lightbox is disabled while in selection mode. After downloading, the selection clears and the user returns to view mode.

A loading spinner with "Preparing download..." appears in the sticky bar while a zip is being generated, for both "Download All" and "Download Selected."

## User Stories

1. As a customer, I want to tap a photo to see it full-size in a lightbox, so that I can view the detail and quality of each image.
2. As a customer, I want to easily close the lightbox by tapping an X button or clicking outside the image, so that I can return to browsing quickly.
3. As a customer, I want to download all photos in the gallery with one button, so that I can get everything at once without selecting individually.
4. As a customer, I want to enter a selection mode, so that I can pick specific photos to download.
5. As a customer, I want the "Select" button to be clearly visible and explained by brief instructions, so that I understand how to use the selection feature.
6. As a customer, I want to see a blue checkmark and blue border on photos I've selected, so that I have clear visual feedback on my selections.
7. As a customer, I want to tap multiple photos to build up a selection, so that I can curate exactly which images I want to download.
8. As a customer, I want a "Select All" shortcut, so that I can quickly select every photo and then deselect the ones I don't want.
9. As a customer, I want to see a "Download Selected (N)" button showing how many photos are selected, so that I know what I'm about to download.
10. As a customer, I want the "Download All" button to disappear when I start selecting photos and be replaced by "Download Selected," so that the interface is clean and unambiguous.
11. As a customer, I want the instructions to disappear once I start selecting photos, so that the sticky bar stays slim and focused.
12. As a customer, I want a "Cancel" button in selection mode, so that I can exit selection mode without downloading.
13. As a customer, I want my selection to clear automatically after a successful download, so that I start fresh without manual cleanup.
14. As a customer, I want to return to view mode automatically after downloading selected photos, so that I can continue browsing.
15. As a customer, I want a loading spinner with "Preparing download..." while the zip is being created, so that I know the download is in progress and haven't lost my action.
16. As a customer on mobile, I want the download and selection controls to stay visible at the top of the screen as I scroll, so that I can always access them without scrolling back up.
17. As a customer on mobile, I want to tap photos to select them just like on desktop, so that the experience feels native and intuitive.
18. As a customer on mobile, I want to swipe down on the lightbox to close it, so that it feels natural on a touch device.
19. As a customer, I want the gallery to remain password-protected as it is today, so that only authorized people can view and download my photos.

## Implementation Decisions

### Modules

**1. Selection State Hook (`usePhotoSelection`)**
A React hook that encapsulates all selection logic: toggling selection mode on/off, managing the set of selected photo IDs, and providing select/deselect/selectAll/clearAll actions. The gallery page consumes this hook and passes state down to child components. This keeps selection logic isolated and testable.

**2. Sticky Toolbar Component**
A fixed-position bar at the top of the viewport that renders three visual states:
- **Default (view mode):** Brief instructions + "Select" button + "Download All" button
- **Selection mode:** "Select All" + "Download Selected (N)" + "Cancel" button. Instructions are hidden.
- **Downloading:** Loading spinner + "Preparing download..." text. Buttons are disabled.

The toolbar must be slim and visually prominent — white/light background with a subtle shadow to separate it from gallery content. Blue accent color for selection-related actions.

**3. Photo Grid with Selection Overlay**
Enhance the existing masonry grid so each photo responds to the current mode:
- **View mode:** Tap/click opens lightbox.
- **Selection mode:** Tap/click toggles selection. Selected photos display a blue checkmark badge in the corner and a blue border. No lightbox opens.

The overlay and checkmark should be CSS-only where possible (pseudo-elements or simple absolutely-positioned elements) to avoid layout shifts.

**4. Lightbox Component**
A full-screen overlay that displays a single photo at full resolution. Features:
- Dark backdrop with the photo centered and scaled to fit.
- Close via X button (top-right corner), clicking/tapping the backdrop, or pressing Escape.
- On mobile, swipe-down gesture to dismiss.
- No previous/next navigation — single photo view only.
- Prevents body scroll while open.

**5. Selective Download API**
Extend the existing download route (`/api/gallery/[slug]/download`) to accept an optional `photoIds` query parameter (comma-separated list of photo IDs). If `photoIds` is present, only zip those photos. If absent, zip all photos (preserving current behavior). Same archiver streaming approach, same authentication check.

### Architectural Decisions

- **Client-side selection state only.** Selection is ephemeral UI state — no need to persist to the database. The `usePhotoSelection` hook manages everything in React state.
- **Single download endpoint.** Rather than creating a separate route for selective download, extend the existing route with an optional parameter. This avoids code duplication.
- **Blue accent for selection UI.** Standard UX convention for selection, distinct from the site's terra cotta branding. Keeps selection state instantly recognizable.
- **No long-press to enter selection mode on mobile.** Selection mode is entered exclusively via the "Select" button. This avoids conflicts with native browser gestures and is more discoverable for users who aren't familiar with the long-press pattern.
- **Lightbox is a client component.** Uses React portal to render outside the normal DOM hierarchy, preventing z-index conflicts with the sticky toolbar.

## Testing Decisions

The existing codebase does not have a test suite. No tests are planned for this feature unless explicitly requested in the future.

If tests are added later, good candidates would be:
- The `usePhotoSelection` hook (unit test): verify select/deselect/selectAll/clear behavior, mode toggling, and count accuracy.
- The download API route (integration test): verify that passing `photoIds` filters the zip contents correctly.

Good tests should verify external behavior (what the user sees or receives), not implementation details (internal state shape, specific DOM structure).

## Out of Scope

- **Previous/next navigation in lightbox.** The lightbox shows a single photo only. Carousel-style navigation may be added in a future iteration.
- **Drag-to-select or lasso selection.** Selection is tap/click per photo only.
- **Download progress percentage.** The streaming zip approach does not support true percentage progress. A spinner with text is used instead.
- **Individual photo download from lightbox.** Users download via the toolbar, not from within the lightbox.
- **Favorites or persistent selections.** Selections are ephemeral and exist only during the current session.
- **Changes to the admin gallery management interface.** This PRD covers only the customer-facing gallery experience.

## Further Notes

- The sticky toolbar will need a `z-index` higher than the gallery content but lower than the lightbox overlay.
- The lightbox should use the original Uploadthing URL (not the Next.js optimized version) to show the highest quality image.
- The existing password protection flow is untouched — all new features operate within the authenticated gallery view.
- On very large galleries (100+ photos), the zip preparation may take time. The spinner provides feedback, but no timeout or cancellation mechanism is planned for the initial implementation.
