"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function PhotoUploader({ galleryId }: { galleryId: string }) {
  const [uploading, setUploading] = useState(false)
  const router = useRouter()

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    const formData = new FormData()
    formData.set("galleryId", galleryId)
    for (const file of Array.from(files)) {
      formData.append("files", file)
    }

    await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })

    setUploading(false)
    router.refresh()
  }

  return (
    <label className="inline-block cursor-pointer border border-dashed border-stone-300 dark:border-stone-700 px-6 py-3 text-sm text-stone-500 hover:border-accent hover:text-accent transition-colors">
      {uploading ? "Uploading..." : "Upload Photos"}
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={handleUpload}
        disabled={uploading}
        className="hidden"
      />
    </label>
  )
}
