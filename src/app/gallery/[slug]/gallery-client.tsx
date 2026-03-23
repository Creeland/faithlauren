"use client"

import { useState } from "react"
import Image from "next/image"

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

  async function handleDownloadAll() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/gallery/${slug}/download`)
      if (!res.ok) throw new Error("Download failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${title}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      // silently fail — user can retry
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      {/* Sticky toolbar */}
      {photos.length > 0 && (
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-stone-200 shadow-sm">
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
            ) : (
              <>
                <p className="text-xs text-stone-400">
                  Tap a photo to view full size &middot; Use{" "}
                  <span className="font-medium text-stone-500">Select</span> to
                  choose photos for download
                </p>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm border border-stone-300 text-stone-600 hover:bg-stone-100 transition-colors rounded"
                  >
                    Select
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadAll}
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
            {photos.map((photo, index) =>
              photo.width && photo.height ? (
                <div
                  key={photo.id}
                  className="break-inside-avoid mb-3 overflow-hidden bg-stone-100"
                >
                  <Image
                    src={photo.url}
                    alt={photo.caption || photo.filename}
                    width={photo.width}
                    height={photo.height}
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                    className="w-full h-auto"
                    priority={index < 3}
                    loading={index < 3 ? undefined : "lazy"}
                  />
                </div>
              ) : (
                <div
                  key={photo.id}
                  className="relative aspect-[3/4] break-inside-avoid mb-3 overflow-hidden bg-stone-100"
                >
                  <Image
                    src={photo.url}
                    alt={photo.caption || photo.filename}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                    className="object-cover"
                    priority={index < 3}
                    loading={index < 3 ? undefined : "lazy"}
                  />
                </div>
              )
            )}
          </div>
        )}
      </main>
    </>
  )
}
