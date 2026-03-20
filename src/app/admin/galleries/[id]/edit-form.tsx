"use client"

import { useActionState } from "react"
import { updateGallery, type GalleryState } from "@/app/actions/gallery"

type Gallery = {
  id: string
  title: string
  description: string | null
}

export function EditGalleryForm({ gallery }: { gallery: Gallery }) {
  const [state, action, pending] = useActionState<GalleryState, FormData>(
    updateGallery,
    undefined
  )

  return (
    <form action={action} className="space-y-4 max-w-lg">
      <input type="hidden" name="id" value={gallery.id} />

      {state?.error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="title"
          className="block text-sm text-stone-600 mb-1.5"
        >
          Title
        </label>
        <input
          id="title"
          name="title"
          defaultValue={gallery.title}
          required
          className="w-full border border-stone-300 bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background focus:border-accent"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm text-stone-600 mb-1.5"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={gallery.description || ""}
          rows={3}
          className="w-full border border-stone-300 bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background focus:border-accent"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-white px-6 py-3 text-sm tracking-wide hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save Changes"}
      </button>
    </form>
  )
}
