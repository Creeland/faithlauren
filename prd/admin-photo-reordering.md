# Admin Photo Reordering

## Problem Statement

There is no way for an admin to control the display order of photos in a gallery. Photos are currently ordered by upload time, and if the admin wants to rearrange them — for example, to lead with the strongest shots or group by scene — there is no mechanism to do so.

## Solution

Add drag-and-drop reordering to the admin gallery page. The admin can drag individual photos or multi-select photos (using Cmd+click and Shift+click) and drag them as a group to a new position. Changes auto-save immediately. The photo grid keeps its current 2-column (mobile) / 4-column (desktop) layout, with order flowing left-to-right, top-to-bottom.

## User Stories

1. As an admin, I want to drag a single photo to a new position in the grid, so that I can control the gallery's visual narrative.
2. As an admin, I want the new order to auto-save when I drop a photo, so that I don't have to remember to click a save button.
3. As an admin, I want to click a photo to select it (deselecting all others), so that I can prepare to drag just that one.
4. As an admin, I want to Cmd+click (Ctrl+click on Windows) photos to toggle individual selections, so that I can pick non-contiguous photos to move together.
5. As an admin, I want to Shift+click a photo to select a range from the last-clicked photo to the current one, so that I can quickly select a contiguous block.
6. As an admin, I want to drag a group of selected photos to a new position, so that the entire group lands together at the drop target.
7. As an admin, I want to see a stack thumbnail with a count badge while dragging multiple photos, so that I know how many photos I'm moving.
8. As an admin, I want to see a highlighted gap in the grid showing where photos will land as I drag, so that I can place them precisely.
9. As an admin, I want dragging an unselected photo (when others are selected) to clear my selection and drag only that photo, so that the behavior is predictable.
10. As an admin, I want to see a toast error and have the grid revert if a save fails, so that I know something went wrong and don't lose track of the intended order.
11. As an admin, I want the public gallery to reflect my chosen order immediately after reordering, so that clients see the photos in the order I intended.
12. As an admin, I want the reorder interaction to work on both desktop and mobile (touch drag), so that I can manage galleries from any device.
13. As an admin, I want the existing delete button on each photo to continue working as-is, independent of selection state.

## Implementation Decisions

### Modules

- **`PhotoGrid` client component (new):** Extracted from the current inline photo grid in the admin gallery page. Owns rendering, selection state, drag-and-drop interaction, optimistic reorder, and auto-save. Contains the grid layout (2-col mobile / 4-col desktop), photo thumbnails, delete buttons, and filenames.
- **`usePhotoReorder` hook (new):** Manages optimistic photo order state, computes new `sortOrder` values after a drop, calls the `reorderPhotos` server action, and rolls back on failure. Pure reorder logic with no UI concerns — takes a photo array and returns the reordered array plus handler functions.
- **`useAdminPhotoSelection` hook (new):** Handles click, Cmd+click, and Shift+click selection. Tracks selected IDs and the last-clicked photo (anchor) for Shift ranges. Separate from the public gallery's `usePhotoSelection` hook because behaviors differ (no selection mode toggle, always active, range selection support).
- **`reorderPhotos` server action (existing):** Already accepts `{ id, sortOrder }[]` and a `galleryId`. Should be wrapped in a Prisma transaction for atomicity instead of using `Promise.all` with individual updates.
- **Admin gallery page (modify):** Pass the photo array to the new `PhotoGrid` client component instead of rendering the grid inline.

### Drag-and-drop approach

- Use `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop. This library supports multi-column grids, keyboard accessibility, and touch devices out of the box.
- Custom drag overlay renders a stack thumbnail with count badge when dragging multiple selected photos.
- Drop indicator renders as a highlighted gap/line at the insertion point.

### Selection behavior

- **Click** (no modifier): Deselect all, select clicked photo.
- **Cmd+click** (Ctrl+click): Toggle clicked photo without affecting others.
- **Shift+click**: Select range from anchor (last clicked) to current photo.
- **Drag unselected photo**: Clear selection, drag only that photo.
- **Drag selected photo**: Drag all selected photos as a group.

### Auto-save flow

1. User drops photo(s) at new position.
2. Optimistically update the local state to reflect new order.
3. Fire `reorderPhotos` server action in the background.
4. On success: no visible change (already reflected).
5. On failure: revert to previous order, show toast error message.

### Reorder computation

When selected photos are dropped at a target position:
1. Remove all selected photos from the array.
2. Find the insertion index in the remaining array.
3. Splice the selected photos (preserving their relative order) at the insertion index.
4. Assign new sequential `sortOrder` values (0, 1, 2, ...) to all photos.
5. Only send changed `sortOrder` values to the server action for efficiency.

## Testing Decisions

Good tests verify external behavior through the module's public interface, not implementation details. Tests should remain valid even if the internal approach changes.

### Modules to test

- **`usePhotoReorder` hook:** Test the reorder computation logic — given an initial photo array, a set of selected IDs, and a drop target index, verify the resulting order. Test edge cases: dropping at the start, end, same position, single photo, all photos selected, adjacent photos.
- **`useAdminPhotoSelection` hook:** Test selection logic — click selects one and deselects others, Cmd+click toggles, Shift+click selects range from anchor. Test edge cases: Shift+click with no anchor, Shift+click backwards, Cmd+click then Shift+click.

### Prior art

The existing `use-photo-selection.ts` hook in the public gallery provides a pattern for selection state management, though it lacks range selection. Test patterns should follow the same hook-testing approach.

## Out of Scope

- Batch photo deletion (selecting multiple photos and deleting them at once).
- Arrow key or button-based reordering — drag-and-drop only.
- Reordering on the public-facing gallery (client-facing gallery remains read-only).
- Changes to the public gallery's existing selection/download functionality.
- Undo/redo for reorder operations.

## Further Notes

- The `sortOrder` field already exists on the Photo model and is already used to order photos in both admin and public queries (`orderBy: { sortOrder: "asc" }`).
- The `reorderPhotos` server action already exists and is functional — it just needs a UI and a transaction wrapper.
- The public gallery will automatically reflect reorder changes since it queries by `sortOrder`.
