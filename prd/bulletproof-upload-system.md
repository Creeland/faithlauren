# PRD: Bulletproof Photo Upload System

## Problem Statement

When uploading a large number of photos (e.g., 201), the upload system hangs indefinitely. Progress bars freeze at 0% and the batch counter stalls (e.g., "19 of 201"), with no error message or recovery path. The only option is to abandon the upload entirely. This affects both gallery and portfolio uploaders, which share the same architecture.

The root cause is that uploads are processed in sequential batches with no per-file timeout, no retry mechanism, and no concurrency. A single hung file blocks the entire remaining upload with no feedback to the user.

## Solution

Replace the sequential batch upload system with a parallel upload queue that processes multiple files concurrently with per-file timeouts and automatic retries. The system should:

- Upload multiple files in parallel (configurable concurrency)
- Timeout and retry individual files without blocking others
- Show accurate per-file progress (not per-batch)
- Surface clear status for each file: queued, uploading, retrying, succeeded, or failed
- Offer a "Retry failed" action at the end so only failed files need to be re-attempted
- Never hang indefinitely — every file resolves to success or failure within a bounded time

## User Stories

1. As an admin, I want to select 200+ photos and have them all upload reliably, so that I don't have to babysit the process or upload in small manual batches.
2. As an admin, I want uploads to proceed in parallel, so that large galleries upload faster.
3. As an admin, I want to see per-file progress bars, so that I know exactly which files are uploading and how far along each one is.
4. As an admin, I want a file that fails to upload to be automatically retried, so that transient network issues don't require my intervention.
5. As an admin, I want to see a clear distinction between files that are queued, uploading, retrying, succeeded, and failed, so that I always know the state of my upload.
6. As an admin, I want a stuck file to timeout after a reasonable period, so that one problem file doesn't block the remaining 180 photos.
7. As an admin, I want to be able to retry only the failed files after the upload completes, so that I don't have to re-upload everything.
8. As an admin, I want the upload to continue even if some files fail, so that partial progress is preserved.
9. As an admin, I want a final summary showing how many succeeded and how many failed, so that I know if follow-up action is needed.
10. As an admin, I want the same reliable upload experience for both gallery and portfolio uploads, so that the system is consistent.
11. As an admin, I want the upload button to be disabled while uploads are in progress, so that I don't accidentally start a second upload.
12. As an admin, I want to see which specific files failed and why (timeout, server error, etc.), so that I can diagnose issues.
13. As an admin, I want the page to refresh and show newly uploaded photos after the upload completes, so that I can verify the results immediately.
14. As an admin, I want the system to handle large individual files (up to 30MB JPEGs) without timing out prematurely, so that high-resolution photos are supported.

## Implementation Decisions

### Upload Queue Module (`useUploadQueue` hook)

Extract all upload orchestration logic into a standalone, reusable React hook that is decoupled from UploadThing's `useUploadThing` hook. This is the core "deep module" — it encapsulates concurrency control, timeout, retry, and progress tracking behind a simple interface.

**Interface:**
- Input: list of files, an upload function (injected — wraps UploadThing), and configuration (concurrency limit, retry count, timeout duration)
- Output: per-file status map, overall progress, `startUpload()`, `retryFailed()`, and `isComplete` flag

**Behavior:**
- Maintains an internal queue of files
- Runs up to N uploads concurrently (suggested default: 3–5 concurrent uploads)
- Each file upload has an individual timeout (suggested: 120 seconds, tunable for large files)
- On failure or timeout, automatically retries up to 3 times with exponential backoff
- After max retries, marks the file as permanently failed
- Tracks per-file state: `queued | uploading | retrying | succeeded | failed`
- Tracks per-file progress percentage
- `retryFailed()` re-enqueues all permanently failed files for another round of attempts

