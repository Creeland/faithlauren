"use client"

import { useState, useCallback, useRef } from "react"

export const CONCURRENT_UPLOADS = 4
export const UPLOAD_TIMEOUT_MS = 120_000
export const MAX_RETRIES = 3
export const RETRY_BACKOFF_BASE_MS = 1_000

export type FileItemStatus =
  | "queued"
  | "uploading"
  | "retrying"
  | "succeeded"
  | "failed"

export type FileItem = {
  file: File
  status: FileItemStatus
  progress: number
  attempt: number
  error?: string
}

export type UploadFn = (
  file: File,
  onProgress: (progress: number) => void,
  signal: AbortSignal
) => Promise<{ success: boolean; error?: string }>

export type UseUploadQueueOptions = {
  uploadFn: UploadFn
  concurrency?: number
  timeoutMs?: number
  maxRetries?: number
  onComplete?: () => void
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useUploadQueue({
  uploadFn,
  concurrency = CONCURRENT_UPLOADS,
  timeoutMs = UPLOAD_TIMEOUT_MS,
  maxRetries = MAX_RETRIES,
  onComplete,
}: UseUploadQueueOptions) {
  const [items, setItems] = useState<FileItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const processingRef = useRef(false)
  const uploadFnRef = useRef(uploadFn)
  uploadFnRef.current = uploadFn

  const updateItem = useCallback(
    (fileName: string, update: Partial<FileItem>) => {
      setItems((prev) =>
        prev.map((item) =>
          item.file.name === fileName ? { ...item, ...update } : item
        )
      )
    },
    []
  )

  const attemptUpload = useCallback(
    async (file: File): Promise<{ success: boolean; error?: string }> => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const result = await uploadFnRef.current(
          file,
          (progress) => {
            updateItem(file.name, { progress })
          },
          controller.signal
        )
        clearTimeout(timer)
        return result
      } catch (err) {
        clearTimeout(timer)
        const isTimeout = controller.signal.aborted
        return {
          success: false,
          error: isTimeout
            ? "Upload timed out"
            : err instanceof Error
              ? err.message
              : "Upload failed",
        }
      }
    },
    [updateItem, timeoutMs]
  )

  const uploadOne = useCallback(
    async (item: FileItem) => {
      updateItem(item.file.name, { status: "uploading", progress: 0, attempt: 1 })

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        if (attempt > 1) {
          const backoff = RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt - 2)
          updateItem(item.file.name, {
            status: "retrying",
            progress: 0,
            attempt,
            error: undefined,
          })
          await delay(backoff)
          updateItem(item.file.name, { status: "uploading", progress: 0 })
        }

        const result = await attemptUpload(item.file)

        if (result.success) {
          updateItem(item.file.name, { status: "succeeded", progress: 100, error: undefined })
          return
        }

        // Last attempt — mark as permanently failed
        if (attempt === maxRetries + 1) {
          updateItem(item.file.name, {
            status: "failed",
            error: result.error ?? "Upload failed",
          })
          return
        }
      }
    },
    [updateItem, maxRetries, attemptUpload]
  )

  const processQueue = useCallback(
    async (queue: FileItem[]) => {
      if (processingRef.current) return
      processingRef.current = true
      setIsUploading(true)

      let nextIndex = 0

      async function runNext(): Promise<void> {
        while (nextIndex < queue.length) {
          const item = queue[nextIndex++]
          await uploadOne(item)
        }
      }

      const workers = Array.from(
        { length: Math.min(concurrency, queue.length) },
        () => runNext()
      )
      await Promise.all(workers)

      processingRef.current = false
      setIsUploading(false)
      onComplete?.()
    },
    [uploadOne, concurrency, onComplete]
  )

  const addFiles = useCallback(
    (files: File[]) => {
      const newItems: FileItem[] = files.map((file) => ({
        file,
        status: "queued" as const,
        progress: 0,
        attempt: 0,
      }))

      setItems(newItems)
      processQueue(newItems)
    },
    [processQueue]
  )

  const retryFailed = useCallback(() => {
    setItems((prev) => {
      const updated = prev.map((item) =>
        item.status === "failed"
          ? { ...item, status: "queued" as const, progress: 0, attempt: 0, error: undefined }
          : item
      )
      const toRetry = updated.filter((item) => item.status === "queued")
      if (toRetry.length > 0) {
        processQueue(toRetry)
      }
      return updated
    })
  }, [processQueue])

  const succeeded = items.filter((i) => i.status === "succeeded").length
  const failed = items.filter((i) => i.status === "failed").length
  const total = items.length
  const isComplete =
    total > 0 && items.every((i) => i.status === "succeeded" || i.status === "failed")

  return {
    items,
    addFiles,
    retryFailed,
    isUploading,
    succeeded,
    failed,
    total,
    isComplete,
  }
}
