# Plan: Bulletproof Photo Upload System

> Source PRD: prd/bulletproof-upload-system.md

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: No new routes. Existing UploadThing API route (`/api/uploadthing`) and admin gallery/portfolio pages remain unchanged.
- **Schema**: No schema changes. Existing `Photo` and `PortfolioPhoto` models are sufficient.
- **Server-side**: No changes to `onUploadComplete` handlers or server actions.
- **Core module**: New `useUploadQueue` hook that accepts an injected upload function (not coupled to UploadThing). Both gallery and portfolio uploaders consume this same hook.
- **Upload strategy**: Files uploaded individually (1 per `startUpload` call) instead of in batches of 20. This isolates failures to a single file.
- **Configuration constants**: `CONCURRENT_UPLOADS = 4`, `UPLOAD_TIMEOUT_MS = 120000`, `MAX_RETRIES = 3`, `RETRY_BACKOFF_BASE_MS = 1000`. Defined as constants in the hook module.

---

## Phase 1: Core queue + gallery uploader (sequential)

**User stories**: 1, 3, 5, 8, 9, 11, 13

### What to build

Build the `useUploadQueue` hook with concurrency of 1 (sequential), no retry, and no timeout. The hook accepts a list of files and an upload function, maintains per-file state (`queued | uploading | succeeded | failed`), and exposes per-file progress percentages.

Wire the hook into the gallery photo uploader, replacing the current `buildBatches` loop and batch-related state. Render per-file status rows with progress bars. Show an overall counter (e.g., "42 of 201 uploaded"). Disable the upload button while uploads are in progress. Refresh the page and show a final summary when complete.

This phase delivers a working end-to-end upload flow — slower than the final version (sequential), but already more reliable because individual file failures don't block the queue.

### Acceptance criteria

- [ ] Selecting 50+ photos starts uploading them one at a time through the gallery uploader
- [ ] Each file shows its own progress bar and status (queued → uploading → succeeded/failed)
- [ ] A failed file does not prevent remaining files from uploading
- [ ] Overall progress counter updates as each file completes
- [ ] Upload button is disabled during upload
- [ ] Page refreshes and shows newly uploaded photos after completion
- [ ] Final summary shows count of succeeded and failed files
- [ ] The old `buildBatches` function and batch state are removed from the gallery uploader

---

## Phase 2: Parallel uploads + timeout

**User stories**: 2, 6, 14

### What to build

Add concurrency control to `useUploadQueue` so that up to 4 files upload simultaneously. When a slot opens (file succeeds or fails), the next queued file starts immediately.

Add a per-file timeout. If a single file's upload takes longer than 120 seconds, abort it and mark it as failed. This ensures one stuck file only occupies one concurrency slot temporarily, and the queue keeps moving.

### Acceptance criteria

- [ ] With 20+ files queued, exactly 4 uploads run in parallel (observable via progress bars moving simultaneously)
- [ ] When one file completes, the next queued file starts immediately
- [ ] A file that hangs beyond 120 seconds is marked as failed with a timeout reason
- [ ] Other concurrent uploads are unaffected by a timed-out file
- [ ] Large files (30MB) that upload slowly but make progress are not prematurely timed out

---

## Phase 3: Automatic retry + retry-failed button

**User stories**: 4, 7, 12

### What to build

Add automatic retry logic to the queue. When a file fails (error or timeout), it is re-enqueued up to 3 times with exponential backoff (1s, 2s, 4s). The file status shows `retrying` during backoff. After 3 failures, the file is marked as permanently failed with the error reason visible in the UI.

Add a "Retry failed" button that appears after the upload completes if any files are permanently failed. Clicking it re-enqueues only the failed files for another round of attempts.

Preserve the post-upload DB count verification as a safety net — compare expected vs actual photo count and show a warning if they diverge.

### Acceptance criteria

- [ ] A file that fails is automatically retried up to 3 times
- [ ] Retries use exponential backoff (not immediate)
- [ ] File status shows "retrying" during backoff with attempt count (e.g., "Retry 2/3")
- [ ] After 3 failures, file is marked permanently failed with error reason (timeout, server error, etc.)
- [ ] "Retry failed" button appears after upload completes with failures
- [ ] Clicking "Retry failed" re-enqueues only failed files
- [ ] Post-upload DB verification shows warning if saved count is less than expected

---

## Phase 4: Portfolio uploader parity

**User stories**: 10

### What to build

Update the portfolio photo uploader to use the same `useUploadQueue` hook, replacing its batch upload logic. The portfolio uploader should have identical upload behavior and UI to the gallery uploader — parallel uploads, timeouts, retries, per-file status, and retry-failed button.

### Acceptance criteria

- [ ] Portfolio photo uploader uses `useUploadQueue` with the same configuration
- [ ] All upload behaviors (parallelism, timeout, retry, progress) work identically to the gallery uploader
- [ ] The old batch logic is removed from the portfolio uploader
- [ ] Portfolio-specific server behavior (async dimension extraction via sharp) is unaffected

---

## Phase 5: Tests for `useUploadQueue`

**User stories**: Testing decisions from PRD

### What to build

Unit tests for the `useUploadQueue` hook using `@testing-library/react` with `renderHook`. Use a mock upload function that can simulate success, failure, timeout, and progress callbacks. Use fake timers for timeout and backoff assertions.

Tests verify external behavior through the hook's public interface — not internal data structures.

### Acceptance criteria

- [ ] Test: with concurrency of 3 and 10 files, only 3 uploads run at a time
- [ ] Test: a file exceeding the timeout is marked failed
- [ ] Test: a failed file is retried up to MAX_RETRIES times
- [ ] Test: retries use exponential backoff
- [ ] Test: after MAX_RETRIES, file is marked permanently failed
- [ ] Test: `retryFailed()` re-enqueues only permanently failed files
- [ ] Test: per-file progress is tracked and exposed correctly
- [ ] Test: `isComplete` is true only when all files are succeeded or permanently failed
- [ ] Test: mixed scenario — some files succeed, some fail, some timeout — all handled correctly
