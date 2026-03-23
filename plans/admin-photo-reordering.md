# Plan: Admin Photo Reordering

> Source PRD: prd/admin-photo-reordering.md

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: No changes needed — `Photo.sortOrder` (integer, default 0) already exists and is used by both admin and public gallery queries (`orderBy: { sortOrder: "asc" }`)
- **Server action**: `reorderPhotos` already exists in the photo actions module. Needs to be wrapped in a Prisma transaction for atomicity instead of `Promise.all` with individual updates.
- **Route**: No new routes — all work happens on the existing `/admin/galleries/[id]` page
- **Library**: `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop. Supports multi-column grids, touch devices, and keyboard accessibility.
- **UI pattern**: The inline photo grid in the admin gallery page gets extracted into a client component. The server page passes the photo array as props.
- **Auto-save pattern**: Optimistic local state update on drop, fire server action in background, revert + toast on failure.

---

## Phase 1: Single photo drag-and-drop with auto-save

**User stories**: 1, 2, 8, 10, 11, 13

### What to build

Extract the admin photo grid into a client component and add single-photo drag-and-drop reordering using `@dnd-kit`. When the admin drags a photo to a new position in the grid, the order updates optimistically and auto-saves to the database. A highlighted gap shows where the photo will land during drag. If the save fails, the grid reverts to the previous order and a toast error appears. The existing delete button on each photo continues to work as-is. The public gallery immediately reflects the new order since it already queries by `sortOrder`.

### Acceptance criteria

- [ ] Photo grid is a client component receiving photos as props
- [ ] Admin can drag a single photo to a new position in the 2-col (mobile) / 4-col (desktop) grid
- [ ] Order flows left-to-right, top-to-bottom
- [ ] A highlighted gap/indicator shows the drop target while dragging
- [ ] Dropping a photo auto-saves the new order (no save button)
- [ ] The `reorderPhotos` server action uses a Prisma transaction
- [ ] On save failure, the grid reverts to the previous order and a toast error is shown
- [ ] Delete buttons continue to work on each photo
- [ ] Public gallery reflects the new order after reordering

---

## Phase 2: Multi-select (click, Cmd+click, Shift+click)

**User stories**: 3, 4, 5

### What to build

Add multi-select capability to the photo grid via a selection hook. Clicking a photo selects it and deselects all others. Cmd+click (Ctrl+click on Windows) toggles an individual photo's selection without affecting others. Shift+click selects a contiguous range from the last-clicked photo (anchor) to the current photo. Selected photos get a visual indicator (ring/highlight). This phase wires up selection state and visuals only — drag behavior for groups comes in Phase 3.

### Acceptance criteria

- [ ] Clicking a photo selects it and deselects all others
- [ ] Cmd+click (Ctrl+click) toggles a photo's selection without affecting other selections
- [ ] Shift+click selects a range from the anchor photo to the clicked photo
- [ ] Selected photos have a visible selection indicator
- [ ] Selection hook has tests covering: single click, Cmd+click toggle, Shift+click range, Shift+click with no prior anchor, Shift+click in reverse direction

---

## Phase 3: Multi-select drag-and-drop

**User stories**: 6, 7, 9, 12

### What to build

Wire the multi-select state into the drag-and-drop system. Dragging a selected photo moves all selected photos as a group — they land together at the drop position, preserving their relative order. The drag overlay shows a stack thumbnail with a count badge (e.g., "3 photos"). Dragging an unselected photo when others are selected clears the selection and drags only that photo. The reorder computation removes selected photos from the array, inserts them at the drop index, and assigns new sequential `sortOrder` values. Touch drag works on mobile.

### Acceptance criteria

- [ ] Dragging a selected photo moves all selected photos as a group
- [ ] Selected photos land together at the drop position, preserving their relative order
- [ ] Drag overlay shows a stack thumbnail with a count badge
- [ ] Dragging an unselected photo clears the selection and drags only that photo
- [ ] Drop gap indicator works correctly for group drops
- [ ] Auto-save fires after group reorder with the same optimistic update + revert-on-failure behavior
- [ ] Reorder computation has tests covering: group drop at start, middle, end; single photo drop; dropping at same position; all photos selected; adjacent selections
- [ ] Touch drag works on mobile devices
