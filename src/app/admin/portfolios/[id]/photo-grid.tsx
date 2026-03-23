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
import { deletePortfolioPhoto, reorderPortfolioPhotos } from "@/app/actions/portfolio-photo"
import { setCoverPhoto } from "@/app/actions/portfolio"
import { useAdminPhotoSelection } from "@/app/admin/galleries/[id]/use-admin-photo-selection"
import { computeReorder } from "@/app/admin/galleries/[id]/reorder-photos"

type PortfolioPhoto = {
  id: string
  url: string
  filename: string
  sortOrder: number
  portfolioId: string
}

function SortablePhoto({
  photo,
  isCover,
  isSelected,
  isDraggedInGroup,
  portfolioId,
  aspectRatio,
  onSelect,
}: {
  photo: PortfolioPhoto
  isCover: boolean
  isSelected: boolean
  isDraggedInGroup: boolean
  portfolioId: string
  aspectRatio: string
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
      e.preventDefault()
      e.stopPropagation()
      onSelect(photo.id, { metaKey: e.metaKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey })
      return
    }
    dndPointerDown?.(e as unknown as PointerEvent)
  }

  const handleClick = (e: MouseEvent) => {
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
      onSelect(photo.id, { metaKey: false, ctrlKey: false, shiftKey: false })
    }
  }

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
        className={`relative aspect-square overflow-hidden bg-stone-100 cursor-grab active:cursor-grabbing ${
          isCover ? "ring-2 ring-accent" : ""
        }`}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        {...attributes}
      >
        <Image
          src={photo.url}
          alt={photo.filename}
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
      <div className="absolute top-1 right-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <form action={deletePortfolioPhoto}>
          <input type="hidden" name="id" value={photo.id} />
          <button
            type="submit"
            className="bg-red-600 text-white text-xs px-2 py-1 rounded"
          >
            &times;
          </button>
        </form>
      </div>
      <div className="mt-1 flex items-center justify-between gap-1">
        <p className="text-xs text-stone-500 truncate">{photo.filename}</p>
        {isCover ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-accent font-medium">Cover</span>
            <form action={setCoverPhoto} className="flex items-center gap-1">
              <input type="hidden" name="portfolioId" value={portfolioId} />
              <input type="hidden" name="photoId" value={photo.id} />
              <select
                name="aspectRatio"
                defaultValue={aspectRatio}
                className="text-xs border border-stone-300 bg-background px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="aspect-3/4">3:4</option>
                <option value="aspect-2/3">2:3</option>
                <option value="aspect-4/5">4:5</option>
              </select>
              <button
                type="submit"
                className="text-xs text-stone-400 hover:text-accent transition-colors"
              >
                Update
              </button>
            </form>
          </div>
        ) : (
          <form action={setCoverPhoto} className="flex items-center gap-1 shrink-0">
            <input type="hidden" name="portfolioId" value={portfolioId} />
            <input type="hidden" name="photoId" value={photo.id} />
            <select
              name="aspectRatio"
              defaultValue={aspectRatio}
              className="text-xs border border-stone-300 bg-background px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="aspect-3/4">3:4</option>
              <option value="aspect-2/3">2:3</option>
              <option value="aspect-4/5">4:5</option>
            </select>
            <button
              type="submit"
              className="text-xs text-stone-400 hover:text-accent transition-colors"
            >
              Set Cover
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function DragOverlayContent({ photo, count }: { photo: PortfolioPhoto; count: number }) {
  return (
    <div className="relative w-[150px]">
      {count > 1 && (
        <>
          <div className="absolute top-2 left-2 w-full aspect-square bg-stone-200 rounded shadow-md" />
          <div className="absolute top-1 left-1 w-full aspect-square bg-stone-100 rounded shadow-md" />
        </>
      )}
      <div className="relative aspect-square overflow-hidden bg-stone-100 rounded shadow-lg ring-2 ring-accent">
        <Image
          src={photo.url}
          alt={photo.filename}
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

export function PortfolioPhotoGrid({
  photos: initialPhotos,
  portfolioId,
  coverPhotoId,
  aspectRatio,
}: {
  photos: PortfolioPhoto[]
  portfolioId: string
  coverPhotoId: string | null
  aspectRatio: string
}) {
  const [photos, setPhotos] = useState(initialPhotos)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draggedIds, setDraggedIds] = useState<Set<string>>(new Set())
  const previousPhotosRef = useRef<PortfolioPhoto[]>(initialPhotos)
  const savingRef = useRef(false)

  const selection = useAdminPhotoSelection(photos.map((p) => p.id))

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
    async (reorderedPhotos: PortfolioPhoto[]) => {
      savingRef.current = true
      const order = reorderedPhotos.map((p, i) => ({
        id: p.id,
        sortOrder: i,
      }))

      const formData = new FormData()
      formData.set("order", JSON.stringify(order))
      formData.set("portfolioId", portfolioId)

      try {
        await reorderPortfolioPhotos(formData)
      } catch {
        toast.error("Failed to save photo order. Reverting.")
        setPhotos(previousPhotosRef.current)
      } finally {
        savingRef.current = false
      }
    },
    [portfolioId]
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as string
      setActiveId(id)
      setPhotos((current) => {
        previousPhotosRef.current = current
        return current
      })

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
              isCover={coverPhotoId === photo.id}
              isSelected={selection.selectedIds.has(photo.id)}
              isDraggedInGroup={draggedIds.has(photo.id) && photo.id !== activeId}
              portfolioId={portfolioId}
              aspectRatio={aspectRatio}
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
