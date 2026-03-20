"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useUploadThing } from "@/lib/uploadthing"

const BATCH_SIZE = 40

type FileStatus = {
  name: string
  progress: number
  error?: string
}

export function PhotoUploader({ galleryId }: { galleryId: string }) {
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([])
  const [currentBatch, setCurrentBatch] = useState(0)
  const [totalBatches, setTotalBatches] = useState(0)
  const [totalUploaded, setTotalUploaded] = useState(0)
  const [totalFiles, setTotalFiles] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [failedFiles, setFailedFiles] = useState<string[]>([])
  const router = useRouter()

  const { startUpload } = useUploadThing("galleryPhoto", {
    onUploadProgress(p) {
      // UploadThing sends overall progress for the batch
      setFileStatuses((prev) =>
        prev.map((f) =>
          f.progress < 100 && !f.error ? { ...f, progress: p } : f
        )
      )
    },
  })

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files
      if (!selected || selected.length === 0) return

      const allFiles = Array.from(selected)
      const batches: File[][] = []
      for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
        batches.push(allFiles.slice(i, i + BATCH_SIZE))
      }

      setIsUploading(true)
      setTotalFiles(allFiles.length)
      setTotalBatches(batches.length)
      setTotalUploaded(0)
      setFailedFiles([])
      setFileStatuses(
        allFiles.map((f) => ({ name: f.name, progress: 0 }))
      )

      let uploaded = 0

      for (let i = 0; i < batches.length; i++) {
        setCurrentBatch(i + 1)
        const batch = batches[i]

        try {
          await startUpload(batch, { galleryId })

          // Mark batch files as complete
          const batchNames = new Set(batch.map((f) => f.name))
          setFileStatuses((prev) =>
            prev.map((f) =>
              batchNames.has(f.name) ? { ...f, progress: 100 } : f
            )
          )
          uploaded += batch.length
          setTotalUploaded(uploaded)
        } catch (err) {
          const batchNames = batch.map((f) => f.name)
          setFailedFiles((prev) => [...prev, ...batchNames])
          setFileStatuses((prev) =>
            prev.map((f) =>
              batchNames.includes(f.name)
                ? { ...f, error: "Upload failed" }
                : f
            )
          )
          uploaded += batch.length
          setTotalUploaded(uploaded)
        }
      }

      setIsUploading(false)
      router.refresh()

      // Reset input so the same files can be re-selected
      e.target.value = ""
    },
    [startUpload, galleryId, router]
  )

  return (
    <div className="space-y-4">
      <label className="inline-block cursor-pointer border border-dashed border-stone-300 px-6 py-3 text-sm text-stone-500 hover:border-accent hover:text-accent transition-colors">
        {isUploading ? "Uploading..." : "Upload Photos"}
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleUpload}
          disabled={isUploading}
          className="hidden"
        />
      </label>

      {isUploading && totalBatches > 1 && (
        <p className="text-sm text-stone-500">
          Batch {currentBatch}/{totalBatches} — {totalUploaded}/{totalFiles}{" "}
          files processed
        </p>
      )}

      {isUploading && (
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {fileStatuses
            .filter((f) => f.progress < 100 && !f.error)
            .slice(0, 10)
            .map((f) => (
              <div key={f.name} className="flex items-center gap-2 text-xs">
                <span className="truncate w-40">{f.name}</span>
                <div className="flex-1 bg-stone-200 rounded h-1.5">
                  <div
                    className="bg-accent h-1.5 rounded transition-all"
                    style={{ width: `${f.progress}%` }}
                  />
                </div>
                <span className="text-stone-400 w-8 text-right">
                  {f.progress}%
                </span>
              </div>
            ))}
        </div>
      )}

      {failedFiles.length > 0 && (
        <div className="text-sm text-red-500 space-y-1">
          <p>{failedFiles.length} file(s) failed to upload:</p>
          <ul className="list-disc list-inside max-h-32 overflow-y-auto">
            {failedFiles.map((name) => (
              <li key={name} className="truncate">
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
