"use client"

import { deleteGallery } from "@/app/actions/gallery"

export function DeleteGalleryButton({ galleryId }: { galleryId: string }) {
  return (
    <form action={deleteGallery}>
      <input type="hidden" name="id" value={galleryId} />
      <button
        type="submit"
        className="text-sm text-red-600 hover:text-red-700 transition-colors"
        onClick={(e) => {
          if (!confirm("Delete this gallery and all its photos?")) {
            e.preventDefault()
          }
        }}
      >
        Delete Gallery
      </button>
    </form>
  )
}
