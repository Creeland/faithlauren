import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useUploadQueue, type UploadFn } from "./use-upload-queue"

function makeFile(name: string): File {
  return new File(["x"], name, { type: "image/jpeg" })
}

function makeFiles(count: number): File[] {
  return Array.from({ length: count }, (_, i) => makeFile(`photo-${i}.jpg`))
}

// Creates an upload function where each call can be individually resolved/rejected
function createControllableUploadFn() {
  const calls: Array<{
    file: File
    resolve: (v: { success: boolean; error?: string }) => void
    reject: (err: Error) => void
    onProgress: (p: number) => void
    signal: AbortSignal
  }> = []

  const uploadFn: UploadFn = (file, onProgress, signal) => {
    return new Promise((resolve, reject) => {
      calls.push({ file, resolve, reject, onProgress, signal })
    })
  }

  return { uploadFn, calls }
}

describe("useUploadQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("uploads all files and marks them as succeeded", async () => {
    const uploadFn: UploadFn = vi.fn().mockResolvedValue({ success: true })

    const { result } = renderHook(() =>
      useUploadQueue({ uploadFn, concurrency: 2, maxRetries: 0, timeoutMs: 5000 })
    )

    const files = makeFiles(3)

    await act(async () => {
      result.current.addFiles(files)
    })

    expect(result.current.succeeded).toBe(3)
    expect(result.current.failed).toBe(0)
    expect(result.current.total).toBe(3)
    expect(result.current.isComplete).toBe(true)
    expect(result.current.isUploading).toBe(false)
  })

  it("marks failed files without retries when maxRetries is 0", async () => {
    const uploadFn: UploadFn = vi
      .fn()
      .mockResolvedValue({ success: false, error: "Server error" })

    const { result } = renderHook(() =>
      useUploadQueue({ uploadFn, concurrency: 1, maxRetries: 0, timeoutMs: 5000 })
    )

    await act(async () => {
      result.current.addFiles([makeFile("fail.jpg")])
    })

    expect(result.current.failed).toBe(1)
    expect(result.current.isComplete).toBe(true)
    expect(result.current.items[0].error).toBe("Server error")
  })

  it("respects concurrency limit", async () => {
    const { uploadFn, calls } = createControllableUploadFn()

    const { result } = renderHook(() =>
      useUploadQueue({ uploadFn, concurrency: 3, maxRetries: 0, timeoutMs: 60000 })
    )

    const files = makeFiles(10)

    // Start uploads — don't await since they'll be pending
    act(() => {
      result.current.addFiles(files)
    })

    // Wait for microtasks to flush so workers start
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    // Exactly 3 calls should be in-flight
    expect(calls.length).toBe(3)

    // Resolve one — should start a 4th
    await act(async () => {
      calls[0].resolve({ success: true })
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(calls.length).toBe(4)
  })

  it("times out a file that takes too long", async () => {
    const uploadFn: UploadFn = (_file, _onProgress, signal) => {
      // Simulates a hung upload that only rejects when aborted
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")))
      })
    }

    const { result } = renderHook(() =>
      useUploadQueue({
        uploadFn,
        concurrency: 1,
        maxRetries: 0,
        timeoutMs: 5000,
      })
    )

    act(() => {
      result.current.addFiles([makeFile("stuck.jpg")])
    })

    // Advance past timeout
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })

    expect(result.current.failed).toBe(1)
    expect(result.current.items[0].error).toBe("Upload timed out")
    expect(result.current.isComplete).toBe(true)
  })

  it("retries a failed file up to maxRetries times", async () => {
    let callCount = 0
    const uploadFn: UploadFn = vi.fn().mockImplementation(() => {
      callCount++
      // Succeed on the 3rd attempt
      if (callCount === 3) {
        return Promise.resolve({ success: true })
      }
      return Promise.resolve({ success: false, error: "Transient error" })
    })

    const { result } = renderHook(() =>
      useUploadQueue({
        uploadFn,
        concurrency: 1,
        maxRetries: 3,
        timeoutMs: 60000,
      })
    )

    act(() => {
      result.current.addFiles([makeFile("retry.jpg")])
    })

    // Advance through backoff delays (1s + 2s for attempts 2 and 3)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })

    expect(callCount).toBe(3)
    expect(result.current.succeeded).toBe(1)
    expect(result.current.failed).toBe(0)
    expect(result.current.isComplete).toBe(true)
  })

  it("permanently fails after exhausting all retries", async () => {
    const uploadFn: UploadFn = vi
      .fn()
      .mockResolvedValue({ success: false, error: "Persistent error" })

    const { result } = renderHook(() =>
      useUploadQueue({
        uploadFn,
        concurrency: 1,
        maxRetries: 2,
        timeoutMs: 60000,
      })
    )

    act(() => {
      result.current.addFiles([makeFile("doomed.jpg")])
    })

    // Advance through all backoff delays (1s + 2s)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })

    // 1 initial + 2 retries = 3 total calls
    expect(uploadFn).toHaveBeenCalledTimes(3)
    expect(result.current.failed).toBe(1)
    expect(result.current.items[0].error).toBe("Persistent error")
    expect(result.current.isComplete).toBe(true)
  })

  it("uses exponential backoff between retries", async () => {
    const timestamps: number[] = []
    const uploadFn: UploadFn = vi.fn().mockImplementation(() => {
      timestamps.push(Date.now())
      return Promise.resolve({ success: false, error: "fail" })
    })

    const { result } = renderHook(() =>
      useUploadQueue({
        uploadFn,
        concurrency: 1,
        maxRetries: 3,
        timeoutMs: 60000,
      })
    )

    act(() => {
      result.current.addFiles([makeFile("backoff.jpg")])
    })

    // Advance through all backoff delays
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000)
    })

    // 4 calls total (1 initial + 3 retries)
    expect(timestamps.length).toBe(4)

    // Backoff: ~1000ms, ~2000ms, ~4000ms
    const gaps = timestamps.slice(1).map((t, i) => t - timestamps[i])
    expect(gaps[0]).toBeGreaterThanOrEqual(1000)
    expect(gaps[1]).toBeGreaterThanOrEqual(2000)
    expect(gaps[2]).toBeGreaterThanOrEqual(4000)
  })

  it("retryFailed re-enqueues only failed files", async () => {
    let callIndex = 0
    const uploadFn: UploadFn = vi.fn().mockImplementation(async (file: File) => {
      callIndex++
      // First file always succeeds, second always fails on first round
      if (file.name === "good.jpg") return { success: true }
      if (callIndex <= 2) return { success: false, error: "fail" }
      return { success: true }
    })

    const { result } = renderHook(() =>
      useUploadQueue({
        uploadFn,
        concurrency: 2,
        maxRetries: 0,
        timeoutMs: 60000,
      })
    )

    await act(async () => {
      result.current.addFiles([makeFile("good.jpg"), makeFile("bad.jpg")])
    })

    expect(result.current.succeeded).toBe(1)
    expect(result.current.failed).toBe(1)
    expect(result.current.isComplete).toBe(true)

    // Retry failed — bad.jpg should now succeed
    await act(async () => {
      result.current.retryFailed()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current.succeeded).toBe(2)
    expect(result.current.failed).toBe(0)
    expect(result.current.isComplete).toBe(true)
  })

  it("tracks per-file progress", async () => {
    const uploadFn: UploadFn = vi
      .fn()
      .mockImplementation(async (_file: File, onProgress: (p: number) => void) => {
        onProgress(50)
        onProgress(100)
        return { success: true }
      })

    const { result } = renderHook(() =>
      useUploadQueue({ uploadFn, concurrency: 1, maxRetries: 0, timeoutMs: 5000 })
    )

    await act(async () => {
      result.current.addFiles([makeFile("progress.jpg")])
    })

    expect(result.current.items[0].progress).toBe(100)
    expect(result.current.items[0].status).toBe("succeeded")
  })

  it("isComplete is true only when all files are succeeded or failed", async () => {
    const { uploadFn, calls } = createControllableUploadFn()

    const { result } = renderHook(() =>
      useUploadQueue({ uploadFn, concurrency: 2, maxRetries: 0, timeoutMs: 60000 })
    )

    act(() => {
      result.current.addFiles(makeFiles(2))
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    // One resolved, one still pending
    expect(result.current.isComplete).toBe(false)

    await act(async () => {
      calls[0].resolve({ success: true })
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current.isComplete).toBe(false)

    await act(async () => {
      calls[1].resolve({ success: false, error: "fail" })
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current.isComplete).toBe(true)
    expect(result.current.succeeded).toBe(1)
    expect(result.current.failed).toBe(1)
  })

  it("handles mixed results — some succeed, some fail, some timeout", async () => {
    let callIndex = 0
    const uploadFn: UploadFn = vi.fn().mockImplementation(
      (_file: File, _onProgress: (p: number) => void, _signal: AbortSignal) => {
        callIndex++
        if (callIndex === 1) return Promise.resolve({ success: true })
        if (callIndex === 2)
          return Promise.resolve({ success: false, error: "Server error" })
        // Third file hangs — rejects when aborted by timeout
        return new Promise((_resolve, reject) => {
          _signal.addEventListener("abort", () => reject(new Error("aborted")))
        })
      }
    )

    const { result } = renderHook(() =>
      useUploadQueue({
        uploadFn,
        concurrency: 3,
        maxRetries: 0,
        timeoutMs: 3000,
      })
    )

    act(() => {
      result.current.addFiles(makeFiles(3))
    })

    // Advance past timeout
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(result.current.succeeded).toBe(1)
    expect(result.current.failed).toBe(2)
    expect(result.current.isComplete).toBe(true)

    const statuses = result.current.items.map((i) => i.status)
    expect(statuses).toContain("succeeded")
    expect(statuses).toContain("failed")

    const timedOut = result.current.items.find((i) => i.error === "Upload timed out")
    expect(timedOut).toBeDefined()
  })
})
