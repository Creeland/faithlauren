"use client"

import { useCallback, useState } from "react"

export function useAdminPhotoSelection(photoIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [anchor, setAnchor] = useState<string | null>(null)

  const handleClick = useCallback(
    (id: string, event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) => {
      const isMeta = event.metaKey || event.ctrlKey

      if (event.shiftKey && anchor !== null) {
        // Shift+click: select range from anchor to clicked
        const anchorIndex = photoIds.indexOf(anchor)
        const clickedIndex = photoIds.indexOf(id)
        if (anchorIndex === -1 || clickedIndex === -1) return

        const start = Math.min(anchorIndex, clickedIndex)
        const end = Math.max(anchorIndex, clickedIndex)
        const range = photoIds.slice(start, end + 1)

        if (isMeta) {
          // Cmd+Shift+click: add range to existing selection
          setSelectedIds((prev) => {
            const next = new Set(prev)
            for (const photoId of range) {
              next.add(photoId)
            }
            return next
          })
        } else {
          // Shift+click: replace selection with range
          setSelectedIds(new Set(range))
        }
        // Don't update anchor on shift+click
      } else if (isMeta) {
        // Cmd+click: toggle individual photo
        setSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(id)) {
            next.delete(id)
          } else {
            next.add(id)
          }
          return next
        })
        setAnchor(id)
      } else {
        // Plain click: select only this photo
        setSelectedIds(new Set([id]))
        setAnchor(id)
      }
    },
    [photoIds, anchor]
  )

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setAnchor(null)
  }, [])

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    anchor,
    handleClick,
    clearSelection,
  }
}
