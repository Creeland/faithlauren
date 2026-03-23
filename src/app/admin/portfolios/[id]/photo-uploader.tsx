"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useUploadThing } from "@/lib/uploadthing"
import { useUploadQueue } from "@/hooks/use-upload-queue"
import { getPortfolioPhotoCount } from "@/app/actions/portfolio-photo"

export function PortfolioPhotoUploader({ portfolioId }: { portfolioId: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)
  const countBeforeRef = useRef(0)
  const totalExpectedRef = useRef(0)

  const { startUpload } = useUploadThing("portfolioPhoto", {
    onUploadProgress() {
      // Per-file progress is handled via the queue's onProgress callback
    },
  })

  const { items, addFiles, retryFailed, isUploading, succeeded, failed, total, isComplete } =
    useUploadQueue({
      uploadFn: async (file, onProgress, signal) => {
        onProgress(0)
        try {
          const result = await startUpload([file], { portfolioId })

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
        const countAfter = await getPortfolioPhotoCount(portfolioId)
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
    countBeforeRef.current = await getPortfolioPhotoCount(portfolioId)
    totalExpectedRef.current = files.length
    setVerificationMessage(null)
    addFiles(files)
  }

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

      {isUploading && (
        <p className="text-sm text-stone-500">
          {succeeded + failed} of {total} files processed
          {failed > 0 && ` (${failed} failed)`}
        </p>
      )}

      {items.length > 0 && (
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {items
            .filter((f) => f.status === "uploading" || f.status === "queued" || f.status === "retrying")
            .slice(0, 10)
            .map((f) => (
              <div key={f.file.name} className="flex items-center gap-2 text-xs">
                <span className="truncate w-40">{f.file.name}</span>
                {f.status === "retrying" ? (
                  <span className="flex-1 text-amber-500">
                    Retry {f.attempt}/{3}...
                  </span>
                ) : (
                  <>
                    <div className="flex-1 bg-stone-200 rounded h-1.5">
                      <div
                        className="bg-accent h-1.5 rounded transition-all"
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                    <span className="text-stone-400 w-8 text-right">
                      {f.status === "queued" ? "—" : `${f.progress}%`}
                    </span>
                  </>
                )}
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

      {isComplete && failed > 0 && (
        <div className="text-sm text-red-500 space-y-1">
          <p>{failed} file(s) failed to upload:</p>
          <ul className="list-disc list-inside max-h-32 overflow-y-auto">
            {items
              .filter((f) => f.status === "failed")
              .map((f) => (
                <li key={f.file.name} className="truncate">
                  {f.file.name}
                  {f.error && (
                    <span className="text-stone-400 ml-1">— {f.error}</span>
                  )}
                </li>
              ))}
          </ul>
          <button
            onClick={retryFailed}
            className="mt-2 border border-stone-300 px-4 py-1.5 text-sm text-stone-600 hover:border-accent hover:text-accent transition-colors"
          >
            Retry failed ({failed})
          </button>
        </div>
      )}
    </div>
  )
}
