"use client"

import { useState, useCallback, useRef, type MouseEvent } from "react"
import Image from "next/image"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { toast } from "sonner"
import { deletePhoto, reorderPhotos } from "@/app/actions/photo"
import { useAdminPhotoSelection } from "./use-admin-photo-selection"
import { computeReorder } from "./reorder-photos"

type Photo = {
  id: string
  url: string
  filename: string
  caption: string | null
  sortOrder: number
  galleryId: string
}

function SortablePhoto({
  photo,
  isSelected,
  isDraggedInGroup,
  onSelect,
}: {
  photo: Photo
  isSelected: boolean
  isDraggedInGroup: boolean
  onSelect: (id: string, event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const dndPointerDown = listeners?.onPointerDown

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      // Modifier click: handle selection, don't start drag
      e.preventDefault()
      e.stopPropagation()
      onSelect(photo.id, { metaKey: e.metaKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey })
      return
    }
    // No modifier: let dnd-kit handle the pointer event for dragging
    dndPointerDown?.(e as unknown as PointerEvent)
  }

  const handleClick = (e: MouseEvent) => {
    // Plain click (no modifiers, no drag) — select just this photo
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
      onSelect(photo.id, { metaKey: false, ctrlKey: false, shiftKey: false })
    }
  }

  // Hide photos that are part of a multi-drag group (but not the active/dragging one — dnd-kit handles that)
  const hidden = isDraggedInGroup && !isDragging

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${isDragging ? "opacity-30" : ""} ${
        hidden ? "opacity-30" : ""
      } ${isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""}`}
    >
      <div
        className="relative aspect-square overflow-hidden bg-stone-100 cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        {...attributes}
      >
        <Image
          src={photo.url}
          alt={photo.caption || photo.filename}
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover pointer-events-none"
          loading="lazy"
          draggable={false}
        />
      </div>
      {isSelected && (
        <div className="absolute top-1 left-1 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      <form
        action={deletePhoto}
        className="absolute top-1 right-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
      >
        <input type="hidden" name="id" value={photo.id} />
        <button
          type="submit"
          className="bg-red-600 text-white text-xs px-2 py-1 rounded"
        >
          &times;
        </button>
      </form>
      <p className="text-xs text-stone-500 mt-1 truncate">{photo.filename}</p>
    </div>
  )
}

function DragOverlayContent({ photo, count }: { photo: Photo; count: number }) {
  return (
    <div className="relative w-[150px]">
      {/* Stacked card effect for multi-drag */}
      {count > 1 && (
        <>
          <div className="absolute top-2 left-2 w-full aspect-square bg-stone-200 rounded shadow-md" />
          <div className="absolute top-1 left-1 w-full aspect-square bg-stone-100 rounded shadow-md" />
        </>
      )}
      <div className="relative aspect-square overflow-hidden bg-stone-100 rounded shadow-lg ring-2 ring-accent">
        <Image
          src={photo.url}
          alt={photo.caption || photo.filename}
          fill
          sizes="150px"
          className="object-cover"
          draggable={false}
        />
      </div>
      {count > 1 && (
        <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
          {count}
        </div>
      )}
    </div>
  )
}

export function PhotoGrid({
  photos: initialPhotos,
  galleryId,
}: {
  photos: Photo[]
  galleryId: string
}) {
  const [photos, setPhotos] = useState(initialPhotos)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draggedIds, setDraggedIds] = useState<Set<string>>(new Set())
  const previousPhotosRef = useRef<Photo[]>(initialPhotos)
  const savingRef = useRef(false)

  const selection = useAdminPhotoSelection(photos.map((p) => p.id))

  // Keep photos in sync when server re-renders (e.g., after upload or delete)
  const [prevInitial, setPrevInitial] = useState(initialPhotos)
  if (initialPhotos !== prevInitial) {
    setPrevInitial(initialPhotos)
    if (!savingRef.current) {
      setPhotos(initialPhotos)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  )

  const saveOrder = useCallback(
    async (reorderedPhotos: Photo[]) => {
      savingRef.current = true
      const order = reorderedPhotos.map((p, i) => ({
        id: p.id,
        sortOrder: i,
      }))

      const formData = new FormData()
      formData.set("order", JSON.stringify(order))
      formData.set("galleryId", galleryId)

      try {
        await reorderPhotos(formData)
      } catch {
        toast.error("Failed to save photo order. Reverting.")
        setPhotos(previousPhotosRef.current)
      } finally {
        savingRef.current = false
      }
    },
    [galleryId]
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as string
      setActiveId(id)
      setPhotos((current) => {
        previousPhotosRef.current = current
        return current
      })

      // If dragging a selected photo, drag the whole group
      // If dragging an unselected photo, clear selection and drag only that one
      if (selection.selectedIds.has(id)) {
        setDraggedIds(new Set(selection.selectedIds))
      } else {
        selection.clearSelection()
        setDraggedIds(new Set([id]))
      }
    },
    [selection]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      const currentDraggedIds = draggedIds

      setActiveId(null)
      setDraggedIds(new Set())

      if (!over || active.id === over.id) {
        // If single photo dropped in place, no reorder needed
        if (currentDraggedIds.size <= 1) return
      }

      if (!over) return

      setPhotos((current) => {
        const reordered = computeReorder(
          current,
          currentDraggedIds,
          active.id as string,
          over.id as string
        )

        // Check if anything actually changed
        const changed = reordered.some((p, i) => p.id !== current[i].id)
        if (!changed) return current

        saveOrder(reordered)
        return reordered
      })
    },
    [saveOrder, draggedIds]
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setDraggedIds(new Set())
  }, [])

  const activePhoto = activeId
    ? photos.find((p) => p.id === activeId)
    : null

  const dragCount = draggedIds.size

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {photos.map((photo) => (
            <SortablePhoto
              key={photo.id}
              photo={photo}
              isSelected={selection.selectedIds.has(photo.id)}
              isDraggedInGroup={draggedIds.has(photo.id) && photo.id !== activeId}
              onSelect={selection.handleClick}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activePhoto ? (
          <DragOverlayContent photo={activePhoto} count={dragCount} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
