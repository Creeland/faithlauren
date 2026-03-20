"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useUploadThing } from "@/lib/uploadthing"
import { getPortfolioPhotoCount } from "@/app/actions/portfolio-photo"

const MAX_BATCH_BYTES = 100 * 1024 * 1024 // 100 MB cumulative
const MAX_BATCH_COUNT = 20

function buildBatches(files: File[]): File[][] {
  const batches: File[][] = []
  let current: File[] = []
  let currentBytes = 0
  for (const file of files) {
    if (
      current.length > 0 &&
      (currentBytes + file.size > MAX_BATCH_BYTES ||
        current.length >= MAX_BATCH_COUNT)
    ) {
      batches.push(current)
      current = []
      currentBytes = 0
    }
    current.push(file)
    currentBytes += file.size
  }
  if (current.length > 0) batches.push(current)
  return batches
}

type FileStatus = {
  name: string
  progress: number
  error?: string
}

export function PortfolioPhotoUploader({ portfolioId }: { portfolioId: string }) {
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([])
  const [currentBatch, setCurrentBatch] = useState(0)
  const [totalBatches, setTotalBatches] = useState(0)
  const [totalUploaded, setTotalUploaded] = useState(0)
  const [totalFiles, setTotalFiles] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [failedFiles, setFailedFiles] = useState<string[]>([])
  const [verificationMessage, setVerificationMessage] = useState<string | null>(
    null
  )
  const router = useRouter()
  const activeBatchRef = useRef<Set<string>>(new Set())

  const { startUpload } = useUploadThing("portfolioPhoto", {
    onUploadProgress(p) {
      const batchNames = activeBatchRef.current
      setFileStatuses((prev) =>
        prev.map((f) =>
          batchNames.has(f.name) && f.progress < 100 && !f.error
            ? { ...f, progress: p }
            : f
        )
      )
    },
  })

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files
      if (!selected || selected.length === 0) return

      const allFiles = Array.from(selected)
      const batches = buildBatches(allFiles)

      const countBefore = await getPortfolioPhotoCount(portfolioId)

      setIsUploading(true)
      setTotalFiles(allFiles.length)
      setTotalBatches(batches.length)
      setTotalUploaded(0)
      setFailedFiles([])
      setVerificationMessage(null)
      setFileStatuses(
        allFiles.map((f) => ({ name: f.name, progress: 0 }))
      )

      let uploaded = 0

      for (let i = 0; i < batches.length; i++) {
        setCurrentBatch(i + 1)
        const batch = batches[i]
        activeBatchRef.current = new Set(batch.map((f) => f.name))

        try {
          const result = await startUpload(batch, { portfolioId })

          if (!result || result.length === 0) {
            const batchNames = batch.map((f) => f.name)
            setFailedFiles((prev) => [...prev, ...batchNames])
            setFileStatuses((prev) =>
              prev.map((f) =>
                batchNames.includes(f.name)
                  ? { ...f, error: "Upload failed (no response)" }
                  : f
              )
            )
            uploaded += batch.length
            setTotalUploaded(uploaded)
            continue
          }

          const returnedNames = new Set(
            result.map((r) => r.name)
          )
          const succeeded: string[] = []
          const dropped: string[] = []

          for (const file of batch) {
            if (returnedNames.has(file.name)) {
              succeeded.push(file.name)
            } else {
              dropped.push(file.name)
            }
          }

          if (dropped.length > 0) {
            setFailedFiles((prev) => [...prev, ...dropped])
          }

          setFileStatuses((prev) =>
            prev.map((f) => {
              if (succeeded.includes(f.name)) return { ...f, progress: 100 }
              if (dropped.includes(f.name))
                return { ...f, error: "Upload failed (not confirmed)" }
              return f
            })
          )
          uploaded += batch.length
          setTotalUploaded(uploaded)
        } catch {
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

      const countAfter = await getPortfolioPhotoCount(portfolioId)
      const saved = countAfter - countBefore
      if (saved < allFiles.length) {
        setVerificationMessage(
          `${saved} of ${allFiles.length} photos saved. ${allFiles.length - saved} may need to be re-uploaded.`
        )
      }

      setIsUploading(false)
      router.refresh()

      e.target.value = ""
    },
    [startUpload, portfolioId, router]
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

      {verificationMessage && (
        <p className="text-sm text-amber-600 font-medium">
          {verificationMessage}
        </p>
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
