"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import Image from "next/image"
import { Lightbox } from "./lightbox"
import { usePhotoSelection } from "./use-photo-selection"

type Photo = {
  id: string
  url: string
  filename: string
  caption: string | null
  width: number | null
  height: number | null
}

type GalleryClientProps = {
  slug: string
  title: string
  description: string | null
  photos: Photo[]
}

export function GalleryClient({
  slug,
  title,
  description,
  photos,
}: GalleryClientProps) {
  const [downloading, setDownloading] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showHelp) return
    function handleTapOutside(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setShowHelp(false)
      }
    }
    document.addEventListener("mousedown", handleTapOutside)
    return () => document.removeEventListener("mousedown", handleTapOutside)
  }, [showHelp])

  const allPhotoIds = useMemo(() => photos.map((p) => p.id), [photos])
  const selection = usePhotoSelection(allPhotoIds)

  async function handleDownload(photoIds?: string[]) {
    setDownloading(true)
    try {
      const url = photoIds
        ? `/api/gallery/${slug}/download?photoIds=${photoIds.join(",")}`
        : `/api/gallery/${slug}/download`
      const res = await fetch(url)
      if (!res.ok) throw new Error("Download failed")
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = `${title}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)

      // After selective download, clear selection and exit selection mode
      if (photoIds) {
        selection.exitSelecting()
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setDownloading(false)
    }
  }

  function handlePhotoClick(photo: Photo) {
    if (selection.selecting) {
      selection.toggle(photo.id)
    } else {
      setLightboxPhoto(photo)
    }
  }

  return (
    <>
      {/* Sticky toolbar */}
      {photos.length > 0 && (
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-stone-200 shadow-sm relative" ref={helpRef}>
          <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between gap-4">
            {downloading ? (
              <div className="flex items-center gap-2 text-sm text-stone-600">
                <svg
                  className="animate-spin h-4 w-4 text-stone-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Preparing download…
              </div>
            ) : selection.selecting ? (
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={selection.selectAll}
                  className="px-3 py-1.5 text-sm border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors rounded"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleDownload(Array.from(selection.selectedIds))
                  }
                  disabled={selection.selectedCount === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Selected ({selection.selectedCount})
                </button>
                <button
                  type="button"
                  onClick={selection.exitSelecting}
                  className="ml-auto px-3 py-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowHelp((v) => !v)}
                  className="sm:hidden w-7 h-7 flex items-center justify-center border border-stone-300 text-stone-400 rounded-full text-xs shrink-0"
                  aria-label="Show instructions"
                >
                  ?
                </button>
                <p className="hidden sm:block text-xs text-stone-400">
                  Tap a photo to view full size &middot; Use{" "}
                  <span className="font-medium text-stone-500">Select</span> to
                  choose photos for download
                </p>
                <div className="flex items-center gap-2 ml-auto shrink-0">
                  <button
                    type="button"
                    onClick={selection.enterSelecting}
                    className="px-3 py-1.5 text-sm border border-stone-300 text-stone-600 hover:bg-stone-100 transition-colors rounded"
                  >
                    Select
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-stone-800 text-white hover:bg-stone-700 transition-colors rounded"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download All
                  </button>
                </div>
              </>
            )}
          </div>
          {showHelp && (
            <div className="absolute top-full left-4 right-4 mt-1 bg-white rounded-lg shadow-lg border border-stone-200 px-4 py-3 sm:hidden">
              <p className="text-xs text-stone-500">
                Tap a photo to view full size &middot; Use{" "}
                <span className="font-medium text-stone-600">Select</span> to
                choose photos for download
              </p>
            </div>
          )}
        </div>
      )}

      {/* Gallery content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {description && (
          <p className="text-stone-600 mb-8 max-w-lg">{description}</p>
        )}

        {photos.length === 0 ? (
          <p className="text-stone-500 text-sm">
            No photos in this gallery yet.
          </p>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-3">
            {photos.map((photo, index) => {
              const isSelected = selection.selectedIds.has(photo.id)
              const hasKnownDimensions = photo.width && photo.height

              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => handlePhotoClick(photo)}
                  className={`relative break-inside-avoid mb-3 overflow-hidden bg-stone-100 w-full cursor-pointer transition-all ${
                    !hasKnownDimensions ? "aspect-[3/4]" : ""
                  } ${
                    isSelected
                      ? "ring-3 ring-blue-500 ring-offset-1"
                      : ""
                  }`}
                >
                  {hasKnownDimensions ? (
                    <Image
                      src={photo.url}
                      alt={photo.caption || photo.filename}
                      width={photo.width!}
                      height={photo.height!}
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                      className="w-full h-auto"
                      priority={index < 3}
                      loading={index < 3 ? undefined : "lazy"}
                    />
                  ) : (
                    <Image
                      src={photo.url}
                      alt={photo.caption || photo.filename}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                      className="object-cover"
                      priority={index < 3}
                      loading={index < 3 ? undefined : "lazy"}
                    />
                  )}

                  {/* Selection checkmark badge */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </main>

      {lightboxPhoto && (
        <Lightbox
          url={lightboxPhoto.url}
          alt={lightboxPhoto.caption || lightboxPhoto.filename}
          onClose={() => setLightboxPhoto(null)}
        />
      )}
    </>
  )
}
