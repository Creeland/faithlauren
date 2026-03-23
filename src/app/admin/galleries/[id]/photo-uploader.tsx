"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useUploadThing } from "@/lib/uploadthing"
import { useUploadQueue, type FileItem } from "@/hooks/use-upload-queue"
import { getPhotoCount } from "@/app/actions/photo"

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function StatusIcon({ status }: { status: FileItem["status"] }) {
  switch (status) {
    case "queued":
      return (
        <span className="text-stone-400 text-sm" title="Queued">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
      )
    case "uploading":
      return (
        <span className="text-accent text-sm" title="Uploading">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </span>
      )
    case "retrying":
      return (
        <span className="text-amber-500 text-sm" title="Retrying">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </span>
      )
    case "succeeded":
      return (
        <span className="text-green-500 text-sm" title="Done">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )
    case "failed":
      return (
        <span className="text-red-500 text-sm" title="Failed">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      )
  }
}

export function PhotoUploader({ galleryId }: { galleryId: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)
  const countBeforeRef = useRef(0)
  const totalExpectedRef = useRef(0)
  const onProgressRef = useRef<((p: number) => void) | null>(null)

  const { startUpload } = useUploadThing("galleryPhoto", {
    onUploadProgress(p) {
      onProgressRef.current?.(p)
    },
  })

  const { items, addFiles, retryFailed, isUploading, succeeded, failed, total, isComplete } =
    useUploadQueue({
      uploadFn: async (file, onProgress, signal) => {
        onProgressRef.current = onProgress
        onProgress(0)
        try {
          const result = await startUpload([file], { galleryId })

          if (!result || result.length === 0) {
            return { success: false, error: "No response from server" }
          }

          onProgress(100)
          return { success: true }
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : "Upload failed",
          }
        }
      },
      onComplete: async () => {
        const countAfter = await getPhotoCount(galleryId)
        const saved = countAfter - countBeforeRef.current
        if (saved < totalExpectedRef.current) {
          setVerificationMessage(
            `${saved} of ${totalExpectedRef.current} photos saved. ${totalExpectedRef.current - saved} may need to be re-uploaded.`
          )
        }
        router.refresh()
        if (inputRef.current) inputRef.current.value = ""
      },
    })

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (!selected || selected.length === 0) return

    const files = Array.from(selected)
    countBeforeRef.current = await getPhotoCount(galleryId)
    totalExpectedRef.current = files.length
    setVerificationMessage(null)
    addFiles(files)
  }

  const overallProgress = total > 0 ? Math.round(((succeeded + failed) / total) * 100) : 0

  return (
    <div className="space-y-4">
      <label className="inline-block cursor-pointer border border-dashed border-stone-300 px-6 py-3 text-sm text-stone-500 hover:border-accent hover:text-accent transition-colors">
        {isUploading ? "Uploading..." : "Upload Photos"}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleChange}
          disabled={isUploading}
          className="hidden"
        />
      </label>

      {/* Overall progress header */}
      {total > 0 && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-stone-700">
              {isComplete
                ? failed > 0
                  ? `${succeeded} uploaded, ${failed} failed`
                  : `All ${succeeded} photos uploaded`
                : `Uploading ${succeeded + failed} of ${total}`}
            </span>
            <span className="text-2xl font-bold tabular-nums text-accent">
              {overallProgress}%
            </span>
          </div>
          <div className="w-full bg-stone-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-2.5 rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${overallProgress}%`,
                backgroundColor: failed > 0 && isComplete
                  ? "var(--color-accent)"
                  : "var(--color-accent)",
              }}
            />
          </div>
          {failed > 0 && isComplete && (
            <p className="text-xs text-red-500">
              {failed} file{failed > 1 ? "s" : ""} failed —{" "}
              <button
                onClick={retryFailed}
                className="underline hover:text-red-700 font-medium"
              >
                retry failed uploads
              </button>
            </p>
          )}
        </div>
      )}

      {/* File list */}
      {items.length > 0 && (
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {items.map((f) => (
            <div
              key={f.file.name}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                f.status === "succeeded"
                  ? "bg-green-50 opacity-60"
                  : f.status === "failed"
                    ? "bg-red-50"
                    : f.status === "retrying"
                      ? "bg-amber-50"
                      : f.status === "uploading"
                        ? "bg-accent-subtle"
                        : "bg-stone-50"
              }`}
            >
              <StatusIcon status={f.status} />

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-stone-700 text-xs">
                    {f.file.name}
                  </span>
                  <span className="text-[10px] text-stone-400 shrink-0 tabular-nums">
                    {formatBytes(f.file.size)}
                  </span>
                </div>

                {f.status === "retrying" ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-amber-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-amber-500 h-2 rounded-full animate-pulse w-full" />
                    </div>
                    <span className="text-[10px] text-amber-600 font-semibold shrink-0">
                      Retry {f.attempt}/3
                    </span>
                  </div>
                ) : f.status === "failed" ? (
                  <p className="text-[10px] text-red-400 truncate">
                    {f.error || "Upload failed"}
                  </p>
                ) : f.status === "succeeded" ? (
                  <div className="bg-green-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-green-500 h-2 rounded-full w-full" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-stone-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ease-out ${
                          f.status === "uploading" ? "bg-accent" : "bg-stone-300"
                        }`}
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-stone-500 font-semibold w-7 text-right tabular-nums shrink-0">
                      {f.status === "queued" ? "—" : `${f.progress}%`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isComplete && succeeded > 0 && failed === 0 && (
        <p className="text-sm text-green-600 font-medium">
          All {succeeded} photos uploaded successfully.
        </p>
      )}

      {verificationMessage && (
        <p className="text-sm text-amber-600 font-medium">
          {verificationMessage}
        </p>
      )}
    </div>
  )
}
