"use client"

import { useActionState } from "react"
import {
  verifyAlbumPassword,
  type AlbumPasswordState,
} from "@/app/actions/gallery"

export function AlbumPasswordForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<
    AlbumPasswordState,
    FormData
  >(verifyAlbumPassword, undefined)

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />

      {state?.error && (
        <div role="alert" className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
          {state.error}
        </div>
      )}

      <label htmlFor="gallery-password" className="sr-only">
        Gallery password
      </label>
      <input
        id="gallery-password"
        name="password"
        type="password"
        placeholder="Enter password"
        required
        className="w-full border border-stone-300 dark:border-stone-700 bg-background px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background focus:border-accent"
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-accent text-white py-3 text-sm tracking-wide hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {pending ? "Checking..." : "View Gallery"}
      </button>
    </form>
  )
}
