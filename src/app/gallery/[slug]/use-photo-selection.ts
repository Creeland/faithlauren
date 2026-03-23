"use client"

import { useCallback, useState } from "react"

export function usePhotoSelection(allPhotoIds: string[]) {
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(allPhotoIds))
  }, [allPhotoIds])

  const clearAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const enterSelecting = useCallback(() => {
    setSelecting(true)
  }, [])

  const exitSelecting = useCallback(() => {
    setSelecting(false)
    setSelectedIds(new Set())
  }, [])

  return {
    selecting,
    selectedIds,
    selectedCount: selectedIds.size,
    toggle,
    selectAll,
    clearAll,
    enterSelecting,
    exitSelecting,
  }
}