**Key decisions:**
- Files are uploaded individually (not in batches of 20) to isolate failures. Each file is a single call to UploadThing's `startUpload` with one file.
- The UploadThing route's `maxFileCount` stays at 20 but each call sends 1 file — this is simpler and means one stuck file only costs one concurrency slot.
- The hook does NOT depend on UploadThing directly — it accepts an upload function, making it testable with a mock.

### Updated PhotoUploader Components

Both `galleries/[id]/photo-uploader.tsx` and `portfolios/[id]/photo-uploader.tsx` are updated to:
- Use `useUploadQueue` instead of the manual batch loop
- Render per-file status rows (queued/uploading/retrying/succeeded/failed) with progress bars
- Show overall progress (e.g., "142 of 201 uploaded")
- Show a "Retry failed" button when uploads complete with failures
- Keep the post-upload DB verification check as a safety net
- Remove the `buildBatches` function and batch-related state

### Server-side (no changes expected)

The UploadThing route configuration (`core.ts`) and server actions (`photo.ts`, `portfolio-photo.ts`) should not need changes. The `onUploadComplete` handler already processes files individually via transactions.

### Configuration Constants

- `CONCURRENT_UPLOADS`: 4 (number of parallel uploads)
- `UPLOAD_TIMEOUT_MS`: 120000 (2 minutes per file)
- `MAX_RETRIES`: 3 (automatic retries before marking failed)
- `RETRY_BACKOFF_BASE_MS`: 1000 (exponential backoff: 1s, 2s, 4s)

These should be defined as constants in the hook module, not in environment variables.

## Testing Decisions

### What makes a good test

Tests should verify external behavior through the hook's public interface — not implementation details like internal queue data structures or timer IDs. A good test sets up a scenario (files + mock upload function), drives the hook, and asserts on the resulting state (file statuses, progress, completion).

### Modules to test

**`useUploadQueue` hook** — this is the only module that needs tests. It contains all the non-trivial logic:

- Concurrency: given 10 files and concurrency of 3, only 3 uploads run at a time
- Timeout: a file that exceeds the timeout is marked failed and retried
- Retry: a file that fails is retried up to MAX_RETRIES times
- Retry backoff: retries use exponential backoff
- Permanent failure: after MAX_RETRIES, file is marked as permanently failed
- `retryFailed()`: re-enqueues only failed files
- Progress: per-file progress is tracked and exposed
- Completion: `isComplete` is true only when all files are succeeded or permanently failed
- Mixed results: some files succeed, some fail, some timeout — all are handled correctly

### Testing approach

Use `@testing-library/react` with `renderHook` to test the hook. Mock the upload function to simulate success, failure, timeout, and progress callbacks. Use fake timers for timeout and backoff tests.

## Out of Scope

- **Cross-session resume**: Closing the browser and resuming later is not supported. The system handles failures within a single session only.
- **Drag-and-drop upload UI**: The upload trigger remains a file input. A drag-and-drop zone could be added later.
- **Client-side image compression/resizing**: Files are uploaded as-is. Pre-upload optimization is a separate concern.
- **Upload cancellation**: A "cancel all" button is not included in this iteration, though the queue architecture would support it later.
- **Server-side changes**: The UploadThing route config and DB write logic are unchanged.
- **Progress per-file from UploadThing**: UploadThing's `onUploadProgress` fires a single percentage for the entire `startUpload` call. Since we're sending 1 file per call, this naturally becomes per-file progress — no workaround needed.

## Further Notes

- The current `onUploadProgress` callback from UploadThing reports a single progress value per `startUpload` call. By switching to 1 file per call, we get true per-file progress for free.
- The portfolio uploader's `onUploadComplete` does async dimension extraction with `sharp`. This is fire-and-forget and won't be affected by the client-side changes.
- The post-upload DB count verification is a useful safety net and should be preserved in the new system.
- UploadThing has rate limits — the concurrency setting (default 4) should be conservative enough to avoid hitting them. If rate limiting becomes an issue, reduce concurrency.
