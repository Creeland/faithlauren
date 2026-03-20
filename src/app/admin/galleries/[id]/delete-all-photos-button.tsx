"use client"

import { deleteAllPhotos } from "@/app/actions/photo"

export function DeleteAllPhotosButton({ galleryId }: { galleryId: string }) {
  return (
    <form
      action={deleteAllPhotos}
      onSubmit={(e) => {
        if (!confirm("Delete all photos? This cannot be undone.")) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="galleryId" value={galleryId} />
      <button
        type="submit"
        className="text-xs text-red-500 hover:text-red-700 transition-colors"
      >
        Delete All
      </button>
    </form>
  )
}
