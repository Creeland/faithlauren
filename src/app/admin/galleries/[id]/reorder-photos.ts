/**
 * Computes the new photo order after dropping selected photos at a target position.
 *
 * 1. Remove all selected photos from the array.
 * 2. Find the insertion index in the remaining array (where the `overId` photo is).
 * 3. Splice the selected photos (preserving their relative order) at the insertion index.
 * 4. Return the reordered array.
 */
export function computeReorder<T extends { id: string }>(
  photos: T[],
  selectedIds: Set<string>,
  activeId: string,
  overId: string
): T[] {
  if (activeId === overId && selectedIds.size <= 1) return photos

  // Ensure the active photo is included in the selection
  const draggedIds = new Set(selectedIds)
  draggedIds.add(activeId)

  // Split into dragged and remaining, preserving relative order
  const dragged: T[] = []
  const remaining: T[] = []
  for (const photo of photos) {
    if (draggedIds.has(photo.id)) {
      dragged.push(photo)
    } else {
      remaining.push(photo)
    }
  }

  // Find insertion index: where `overId` sits in the remaining array
  let insertIndex = remaining.findIndex((p) => p.id === overId)

  if (insertIndex === -1) {
    // overId is one of the dragged photos — find the original position of overId
    // and determine where it falls relative to the remaining array
    const overOriginalIndex = photos.findIndex((p) => p.id === overId)
    // Count how many remaining photos come before the over position
    insertIndex = 0
    for (const photo of remaining) {
      const idx = photos.findIndex((p) => p.id === photo.id)
      if (idx < overOriginalIndex) {
        insertIndex++
      } else {
        break
      }
    }
  } else {
    // Determine if we should insert before or after the over item
    // by comparing the active item's original position to the over item's position
    const activeOriginalIndex = photos.findIndex((p) => p.id === activeId)
    const overOriginalIndex = photos.findIndex((p) => p.id === overId)
    if (activeOriginalIndex > overOriginalIndex) {
      // Moving backward — insert before the over item
      // insertIndex stays as-is
    } else {
      // Moving forward — insert after the over item
      insertIndex += 1
    }
  }

  // Splice dragged photos into the remaining array at the insertion point
  const result = [...remaining]
  result.splice(insertIndex, 0, ...dragged)
  return result
}
